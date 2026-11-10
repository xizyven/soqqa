/**
 * Client sync engine: drains the persistent outbox to the server, pulls remote
 * changes, resolves conflicts and reports an honest status.
 *
 * Guarantees:
 *  - At-least-once delivery + server idempotency (op_id) = exactly-once effect.
 *  - Ops are sent in creation order; a failed op never blocks later ops of
 *    other entities, but later ops of the same entity wait for it.
 *  - Remote rows never overwrite an entity that still has pending local ops.
 *  - Conflicts are recorded locally; the losing version is preserved.
 */
import type { EntityTable } from "../domain/types";
import type { ConflictRecord, OutboxOp, SoqqaDB } from "../data/db";
import { parseAmount, toAmountString } from "../money/money";
import { SERVER_COLUMNS, TransportError, type PushResult, type SyncTransport } from "./protocol";

export type SyncState = "local" | "offline" | "pending" | "syncing" | "synced" | "error";

export interface SyncStatus {
  state: SyncState;
  pending: number;
  failed: number;
  conflicts: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  nextRetryAt: number | null;
}

export interface EngineOptions {
  now?: () => number;
  random?: () => number;
  batchSize?: number;
  isOnline?: () => boolean;
}

const BASE_DELAY = 1000;
const MAX_DELAY = 5 * 60 * 1000;
const MAX_ATTEMPTS = 12;

export function backoffDelay(attempts: number, random = Math.random): number {
  const exp = Math.min(MAX_DELAY, BASE_DELAY * 2 ** Math.max(0, attempts - 1));
  // Full jitter between 50% and 100% of the exponential delay.
  return Math.round(exp * (0.5 + random() * 0.5));
}

export class SyncEngine {
  private running: Promise<void> | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus = { state: "pending", pending: 0, failed: 0, conflicts: 0, lastSyncedAt: null, lastError: null, nextRetryAt: null };
  private now: () => number;
  private random: () => number;
  private batchSize: number;
  private isOnline: () => boolean;

  constructor(private db: SoqqaDB, private transport: SyncTransport | null, opts: EngineOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.random = opts.random ?? Math.random;
    this.batchSize = opts.batchSize ?? 100;
    this.isOnline = opts.isOnline ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine));
  }

  subscribe(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  private emit(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const l of this.listeners) l(this.status);
  }

  async refreshCounts(): Promise<void> {
    const [pending, failed, conflicts, lastSyncedAt] = await Promise.all([
      this.db.outbox.where("status").equals("pending").count(),
      this.db.outbox.where("status").equals("failed").count(),
      this.db.conflicts.filter((c) => !c.dismissed).count(),
      this.db.getMeta<string>("last_synced_at"),
    ]);
    let state: SyncState = this.status.state;
    if (!this.transport) state = "local";
    else if (!this.isOnline()) state = "offline";
    else if (state !== "syncing") state = failed > 0 || this.status.lastError ? "error" : pending > 0 ? "pending" : "synced";
    this.emit({ pending, failed, conflicts, lastSyncedAt: lastSyncedAt ?? null, state });
  }

  /** Runs one full sync cycle (push then pull). Concurrent calls share the same run. */
  sync(): Promise<void> {
    if (!this.running) {
      this.running = this.runCycle().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async runCycle(): Promise<void> {
    if (!this.transport) {
      await this.refreshCounts();
      return;
    }
    if (!this.isOnline()) {
      this.emit({ state: "offline" });
      await this.refreshCounts();
      return;
    }
    this.emit({ state: "syncing", lastError: null });
    try {
      await this.pushAll();
      await this.pullAll();
      const nowIso = new Date(this.now()).toISOString();
      await this.db.setMeta("last_synced_at", nowIso);
      const nextDue = await this.nextDue();
      this.emit({ state: "synced", lastError: null, nextRetryAt: nextDue });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.emit({ state: "error", lastError: message, nextRetryAt: await this.nextDue() });
    }
    await this.refreshCounts();
  }

  private async nextDue(): Promise<number | null> {
    const pending = await this.db.outbox.where("status").equals("pending").toArray();
    if (!pending.length) return null;
    return Math.min(...pending.map((p) => p.next_attempt_at));
  }

  private async pushAll(): Promise<void> {
    for (let guard = 0; guard < 1000; guard++) {
      const now = this.now();
      const all = await this.db.outbox.orderBy("created_at").toArray();
      const blocked = new Set<string>();
      const batch: OutboxOp[] = [];
      for (const op of all) {
        const key = `${op.table}:${op.entity_id}`;
        if (op.status === "failed" || op.next_attempt_at > now || blocked.has(key)) {
          blocked.add(key);
          continue;
        }
        blocked.add(key); // one op per entity per batch keeps ordering simple
        batch.push(op);
        if (batch.length >= this.batchSize) break;
      }
      if (!batch.length) return;

      let results: PushResult[];
      try {
        results = await this.transport!.push(
          batch.map((o) => ({ op_id: o.op_id, table: o.table, row: o.row, base_version: o.base_version, client_updated_at: o.client_updated_at })),
        );
      } catch (e) {
        await this.markRetry(batch, e);
        throw e;
      }
      const byId = new Map(results.map((r) => [r.op_id, r]));
      for (const op of batch) {
        const r = byId.get(op.op_id);
        if (!r) await this.markRetry([op], new TransportError("missing result"));
        else await this.applyResult(op, r);
      }
    }
  }

  private async markRetry(ops: OutboxOp[], e: unknown): Promise<void> {
    const msg = e instanceof Error ? e.message : String(e);
    const retryable = !(e instanceof TransportError) || e.retryable;
    await this.db.transaction("rw", this.db.outbox, async () => {
      for (const op of ops) {
        const attempts = op.attempts + 1;
        const fail = !retryable || attempts >= MAX_ATTEMPTS;
        await this.db.outbox.update(op.op_id, {
          attempts,
          last_error: msg,
          status: fail ? "failed" : "pending",
          next_attempt_at: this.now() + backoffDelay(attempts, this.random),
        });
      }
    });
  }

  private async applyResult(op: OutboxOp, r: PushResult): Promise<void> {
    const table = this.db.entityTable(op.table);
    await this.db.transaction("rw", [table, this.db.outbox, this.db.conflicts], async () => {
      if (r.status === "rejected") {
        await this.db.outbox.update(op.op_id, { status: "failed", attempts: op.attempts + 1, last_error: r.error ?? "rejected" });
        return;
      }
      await this.db.outbox.delete(op.op_id);
      const later = (await this.db.outbox.where("entity_id").equals(op.entity_id).toArray()).filter((o) => o.table === op.table);
      const local = await table.get(op.entity_id);

      if (r.status === "applied" || r.status === "applied_lww") {
        const version = r.version ?? op.base_version + 1;
        if (local) await table.update(op.entity_id, { version });
        for (const o of later) await this.db.outbox.update(o.op_id, { base_version: version });
        if (r.status === "applied_lww" && r.row && !r.duplicate) await this.recordConflict(op.table, op.entity_id, r.row, op.row, "client_won");
        return;
      }

      // conflict: the server copy is newer. Preserve the local version in the log.
      const serverRow = cleanRow(r.row ?? {});
      if (!r.duplicate) await this.recordConflict(op.table, op.entity_id, op.row, serverRow, "server_won");
      if (later.length) {
        // Newer local edits are still queued: rebase them onto the server version.
        for (const o of later) await this.db.outbox.update(o.op_id, { base_version: r.version ?? 0 });
      } else if (serverRow.id) {
        await table.put(serverRow as Record<string, unknown> & { id: string });
      }
    });
  }

  private async recordConflict(table: EntityTable, entityId: string, discarded: Record<string, unknown>, kept: Record<string, unknown>, resolution: ConflictRecord["resolution"]) {
    await this.db.conflicts.put({
      id: `${table}:${entityId}:${this.now()}:${Math.floor(this.random() * 1e6)}`,
      table,
      entity_id: entityId,
      discarded: cleanRow(discarded),
      kept: cleanRow(kept),
      resolution,
      created_at: new Date(this.now()).toISOString(),
      dismissed: false,
    });
  }

  private async pullAll(): Promise<void> {
    let cursor = (await this.db.getMeta<number>("pull_cursor")) ?? 0;
    for (let guard = 0; guard < 1000; guard++) {
      const res = await this.transport!.pull(cursor, 500);
      if (res.changes.length) {
        const tables = [...new Set(res.changes.map((c) => c.table))].map((t) => this.db.entityTable(t));
        await this.db.transaction("rw", [...tables, this.db.outbox, this.db.meta], async () => {
          const pendingIds = new Set((await this.db.outbox.toArray()).map((o) => `${o.table}:${o.entity_id}`));
          for (const c of res.changes) {
            const row = cleanRow(c.row);
            const id = String(row.id);
            if (pendingIds.has(`${c.table}:${id}`)) continue; // local edits win until pushed
            const t = this.db.entityTable(c.table);
            const local = (await t.get(id)) as { version?: number } | undefined;
            if (local && (local.version ?? 0) >= Number(row.version ?? 0)) continue;
            await t.put(row as Record<string, unknown> & { id: string });
          }
          await this.db.setMeta("pull_cursor", res.cursor);
        });
      }
      cursor = res.cursor;
      if (!res.hasMore) return;
    }
  }
}

const AMOUNT_KEYS = ["amount", "opening_balance", "base_amount", "to_amount", "target_amount", "monthly_target", "wallet_amount"];
const RATE_KEYS = ["rate_to_base", "transfer_rate", "uzs_per_unit", "rate"];

/** Strips server-owned columns and canonicalises decimal fields received from Postgres. */
export function cleanRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const c of SERVER_COLUMNS) delete out[c];
  for (const k of AMOUNT_KEYS) {
    const v = out[k];
    if (v !== null && v !== undefined && v !== "") out[k] = toAmountString(parseAmount(String(v)));
  }
  for (const k of RATE_KEYS) {
    const v = out[k];
    if (typeof v === "string" || typeof v === "number") {
      const str = String(v);
      out[k] = str.includes(".") ? str.replace(/0+$/, "").replace(/\.$/, "") : str;
    }
  }
  if (typeof out.alert_threshold === "string") out.alert_threshold = Number(out.alert_threshold);
  for (const k of ["created_at", "updated_at", "deleted_at", "occurred_at"]) {
    const v = out[k];
    if (typeof v === "string" && v) out[k] = new Date(v).toISOString();
  }
  return out;
}
