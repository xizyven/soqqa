/**
 * Reference implementation of the server side of the sync protocol, in memory.
 * Mirrors `soqqa_sync_push` / `soqqa_sync_pull` in the Postgres migration and is
 * used by tests (and to verify the client engine without a network).
 */
import { ENTITY_TABLES, type EntityTable } from "../domain/types";
import type { PullResponse, PushOp, PushResult, SyncTransport } from "./protocol";
import { TransportError } from "./protocol";

type Row = Record<string, unknown> & { id: string; version: number; updated_at: string; user_id: string; server_seq: number };

export class MemoryServer {
  private rows = new Map<string, Row>(); // key: table|user|id
  private applied = new Map<string, { user: string; result: PushResult }>();
  private seq = 0;
  /** When true every call fails like a dropped connection. */
  offline = false;
  /** Fails the next N push calls after applying them (simulates a lost response). */
  dropResponses = 0;

  transportFor(userId: string): SyncTransport {
    return {
      push: async (ops) => {
        if (this.offline) throw new TransportError("network");
        const results = this.push(userId, ops);
        if (this.dropResponses > 0) {
          this.dropResponses--;
          throw new TransportError("response lost");
        }
        return results;
      },
      pull: async (cursor, limit) => {
        if (this.offline) throw new TransportError("network");
        return this.pull(userId, cursor, limit);
      },
    };
  }

  push(user: string, ops: PushOp[]): PushResult[] {
    return ops.map((op) => {
      const prev = this.applied.get(op.op_id);
      if (prev) {
        if (prev.user !== user) return { op_id: op.op_id, status: "rejected", error: "forbidden" };
        return { ...prev.result, duplicate: true };
      }
      const result = this.applyOne(user, op);
      if (result.status !== "rejected") this.applied.set(op.op_id, { user, result });
      return result;
    });
  }

  private applyOne(user: string, op: PushOp): PushResult {
    if (!ENTITY_TABLES.includes(op.table)) return { op_id: op.op_id, status: "rejected", error: "unknown_table" };
    const id = String(op.row.id ?? "");
    if (!id) return { op_id: op.op_id, status: "rejected", error: "missing_id" };
    const key = `${op.table}|${user}|${id}`;
    const current = this.rows.get(key);
    const write = (version: number): Row => {
      const row = { ...op.row, id, user_id: user, version, server_seq: ++this.seq } as Row;
      this.rows.set(key, row);
      return row;
    };
    if (!current) {
      write(1);
      return { op_id: op.op_id, status: "applied", version: 1 };
    }
    if (op.table === "exchange_rates" && current.uzs_per_unit !== op.row.uzs_per_unit)
      return { op_id: op.op_id, status: "rejected", error: "rates_immutable" };
    if (current.version === op.base_version) {
      write(current.version + 1);
      return { op_id: op.op_id, status: "applied", version: current.version + 1 };
    }
    if (op.client_updated_at > current.updated_at) {
      const before = { ...current };
      write(current.version + 1);
      return { op_id: op.op_id, status: "applied_lww", version: current.version + 1, row: strip(before) };
    }
    return { op_id: op.op_id, status: "conflict", version: current.version, row: strip(current) };
  }

  pull(user: string, cursor: number, limit: number): PullResponse {
    const all = [...this.rows.entries()]
      .filter(([k, r]) => k.split("|")[1] === user && r.server_seq > cursor)
      .map(([k, r]) => ({ table: k.split("|")[0] as EntityTable, row: { ...r }, seq: r.server_seq }))
      .sort((a, b) => a.seq - b.seq);
    const changes = all.slice(0, limit);
    return { changes, cursor: changes.length ? changes[changes.length - 1].seq : cursor, hasMore: all.length > limit };
  }

  /** Direct server-side edit (simulates another device). */
  serverEdit(user: string, table: EntityTable, id: string, patch: Record<string, unknown>) {
    const key = `${table}|${user}|${id}`;
    const cur = this.rows.get(key);
    if (!cur) throw new Error("not found");
    this.rows.set(key, { ...cur, ...patch, version: cur.version + 1, server_seq: ++this.seq } as Row);
  }

  get(user: string, table: EntityTable, id: string): Row | undefined {
    return this.rows.get(`${table}|${user}|${id}`);
  }

  count(user: string, table: EntityTable): number {
    return [...this.rows.keys()].filter((k) => k.startsWith(`${table}|${user}|`)).length;
  }
}

function strip(r: Row): Record<string, unknown> {
  const { user_id: _u, server_seq: _s, ...rest } = r;
  void _u;
  void _s;
  return rest;
}
