import { afterEach, describe, expect, it } from "vitest";
import { SoqqaDB } from "@/lib/data/db";
import { Repo, systemCategoryId, ValidationError } from "@/lib/data/repo";
import { backoffDelay, SyncEngine } from "@/lib/sync/engine";
import { MemoryServer } from "@/lib/sync/memory-server";
import { walletBalances } from "@/lib/domain/ledger";
import { toAmountString } from "@/lib/money/money";

let dbCounter = 0;
const opened: SoqqaDB[] = [];
function newDb(kind: "personal" | "demo" = "personal") {
  const db = new SoqqaDB(kind, `test_${kind}_${++dbCounter}`);
  opened.push(db);
  return db;
}
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

let clock = Date.parse("2026-11-09T08:00:00Z");
const now = () => new Date((clock += 1000));

async function device(server?: MemoryServer, user = "user-a", online = { value: true }) {
  const db = newDb();
  const repo = new Repo(db, { now });
  await repo.ensureSeeded();
  const engine = new SyncEngine(db, server ? server.transportFor(user) : null, { now: () => clock, random: () => 0.5, isOnline: () => online.value });
  return { db, repo, engine, online };
}

const FOOD = systemCategoryId(0);
const SALARY = systemCategoryId(12);

describe("repository", () => {
  it("writes entity and outbox op atomically; validation failures write nothing", async () => {
    const { db, repo } = await device();
    const w = await repo.saveWallet({ name: "Asosiy karta", currency: "UZS", icon: "credit-card", color: "#3B82F6", opening_balance: "100000", spendable: true });
    await repo.saveTransaction({ type: "expense", wallet_id: w.id, amount: "45000", category_id: FOOD, local_date: "2026-11-09" });
    expect(await db.transactions.count()).toBe(1);
    expect(await db.outbox.count()).toBe(2);
    await expect(repo.saveTransaction({ type: "expense", wallet_id: w.id, amount: "-5", category_id: FOOD, local_date: "2026-11-09" })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.saveTransaction({ type: "expense", wallet_id: w.id, amount: "5", local_date: "2026-11-09" })).rejects.toBeInstanceOf(ValidationError);
    expect(await db.transactions.count()).toBe(1);
    expect(await db.outbox.count()).toBe(2);
  });

  it("coalesces unsent edits but preserves already-attempted ops", async () => {
    const { db, repo } = await device();
    const w = await repo.saveWallet({ name: "A", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true });
    await repo.saveWallet({ name: "B", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true }, w.id);
    expect(await db.outbox.count()).toBe(1);
    const [op] = await db.outbox.toArray();
    expect(op.row.name).toBe("B");
    await db.outbox.update(op.op_id, { attempts: 1 });
    await repo.saveWallet({ name: "C", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true }, w.id);
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(2);
    expect(ops.find((o) => o.op_id === op.op_id)!.row.name).toBe("B");
  });

  it("editing a note keeps the original exchange-rate snapshot", async () => {
    const { repo } = await device();
    await repo.addRate({ currency: "USD", uzs_per_unit: "12500", effective_date: "2026-11-01", source: "manual" });
    const usd = await repo.saveWallet({ name: "USD", currency: "USD", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true });
    const t = await repo.saveTransaction({ type: "income", wallet_id: usd.id, amount: "200", category_id: SALARY, local_date: "2026-11-05" });
    await repo.addRate({ currency: "USD", uzs_per_unit: "13000", effective_date: "2026-11-01", source: "manual" });
    const edited = await repo.saveTransaction({ type: "income", wallet_id: usd.id, amount: "250", category_id: SALARY, local_date: "2026-11-05", note: "bonus" }, t.id);
    expect(edited.rate_to_base).toBe("12500");
    expect(edited.base_amount).toBe("3125000.00");
    expect(edited.created_at).toBe(t.created_at);
  });

  it("deleting a transaction soft-deletes it and its refunds", async () => {
    const { db, repo } = await device();
    const w = await repo.saveWallet({ name: "A", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true });
    const e = await repo.saveTransaction({ type: "expense", wallet_id: w.id, amount: "100000", category_id: FOOD, local_date: "2026-11-05" });
    await repo.saveTransaction({ type: "refund", wallet_id: w.id, amount: "20000", related_id: e.id, local_date: "2026-11-06" });
    await repo.deleteTransaction(e.id);
    const all = await db.transactions.toArray();
    expect(all).toHaveLength(2);
    expect(all.every((t) => t.deleted_at)).toBe(true);
  });

  it("posting a recurring item creates one transaction and advances the schedule", async () => {
    const { db, repo } = await device();
    const w = await repo.saveWallet({ name: "A", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true });
    const r = await repo.saveRecurring({ name: "Internet", type: "expense", amount: "150000", wallet_id: w.id, category_id: systemCategoryId(5), frequency: "monthly", start_date: "2026-10-31", active: true });
    await repo.postRecurring(r.id);
    expect((await db.recurring.get(r.id))!.next_date).toBe("2026-11-30");
    expect(await db.transactions.count()).toBe(1);
  });

  it("goal withdrawals cannot exceed the saved amount", async () => {
    const { repo } = await device();
    const g = await repo.saveGoal({ name: "Sayohat", target_amount: "5000000", currency: "UZS", target_date: null, monthly_target: null, icon: "plane", color: "#3B82F6", status: "active" });
    await repo.addContribution({ goal_id: g.id, kind: "contribution", amount: "100000", wallet_id: null, local_date: "2026-11-01" });
    await expect(repo.addContribution({ goal_id: g.id, kind: "withdrawal", amount: "200000", wallet_id: null, local_date: "2026-11-02" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("demo database never enqueues sync operations", async () => {
    const db = newDb("demo");
    const repo = new Repo(db, { now });
    await repo.ensureSeeded();
    await repo.saveWallet({ name: "Demo", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true });
    expect(await db.outbox.count()).toBe(0);
  });
});

describe("offline-first sync", () => {
  it("creates, edits and deletes offline, then syncs once connectivity returns", async () => {
    const server = new MemoryServer();
    const online = { value: false };
    const { repo, engine, db } = await device(server, "user-a", online);
    const w = await repo.saveWallet({ name: "Naqd", currency: "UZS", icon: "banknote", color: "#10B981", opening_balance: "500000", spendable: true });
    const t = await repo.saveTransaction({ type: "expense", wallet_id: w.id, amount: "45000", category_id: FOOD, local_date: "2026-11-09" });
    await repo.saveTransaction({ type: "expense", wallet_id: w.id, amount: "50000", category_id: FOOD, local_date: "2026-11-09", note: "edited" }, t.id);
    const t2 = await repo.saveTransaction({ type: "expense", wallet_id: w.id, amount: "1000", category_id: FOOD, local_date: "2026-11-09" });
    await repo.deleteTransaction(t2.id);

    await engine.sync();
    expect(engine.getStatus().state).toBe("offline");
    expect(engine.getStatus().pending).toBe(3);
    expect(server.count("user-a", "transactions")).toBe(0);

    online.value = true;
    await engine.sync();
    expect(engine.getStatus().state).toBe("synced");
    expect(engine.getStatus().pending).toBe(0);
    expect(server.get("user-a", "transactions", t.id)!.amount).toBe("50000.00");
    expect(server.get("user-a", "transactions", t2.id)!.deleted_at).not.toBeNull();
    expect((await db.transactions.get(t.id))!.version).toBe(1);
  });

  it("never duplicates records when a response is lost and the batch is retried", async () => {
    const server = new MemoryServer();
    const { repo, engine } = await device(server);
    const w = await repo.saveWallet({ name: "A", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true });
    await repo.saveTransaction({ type: "income", wallet_id: w.id, amount: "1000000", category_id: SALARY, local_date: "2026-11-09" });
    server.dropResponses = 1;
    await engine.sync();
    expect(engine.getStatus().state).toBe("error");
    expect(engine.getStatus().pending).toBe(2);
    clock += 10 * 60 * 1000; // past backoff
    await engine.sync();
    expect(engine.getStatus().state).toBe("synced");
    expect(server.count("user-a", "transactions")).toBe(1);
    expect(server.get("user-a", "transactions", (await repo.db.transactions.toArray())[0].id)!.version).toBe(1);
  });

  it("transfers sync atomically as a single record", async () => {
    const server = new MemoryServer();
    const { repo, engine } = await device(server);
    const a = await repo.saveWallet({ name: "Karta", currency: "UZS", icon: "credit-card", color: "#3B82F6", opening_balance: "1000000", spendable: true });
    const b = await repo.saveWallet({ name: "Naqd", currency: "UZS", icon: "banknote", color: "#10B981", opening_balance: "0", spendable: true });
    const t = await repo.saveTransaction({ type: "transfer", wallet_id: a.id, to_wallet_id: b.id, amount: "300000", local_date: "2026-11-09" });
    await engine.sync();
    const row = server.get("user-a", "transactions", t.id)!;
    expect(row.wallet_id).toBe(a.id);
    expect(row.to_wallet_id).toBe(b.id);
    expect(row.to_amount).toBe("300000.00");
  });

  it("two devices converge; pull never overwrites pending local edits", async () => {
    const server = new MemoryServer();
    const d1 = await device(server);
    const d2 = await device(server);
    const w = await d1.repo.saveWallet({ name: "Karta", currency: "UZS", icon: "credit-card", color: "#3B82F6", opening_balance: "1000000", spendable: true });
    await d1.repo.saveTransaction({ type: "expense", wallet_id: w.id, amount: "100000", category_id: FOOD, local_date: "2026-11-09" });
    await d1.engine.sync();
    await d2.engine.sync();
    const l2 = await d2.repo.loadLedger();
    expect(toAmountString(walletBalances(l2).get(w.id)!)).toBe("900000.00");

    // d2 edits locally (pending) while d1 pushes a different edit.
    await d1.repo.saveWallet({ name: "Karta (d1)", currency: "UZS", icon: "credit-card", color: "#3B82F6", opening_balance: "1000000", spendable: true }, w.id);
    await d2.repo.saveWallet({ name: "Karta (d2)", currency: "UZS", icon: "credit-card", color: "#3B82F6", opening_balance: "1000000", spendable: true }, w.id);
    await d1.engine.sync();
    // d2's pull must not overwrite its own pending edit with d1's version.
    expect((await d2.db.wallets.get(w.id))!.name).toBe("Karta (d2)");
    // d2 is newer → last writer wins on push, and the overwritten d1 version is kept in the conflict log.
    await d2.engine.sync();
    expect(server.get("user-a", "wallets", w.id)!.name).toBe("Karta (d2)");
    const conflicts = await d2.db.conflicts.toArray();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resolution).toBe("client_won");
    expect(conflicts[0].discarded.name).toBe("Karta (d1)");
    await d1.engine.sync();
    expect((await d1.db.wallets.get(w.id))!.name).toBe("Karta (d2)");
  });

  it("stale local edits lose to newer server edits and are preserved in the conflict log", async () => {
    const server = new MemoryServer();
    const d1 = await device(server);
    const w = await d1.repo.saveWallet({ name: "Old", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true });
    await d1.engine.sync();
    // Local edit made at an earlier client time than the server edit.
    const localEdit = await d1.repo.saveWallet({ name: "Local", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true }, w.id);
    server.serverEdit("user-a", "wallets", w.id, { name: "Server", updated_at: new Date(Date.parse(localEdit.updated_at) + 60000).toISOString() });
    await d1.engine.sync();
    expect((await d1.db.wallets.get(w.id))!.name).toBe("Server");
    const [c] = await d1.db.conflicts.toArray();
    expect(c.resolution).toBe("server_won");
    expect(c.discarded.name).toBe("Local");
  });

  it("isolates users on the server", async () => {
    const server = new MemoryServer();
    const a = await device(server, "user-a");
    const b = await device(server, "user-b");
    await a.repo.saveWallet({ name: "Secret", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "999", spendable: true });
    await a.engine.sync();
    await b.engine.sync();
    expect(await b.db.wallets.count()).toBe(0);
    // Replaying another user's op_id is rejected, not leaked.
    const [res] = server.push("user-b", [{ op_id: [...(server as unknown as { applied: Map<string, unknown> }).applied.keys()][0], table: "wallets", row: { id: "x" }, base_version: 0, client_updated_at: "" }]);
    expect(res.status).toBe("rejected");
  });

  it("uses exponential backoff with jitter", () => {
    expect(backoffDelay(1, () => 0)).toBe(500);
    expect(backoffDelay(1, () => 1)).toBe(1000);
    expect(backoffDelay(4, () => 1)).toBe(8000);
    expect(backoffDelay(30, () => 1)).toBe(300000);
  });

  it("reports local-only state honestly when no cloud is configured", async () => {
    const { repo, engine } = await device();
    await repo.saveWallet({ name: "A", currency: "UZS", icon: "wallet", color: "#3B82F6", opening_balance: "0", spendable: true });
    await engine.sync();
    expect(engine.getStatus().state).toBe("local");
    expect(engine.getStatus().pending).toBe(1);
  });
});

describe("row canonicalisation", () => {
  it("normalises decimals received from Postgres without losing precision", async () => {
    const { cleanRow } = await import("@/lib/sync/engine");
    const r = cleanRow({ id: "x", user_id: "u", server_seq: 5, amount: "45000", transfer_rate: "0.0000790486", uzs_per_unit: "12650.4500000000", rate_to_base: "1.0000000000", updated_at: "2026-11-09T08:00:00+00:00" });
    expect(r).toEqual({ id: "x", amount: "45000.00", transfer_rate: "0.0000790486", uzs_per_unit: "12650.45", rate_to_base: "1", updated_at: "2026-11-09T08:00:00.000Z" });
  });
});
