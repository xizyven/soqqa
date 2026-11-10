/**
 * Runs the real Supabase migration inside PGlite (WASM Postgres) with a stub
 * `auth` schema, and verifies RLS isolation, idempotency, conflict handling
 * and the end-to-end client engine against the SQL implementation.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { SoqqaDB } from "@/lib/data/db";
import { Repo, systemCategoryId } from "@/lib/data/repo";
import { SyncEngine } from "@/lib/sync/engine";
import { rpcTransport } from "@/lib/sync/rpc-transport";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

const AUTH_STUB = `
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
`;

let pg: PGlite;

/** Serialises calls: PGlite is single-connection, so role switching must not interleave. */
let chain: Promise<unknown> = Promise.resolve();
function asUser<T>(user: string | null, fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false); set role ${user ? "authenticated" : "anon"};`);
    try {
      return await fn();
    } finally {
      await pg.exec("reset role;");
    }
  });
  chain = run.catch(() => undefined);
  return run;
}

async function rpc(user: string | null, fn: string, args: Record<string, unknown>) {
  return asUser(user, async () => {
    if (fn === "soqqa_sync_push") {
      const r = await pg.query<{ r: unknown }>("select public.soqqa_sync_push($1::jsonb) as r", [JSON.stringify(args.ops)]);
      return r.rows[0].r;
    }
    const r = await pg.query<{ r: unknown }>("select public.soqqa_sync_pull($1::bigint, $2::int) as r", [args.since, args.max_rows]);
    return r.rows[0].r;
  });
}

const walletRow = (id: string, p: Record<string, unknown> = {}) => ({
  id, created_at: "2026-11-09T08:00:00.000Z", updated_at: "2026-11-09T08:00:00.000Z", deleted_at: null, version: 0,
  name: "Karta", currency: "UZS", icon: "credit-card", color: "#3B82F6", opening_balance: "1250000.55", spendable: true, archived: false, sort: 0, ...p,
});

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(AUTH_STUB);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const f of readdirSync(dir).sort()) await pg.exec(readFileSync(join(dir, f), "utf8"));
  await pg.query("insert into auth.users (id, email) values ($1, 'a@x.uz'), ($2, 'b@x.uz')", [USER_A, USER_B]);
}, 60000);

afterAll(async () => {
  await pg?.close();
});

describe("postgres schema & sync functions", () => {
  it("creates profiles for new auth users", async () => {
    const r = await pg.query("select count(*)::int as n from public.profiles");
    expect((r.rows[0] as { n: number }).n).toBe(2);
  });

  it("applies pushes idempotently and serialises numerics as exact strings", async () => {
    const id = "aaaaaaaa-0000-4000-8000-000000000001";
    const op = { op_id: "bbbbbbbb-0000-4000-8000-000000000001", table: "wallets", row: walletRow(id), base_version: 0, client_updated_at: "2026-11-09T08:00:00.000Z" };
    const first = (await rpc(USER_A, "soqqa_sync_push", { ops: [op] })) as { status: string; version: number }[];
    expect(first[0]).toMatchObject({ status: "applied", version: 1 });
    const again = (await rpc(USER_A, "soqqa_sync_push", { ops: [op] })) as { status: string; duplicate: boolean }[];
    expect(again[0]).toMatchObject({ status: "applied", duplicate: true });
    const pulled = (await rpc(USER_A, "soqqa_sync_pull", { since: 0, max_rows: 100 })) as { changes: { row: Record<string, unknown> }[] };
    const rows = pulled.changes.filter((c) => c.row.id === id);
    expect(rows).toHaveLength(1);
    expect(rows[0].row.opening_balance).toBe("1250000.55");
    expect(rows[0].row.user_id).toBeUndefined();
  });

  it("enforces row level security between users", async () => {
    const pulledB = (await rpc(USER_B, "soqqa_sync_pull", { since: 0, max_rows: 100 })) as { changes: unknown[] };
    expect(pulledB.changes).toHaveLength(0);
    const direct = await asUser(USER_B, () => pg.query("select * from public.wallets"));
    expect(direct.rows).toHaveLength(0);
    // B cannot overwrite A's row even with the same id: it lands in B's own keyspace.
    const id = "aaaaaaaa-0000-4000-8000-000000000001";
    await rpc(USER_B, "soqqa_sync_push", { ops: [{ op_id: "bbbbbbbb-0000-4000-8000-0000000000b1", table: "wallets", row: walletRow(id, { name: "Hijack" }), base_version: 0, client_updated_at: "2027-01-01T00:00:00.000Z" }] });
    const a = await asUser(USER_A, () => pg.query<{ name: string }>("select name from public.wallets where id = $1", [id]));
    expect(a.rows[0].name).toBe("Karta");
    // B cannot insert rows for A directly.
    await expect(
      asUser(USER_B, () => pg.query("insert into public.wallets (user_id, id, created_at, updated_at, name, currency, icon, color, opening_balance) values ($1, gen_random_uuid(), now(), now(), 'x', 'UZS', 'w', '#000000', 0)", [USER_A])),
    ).rejects.toThrow();
    // Anonymous callers cannot sync.
    await expect(rpc(null, "soqqa_sync_pull", { since: 0, max_rows: 10 })).rejects.toThrow();
  });

  it("detects conflicts with last-writer-wins on client time", async () => {
    const id = "aaaaaaaa-0000-4000-8000-000000000002";
    await rpc(USER_A, "soqqa_sync_push", { ops: [{ op_id: "cccccccc-0000-4000-8000-000000000001", table: "wallets", row: walletRow(id, { updated_at: "2026-11-09T10:00:00.000Z" }), base_version: 0, client_updated_at: "2026-11-09T10:00:00.000Z" }] });
    await rpc(USER_A, "soqqa_sync_push", { ops: [{ op_id: "cccccccc-0000-4000-8000-000000000002", table: "wallets", row: walletRow(id, { name: "Device1", updated_at: "2026-11-09T11:00:00.000Z" }), base_version: 1, client_updated_at: "2026-11-09T11:00:00.000Z" }] });
    // Stale and older → conflict, server row returned.
    const stale = (await rpc(USER_A, "soqqa_sync_push", { ops: [{ op_id: "cccccccc-0000-4000-8000-000000000003", table: "wallets", row: walletRow(id, { name: "Old", updated_at: "2026-11-09T10:30:00.000Z" }), base_version: 1, client_updated_at: "2026-11-09T10:30:00.000Z" }] })) as { status: string; row: { name: string } }[];
    expect(stale[0].status).toBe("conflict");
    expect(stale[0].row.name).toBe("Device1");
    // Stale but newer → applied_lww with the overwritten row.
    const lww = (await rpc(USER_A, "soqqa_sync_push", { ops: [{ op_id: "cccccccc-0000-4000-8000-000000000004", table: "wallets", row: walletRow(id, { name: "Newest", updated_at: "2026-11-09T12:00:00.000Z" }), base_version: 1, client_updated_at: "2026-11-09T12:00:00.000Z" }] })) as { status: string; version: number; row: { name: string } }[];
    expect(lww[0]).toMatchObject({ status: "applied_lww", version: 3 });
    expect(lww[0].row.name).toBe("Device1");
  });

  it("rejects invalid rows without aborting the batch", async () => {
    const res = (await rpc(USER_A, "soqqa_sync_push", {
      ops: [
        { op_id: "dddddddd-0000-4000-8000-000000000001", table: "wallets", row: walletRow("aaaaaaaa-0000-4000-8000-000000000003", { currency: "BTC" }), base_version: 0, client_updated_at: "2026-11-09T08:00:00.000Z" },
        { op_id: "dddddddd-0000-4000-8000-000000000002", table: "profiles", row: { id: USER_A }, base_version: 0, client_updated_at: "2026-11-09T08:00:00.000Z" },
        { op_id: "dddddddd-0000-4000-8000-000000000003", table: "wallets", row: walletRow("aaaaaaaa-0000-4000-8000-000000000004"), base_version: 0, client_updated_at: "2026-11-09T08:00:00.000Z" },
      ],
    })) as { status: string }[];
    expect(res.map((r) => r.status)).toEqual(["rejected", "rejected", "applied"]);
  });

  it("keeps exchange-rate snapshots immutable", async () => {
    const id = "eeeeeeee-0000-4000-8000-000000000001";
    const rateRow = { id, created_at: "2026-11-09T08:00:00.000Z", updated_at: "2026-11-09T08:00:00.000Z", deleted_at: null, version: 0, currency: "USD", uzs_per_unit: "12650.45", effective_date: "2026-11-09", source: "manual" };
    await rpc(USER_A, "soqqa_sync_push", { ops: [{ op_id: "eeeeeeee-1000-4000-8000-000000000001", table: "exchange_rates", row: rateRow, base_version: 0, client_updated_at: rateRow.updated_at }] });
    const res = (await rpc(USER_A, "soqqa_sync_push", { ops: [{ op_id: "eeeeeeee-1000-4000-8000-000000000002", table: "exchange_rates", row: { ...rateRow, uzs_per_unit: "1" }, base_version: 1, client_updated_at: "2026-11-09T09:00:00.000Z" }] })) as { status: string; error: string }[];
    expect(res[0].status).toBe("rejected");
    expect(res[0].error).toContain("rates_immutable");
  });

  it("enforces transfer integrity in the database", async () => {
    const res = (await rpc(USER_A, "soqqa_sync_push", {
      ops: [{
        op_id: "ffffffff-0000-4000-8000-000000000001", table: "transactions", base_version: 0, client_updated_at: "2026-11-09T08:00:00.000Z",
        row: {
          id: "ffffffff-1000-4000-8000-000000000001", created_at: "2026-11-09T08:00:00.000Z", updated_at: "2026-11-09T08:00:00.000Z", deleted_at: null, version: 0,
          type: "transfer", direction: "out", wallet_id: "aaaaaaaa-0000-4000-8000-000000000001", amount: "100.00", currency: "UZS", category_id: null,
          occurred_at: "2026-11-09T08:00:00.000Z", local_date: "2026-11-09", note: "", merchant: "", base_currency: "UZS", rate_to_base: "1", base_amount: "100.00",
          rate_snapshot_id: null, to_wallet_id: null, to_amount: null, to_currency: null, transfer_rate: null, related_id: null, source: "manual",
        },
      }],
    })) as { status: string }[];
    expect(res[0].status).toBe("rejected");
  });

  it("end-to-end: the client engine syncs two devices through Postgres", async () => {
    const transport = rpcTransport((fn, args) => rpc(USER_A, fn, args));
    let t = Date.parse("2026-11-09T12:00:00Z");
    const mk = async (name: string) => {
      const db = new SoqqaDB("personal", name);
      const repo = new Repo(db, { now: () => new Date((t += 1000)) });
      await repo.ensureSeeded();
      return { db, repo, engine: new SyncEngine(db, transport, { now: () => t, isOnline: () => true }) };
    };
    const d1 = await mk("pg_e2e_1");
    const d2 = await mk("pg_e2e_2");
    const rateRow = await d1.repo.addRate({ currency: "USD", uzs_per_unit: "12650.45", effective_date: "2026-11-01", source: "manual" });
    const card = await d1.repo.saveWallet({ name: "Karta", currency: "UZS", icon: "credit-card", color: "#3B82F6", opening_balance: "2000000", spendable: true });
    const usd = await d1.repo.saveWallet({ name: "USD", currency: "USD", icon: "piggy-bank", color: "#10B981", opening_balance: "0", spendable: false });
    await d1.repo.saveTransaction({ type: "expense", wallet_id: card.id, amount: "45000", category_id: systemCategoryId(0), local_date: "2026-11-09" });
    const tr = await d1.repo.saveTransaction({ type: "transfer", wallet_id: card.id, to_wallet_id: usd.id, amount: "1265045", to_amount: "100", local_date: "2026-11-09" });
    await d1.engine.sync();
    expect(d1.engine.getStatus()).toMatchObject({ state: "synced", pending: 0, failed: 0 });
    await d2.engine.sync();
    const got = await d2.db.transactions.get(tr.id);
    expect(got).toMatchObject({ amount: "1265045.00", to_amount: "100.00", transfer_rate: tr.transfer_rate, local_date: "2026-11-09" });
    expect((await d2.db.exchange_rates.get(rateRow.id))!.uzs_per_unit).toBe("12650.45");
    for (const d of [d1, d2]) {
      d.db.close();
      await d.db.delete();
    }
  });
});
