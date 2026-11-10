/**
 * Local persistence (IndexedDB via Dexie). The local database is the source of
 * truth for the UI; the cloud is a replica reached through the sync outbox.
 *
 * Two physical databases exist:
 *   - "soqqa_personal": the user's real data (synced when signed in)
 *   - "soqqa_demo":     demonstration data, never synced, never mixed
 */
import Dexie, { type Table } from "dexie";
import type {
  Budget,
  Category,
  EntityTable,
  ExchangeRate,
  Goal,
  GoalContribution,
  Preferences,
  Recurring,
  Achievement,
  DayReview,
  StrategyPlan,
  Transaction,
  Wallet,
} from "../domain/types";

export interface OutboxOp {
  /** Idempotency key: the server applies each op_id at most once. */
  op_id: string;
  table: EntityTable;
  entity_id: string;
  /** Full row snapshot (soft deletes are upserts with deleted_at set). */
  row: Record<string, unknown>;
  base_version: number;
  client_updated_at: string;
  created_at: string;
  attempts: number;
  next_attempt_at: number;
  status: "pending" | "failed";
  last_error: string | null;
}

export interface ConflictRecord {
  id: string;
  table: EntityTable;
  entity_id: string;
  /** The version that lost. */
  discarded: Record<string, unknown>;
  /** The version that is now current. */
  kept: Record<string, unknown>;
  resolution: "server_won" | "client_won";
  created_at: string;
  dismissed: boolean;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export type DbKind = "personal" | "demo";

export class SoqqaDB extends Dexie {
  wallets!: Table<Wallet, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  goals!: Table<Goal, string>;
  goal_contributions!: Table<GoalContribution, string>;
  exchange_rates!: Table<ExchangeRate, string>;
  recurring!: Table<Recurring, string>;
  preferences!: Table<Preferences, string>;
  strategy_plans!: Table<StrategyPlan, string>;
  day_reviews!: Table<DayReview, string>;
  achievements!: Table<Achievement, string>;
  outbox!: Table<OutboxOp, string>;
  conflicts!: Table<ConflictRecord, string>;
  meta!: Table<MetaRow, string>;

  constructor(public readonly kind: DbKind, name = kind === "demo" ? "soqqa_demo" : "soqqa_personal") {
    super(name);
    this.version(1).stores({
      wallets: "id, updated_at",
      categories: "id, kind, system_key",
      transactions: "id, local_date, wallet_id, to_wallet_id, category_id, related_id, type, updated_at",
      budgets: "id, category_id",
      goals: "id",
      goal_contributions: "id, goal_id, wallet_id, local_date",
      exchange_rates: "id, currency, effective_date",
      recurring: "id, next_date",
      preferences: "id",
      outbox: "op_id, created_at, status, entity_id",
      conflicts: "id, created_at",
      meta: "key",
    });
    // v2: strategies, day reviews (forgotten-expense answers) and achievements.
    this.version(2).stores({
      strategy_plans: "id, strategy",
      day_reviews: "id, local_date",
      achievements: "id, key",
    });
  }

  entityTable(name: EntityTable): Table<Record<string, unknown> & { id: string }, string> {
    return this.table(name) as unknown as Table<Record<string, unknown> & { id: string }, string>;
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.meta.get(key))?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.meta.put({ key, value });
  }
}
