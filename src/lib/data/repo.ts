/**
 * Repository: the only module that writes domain records. Every write updates
 * the entity and appends its sync-outbox operation inside ONE IndexedDB
 * transaction, so local state and the queue can never diverge.
 */
import { SYSTEM_CATEGORIES } from "../domain/defaults";
import { DEFAULT_TIMEZONE, todayLocal } from "../domain/dates";
import { advanceRecurring } from "../domain/planning";
import { RateBook } from "../domain/rates";
import { buildTransaction, refundableAmount, TransactionError, type TransactionDraft } from "../domain/transactions";
import { goalSaved } from "../domain/ledger";
import type {
  AnyEntity,
  Budget,
  Category,
  EntityTable,
  ExchangeRate,
  Goal,
  GoalContribution,
  Ledger,
  Preferences,
  Recurring,
  SyncFields,
  Transaction,
  Wallet,
  Achievement,
  DayReview,
  StrategyPlan,
} from "../domain/types";
import { applyRate, parseAmount, ratio, toAmountString } from "../money/money";
import {
  budgetInputSchema,
  categoryInputSchema,
  contributionInputSchema,
  goalInputSchema,
  preferencesInputSchema,
  rateInputSchema,
  recurringInputSchema,
  transactionDraftSchema,
  walletInputSchema,
  strategyPlanInputSchema,
  dayReviewInputSchema,
  type StrategyPlanInput,
  type DayReviewInput,
  type BudgetInput,
  type CategoryInput,
  type ContributionInput,
  type GoalInput,
  type PreferencesInput,
  type RateInput,
  type RecurringInput,
  type WalletInput,
} from "../validation/schemas";
import type { OutboxOp, SoqqaDB } from "./db";

export const PREFS_ID = "00000000-0000-4000-8000-00000000f000";

/** Deterministic ids for built-in categories so devices of one user converge. */
export function systemCategoryId(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

/** One review row per date: the id is derived from the date (hex digits only, valid UUID). */
export function dayReviewId(date: string): string {
  return `00000000-0000-4000-9000-0000${date.replace(/-/g, "")}`;
}

/** One achievement row per badge key: 48-bit FNV-1a of the key as the UUID tail. */
export function achievementId(key: string): string {
  let h = 0xcbf29ce484222325n;
  for (const ch of key) {
    h ^= BigInt(ch.codePointAt(0)!);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `00000000-0000-4000-a000-${(h & 0xffffffffffffn).toString(16).padStart(12, "0")}`;
}

export interface UserExtras {
  plans: StrategyPlan[];
  reviews: DayReview[];
  achievements: Achievement[];
}

export interface RepoOptions {
  now?: () => Date;
  newId?: () => string;
}

export class ValidationError extends Error {
  constructor(public issues: Record<string, string>) {
    super("validation_failed");
  }
}

export function defaultPreferences(now: string): Preferences {
  return {
    id: PREFS_ID,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 0,
    base_currency: "UZS",
    locale: "uz",
    timezone: DEFAULT_TIMEZONE,
    theme: "dark",
    ai_cloud_enabled: false,
    onboarded: false,
  };
}

export class Repo {
  private now: () => Date;
  private newId: () => string;
  /** Demo databases never enqueue sync operations. */
  private readonly track: boolean;

  constructor(public readonly db: SoqqaDB, opts: RepoOptions = {}) {
    this.now = opts.now ?? (() => new Date());
    this.newId = opts.newId ?? (() => crypto.randomUUID());
    this.track = db.kind === "personal";
  }

  // ------------------------------------------------------------------ infra

  /** Writes an entity and its outbox op atomically. */
  private async write<T extends AnyEntity>(table: EntityTable, row: T): Promise<T> {
    await this.writeMany([[table, row]]);
    return row;
  }

  /** Writes several entities and their outbox ops in one IndexedDB transaction. */
  private async writeMany(entries: [EntityTable, AnyEntity][]): Promise<void> {
    const tables = [...new Set(entries.map(([t]) => t))].map((t) => this.db.entityTable(t));
    await this.db.transaction("rw", [...tables, this.db.outbox], async () => {
      for (const [table, row] of entries) {
        await this.db.entityTable(table).put(row as unknown as Record<string, unknown> & { id: string });
        if (this.track) await this.enqueue(table, row);
      }
    });
  }

  private async enqueue(table: EntityTable, row: AnyEntity): Promise<void> {
    // Coalesce with a not-yet-sent op for the same entity. Ops that were already
    // attempted keep their idempotency key and payload untouched.
    const pending = await this.db.outbox.where("entity_id").equals(row.id).toArray();
    const unsent = pending.find((o) => o.table === table && o.attempts === 0 && o.status === "pending");
    if (unsent) {
      await this.db.outbox.update(unsent.op_id, { row: { ...row }, client_updated_at: row.updated_at });
      return;
    }
    const op: OutboxOp = {
      op_id: this.newId(),
      table,
      entity_id: row.id,
      row: { ...row },
      base_version: row.version,
      client_updated_at: row.updated_at,
      created_at: this.now().toISOString(),
      attempts: 0,
      next_attempt_at: 0,
      status: "pending",
      last_error: null,
    };
    await this.db.outbox.put(op);
  }

  private stamp(existing?: SyncFields): SyncFields {
    const now = this.now().toISOString();
    return {
      id: existing?.id ?? this.newId(),
      created_at: existing?.created_at ?? now,
      updated_at: now,
      deleted_at: existing?.deleted_at ?? null,
      version: existing?.version ?? 0,
    };
  }

  private validate<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown): T {
    const r = schema.safeParse(input);
    if (!r.success) {
      const issues: Record<string, string> = {};
      for (const i of r.error.issues) {
        const k = i.path.map(String).join(".") || "_";
        if (!issues[k]) issues[k] = i.message;
      }
      throw new ValidationError(issues);
    }
    return r.data;
  }

  async softDelete(table: EntityTable, id: string): Promise<void> {
    const t = this.db.entityTable(table);
    const existing = (await t.get(id)) as unknown as AnyEntity | undefined;
    if (!existing || existing.deleted_at) return;
    const now = this.now().toISOString();
    await this.write(table, { ...existing, deleted_at: now, updated_at: now } as AnyEntity);
  }

  async restore(table: EntityTable, id: string): Promise<void> {
    const t = this.db.entityTable(table);
    const existing = (await t.get(id)) as unknown as AnyEntity | undefined;
    if (!existing || !existing.deleted_at) return;
    await this.write(table, { ...existing, deleted_at: null, updated_at: this.now().toISOString() } as AnyEntity);
  }

  // ------------------------------------------------------------------ bootstrap

  /** Seeds built-in categories and default preferences (not enqueued: identical on every device). */
  async ensureSeeded(): Promise<void> {
    const now = this.now().toISOString();
    await this.db.transaction("rw", [this.db.categories, this.db.preferences], async () => {
      const count = await this.db.categories.count();
      if (count === 0) {
        await this.db.categories.bulkPut(
          SYSTEM_CATEGORIES.map((c, i) => ({
            id: systemCategoryId(i),
            created_at: now,
            updated_at: "1970-01-01T00:00:00.000Z",
            deleted_at: null,
            version: 0,
            kind: c.kind,
            system_key: c.key,
            name: "",
            icon: c.icon,
            color: c.color,
            bucket: c.bucket,
            archived: false,
            sort: i,
          })),
        );
      }
      if (!(await this.db.preferences.get(PREFS_ID))) await this.db.preferences.put(defaultPreferences(now));
    });
  }

  async loadLedger(includeDeleted = false): Promise<Ledger> {
    const live = <T extends { deleted_at: string | null }>(xs: T[]) => (includeDeleted ? xs : xs.filter((x) => !x.deleted_at));
    const [wallets, categories, transactions, budgets, goals, contributions, rates, recurring] = await Promise.all([
      this.db.wallets.toArray(),
      this.db.categories.toArray(),
      this.db.transactions.toArray(),
      this.db.budgets.toArray(),
      this.db.goals.toArray(),
      this.db.goal_contributions.toArray(),
      this.db.exchange_rates.toArray(),
      this.db.recurring.toArray(),
    ]);
    return {
      wallets: live(wallets),
      categories: live(categories),
      transactions: live(transactions),
      budgets: live(budgets),
      goals: live(goals),
      contributions: live(contributions),
      rates: live(rates),
      recurring: live(recurring),
    };
  }

  async loadExtras(): Promise<UserExtras> {
    const [plans, reviews, achievements] = await Promise.all([this.db.strategy_plans.toArray(), this.db.day_reviews.toArray(), this.db.achievements.toArray()]);
    return {
      plans: plans.filter((x) => !x.deleted_at),
      reviews: reviews.filter((x) => !x.deleted_at),
      achievements: achievements.filter((x) => !x.deleted_at),
    };
  }

  // ------------------------------------------------------------------ strategies

  /** Creates or updates the user's plan for a strategy (one live plan per strategy). */
  async saveStrategyPlan(input: StrategyPlanInput): Promise<StrategyPlan> {
    const data = this.validate(strategyPlanInputSchema, input);
    const existing = await this.db.strategy_plans.where("strategy").equals(data.strategy).filter((p) => !p.deleted_at).first();
    const stamp = this.stamp(existing);
    return this.write("strategy_plans", {
      ...stamp,
      strategy: data.strategy,
      status: data.status,
      configuration: data.configuration,
      selected_at: existing?.selected_at ?? stamp.updated_at,
    });
  }

  // ------------------------------------------------------------------ day reviews

  /** Records the user's answer to the forgotten-expense prompt for one day. */
  async reviewDay(input: DayReviewInput): Promise<DayReview> {
    const data = this.validate(dayReviewInputSchema, input);
    const id = dayReviewId(data.local_date);
    const existing = await this.db.day_reviews.get(id);
    return this.write("day_reviews", { ...this.stamp(existing), id, local_date: data.local_date, status: data.status, deleted_at: null });
  }

  // ------------------------------------------------------------------ achievements

  /** Persists newly earned badges. Already-unlocked keys are ignored, so rewards never duplicate. */
  async unlockAchievements(keys: string[]): Promise<string[]> {
    const fresh: Achievement[] = [];
    const now = this.now().toISOString();
    for (const key of new Set(keys)) {
      const id = achievementId(key);
      const existing = await this.db.achievements.get(id);
      if (existing && !existing.deleted_at) continue;
      fresh.push({ ...this.stamp(existing), id, key, unlocked_at: now, deleted_at: null });
    }
    if (fresh.length) await this.writeMany(fresh.map((a) => ["achievements", a] as [EntityTable, AnyEntity]));
    return fresh.map((a) => a.key);
  }

  async preferences(): Promise<Preferences> {
    const all = (await this.db.preferences.toArray()).filter((p) => !p.deleted_at);
    if (!all.length) return defaultPreferences(this.now().toISOString());
    return all.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  }

  // ------------------------------------------------------------------ preferences

  async savePreferences(input: Partial<PreferencesInput>): Promise<Preferences> {
    const current = await this.preferences();
    const merged = this.validate(preferencesInputSchema, { ...current, ...input });
    return this.write("preferences", { ...current, ...merged, ...this.stamp(current) });
  }

  // ------------------------------------------------------------------ wallets

  async saveWallet(input: WalletInput, id?: string): Promise<Wallet> {
    const data = this.validate(walletInputSchema, input);
    const existing = id ? await this.db.wallets.get(id) : undefined;
    if (existing && existing.currency !== data.currency) {
      const used = await this.db.transactions.filter((t) => !t.deleted_at && (t.wallet_id === id || t.to_wallet_id === id)).count();
      if (used > 0) throw new ValidationError({ currency: "currency_locked" });
    }
    const sort = existing?.sort ?? (await this.db.wallets.count());
    return this.write("wallets", {
      ...this.stamp(existing),
      ...data,
      opening_balance: toAmountString(parseAmount(data.opening_balance)),
      archived: existing?.archived ?? false,
      sort,
    });
  }

  async setWalletArchived(id: string, archived: boolean): Promise<void> {
    const w = await this.db.wallets.get(id);
    if (!w) return;
    await this.write("wallets", { ...w, ...this.stamp(w), archived });
  }

  // ------------------------------------------------------------------ categories

  async saveCategory(input: CategoryInput, id?: string): Promise<Category> {
    const data = this.validate(categoryInputSchema, input);
    const existing = id ? await this.db.categories.get(id) : undefined;
    const sort = existing?.sort ?? (await this.db.categories.count());
    return this.write("categories", {
      ...this.stamp(existing),
      kind: existing?.kind ?? data.kind,
      system_key: existing?.system_key ?? null,
      name: data.name,
      icon: data.icon,
      color: data.color,
      bucket: (existing?.kind ?? data.kind) === "expense" ? data.bucket ?? "wants" : null,
      archived: existing?.archived ?? false,
      sort,
    });
  }

  async setCategoryArchived(id: string, archived: boolean): Promise<void> {
    const c = await this.db.categories.get(id);
    if (!c) return;
    await this.write("categories", { ...c, ...this.stamp(c), archived });
  }

  // ------------------------------------------------------------------ rates

  /** Adds a new immutable rate snapshot. Existing snapshots are never modified. */
  async addRate(input: RateInput): Promise<ExchangeRate> {
    const data = this.validate(rateInputSchema, input);
    return this.write("exchange_rates", { ...this.stamp(), ...data });
  }

  /** Adds snapshots only where no identical snapshot exists for that date. */
  async addRatesIfNew(inputs: RateInput[]): Promise<number> {
    let added = 0;
    for (const input of inputs) {
      const same = await this.db.exchange_rates
        .where("currency")
        .equals(input.currency)
        .filter((r) => !r.deleted_at && r.effective_date === input.effective_date && r.uzs_per_unit === input.uzs_per_unit)
        .count();
      if (same === 0) {
        await this.addRate(input);
        added++;
      }
    }
    return added;
  }

  // ------------------------------------------------------------------ transactions

  private async buildContext() {
    const [wallets, transactions, rates, prefs] = await Promise.all([
      this.db.wallets.toArray(),
      this.db.transactions.toArray(),
      this.db.exchange_rates.toArray(),
      this.preferences(),
    ]);
    return {
      wallets,
      transactions,
      base: prefs.base_currency,
      book: new RateBook(rates),
      timezone: prefs.timezone,
      now: this.now(),
      newId: this.newId,
    };
  }

  private async prepareTransaction(draft: TransactionDraft, id?: string): Promise<Transaction> {
    const data = this.validate(transactionDraftSchema, draft) as TransactionDraft;
    const ctx = await this.buildContext();
    const existing = id ? ctx.transactions.find((t) => t.id === id) : undefined;
    if (id && !existing) throw new TransactionError("not_found");
    if (existing && existing.type !== data.type && (existing.type === "transfer" || data.type === "transfer" || existing.type === "reversal"))
      throw new TransactionError("type_locked");
    return buildTransaction(data, ctx, existing);
  }

  async saveTransaction(draft: TransactionDraft, id?: string): Promise<Transaction> {
    return this.write("transactions", await this.prepareTransaction(draft, id));
  }

  /** Deleting a transaction also soft-deletes refunds/reversals that point at it. */
  async deleteTransaction(id: string): Promise<void> {
    const dependents = await this.db.transactions.where("related_id").equals(id).filter((t) => !t.deleted_at).toArray();
    for (const d of dependents) await this.softDelete("transactions", d.id);
    await this.softDelete("transactions", id);
  }

  async reverseTransaction(id: string): Promise<Transaction> {
    const original = await this.db.transactions.get(id);
    if (!original || original.deleted_at) throw new TransactionError("not_found");
    const ctx = await this.buildContext();
    const left = refundableAmount(original, ctx.transactions);
    if (left <= 0n) throw new TransactionError("already_reversed");
    return this.saveTransaction({
      type: "reversal",
      wallet_id: original.wallet_id,
      amount: toAmountString(left),
      local_date: todayLocal(ctx.timezone, this.now()),
      related_id: original.id,
      note: original.note,
      merchant: original.merchant,
    });
  }

  // ------------------------------------------------------------------ budgets

  async saveBudget(input: BudgetInput, id?: string): Promise<Budget> {
    const data = this.validate(budgetInputSchema, input);
    const existing = id ? await this.db.budgets.get(id) : (await this.db.budgets.where("category_id").equals(data.category_id).filter((b) => !b.deleted_at).first());
    return this.write("budgets", { ...this.stamp(existing), ...data, amount: toAmountString(parseAmount(data.amount)) });
  }

  // ------------------------------------------------------------------ goals

  async saveGoal(input: GoalInput, id?: string): Promise<Goal> {
    const data = this.validate(goalInputSchema, input);
    const existing = id ? await this.db.goals.get(id) : undefined;
    if (existing && existing.currency !== data.currency) {
      const used = await this.db.goal_contributions.where("goal_id").equals(existing.id).filter((c) => !c.deleted_at).count();
      if (used > 0) throw new ValidationError({ currency: "currency_locked" });
    }
    return this.write("goals", {
      ...this.stamp(existing),
      ...data,
      target_amount: toAmountString(parseAmount(data.target_amount)),
      monthly_target: data.monthly_target ? toAmountString(parseAmount(data.monthly_target)) : null,
    });
  }

  /** Records a contribution or withdrawal. Linked wallets move; nothing counts as income/expense. */
  async addContribution(input: ContributionInput): Promise<GoalContribution> {
    const data = this.validate(contributionInputSchema, input);
    const goal = await this.db.goals.get(data.goal_id);
    if (!goal || goal.deleted_at) throw new ValidationError({ goal_id: "not_found" });
    let wallet_amount: string | null = null;
    let rate: string | null = null;
    if (data.wallet_id) {
      const wallet = await this.db.wallets.get(data.wallet_id);
      if (!wallet || wallet.deleted_at) throw new ValidationError({ wallet_id: "wallet_required" });
      const amount = parseAmount(data.amount);
      let wAmount: bigint;
      if (wallet.currency === goal.currency) wAmount = amount;
      else if (data.wallet_amount) wAmount = parseAmount(data.wallet_amount);
      else {
        const book = new RateBook(await this.db.exchange_rates.toArray());
        wAmount = applyRate(amount, book.resolve(goal.currency, wallet.currency, data.local_date).rate);
      }
      wallet_amount = toAmountString(wAmount);
      rate = ratio(wAmount, amount);
    }
    if (data.kind === "withdrawal") {
      const saved = goalSaved(goal.id, await this.db.goal_contributions.toArray());
      if (parseAmount(data.amount) > saved) throw new ValidationError({ amount: "exceeds_saved" });
    }
    return this.write("goal_contributions", {
      ...this.stamp(),
      goal_id: goal.id,
      kind: data.kind,
      amount: toAmountString(parseAmount(data.amount)),
      wallet_id: data.wallet_id,
      wallet_amount,
      rate,
      local_date: data.local_date,
      note: data.note ?? "",
    });
  }

  // ------------------------------------------------------------------ recurring

  async saveRecurring(input: RecurringInput, id?: string): Promise<Recurring> {
    const data = this.validate(recurringInputSchema, input);
    const wallet = await this.db.wallets.get(data.wallet_id);
    if (!wallet) throw new ValidationError({ wallet_id: "wallet_required" });
    const existing = id ? await this.db.recurring.get(id) : undefined;
    const startChanged = !existing || existing.start_date !== data.start_date || existing.frequency !== data.frequency;
    return this.write("recurring", {
      ...this.stamp(existing),
      ...data,
      amount: toAmountString(parseAmount(data.amount)),
      currency: wallet.currency,
      next_date: startChanged ? data.start_date : existing!.next_date,
    });
  }

  /** Posts the next occurrence as a real transaction (after user confirmation) and advances the schedule. */
  async postRecurring(id: string): Promise<Transaction> {
    const r = await this.db.recurring.get(id);
    if (!r || r.deleted_at) throw new TransactionError("not_found");
    const tx = await this.prepareTransaction({
      type: r.type,
      wallet_id: r.wallet_id,
      amount: r.amount,
      category_id: r.category_id,
      local_date: r.next_date,
      note: r.name,
      source: "recurring",
    });
    // Posting and advancing the schedule happen atomically: no double posting.
    await this.writeMany([
      ["transactions", tx],
      ["recurring", { ...r, ...this.stamp(r), next_date: advanceRecurring(r, r.next_date) }],
    ]);
    return tx;
  }

  async skipRecurring(id: string): Promise<void> {
    const r = await this.db.recurring.get(id);
    if (!r) return;
    await this.write("recurring", { ...r, ...this.stamp(r), next_date: advanceRecurring(r, r.next_date) });
  }

  // ------------------------------------------------------------------ sync maintenance

  /** Restores a version kept in the conflict log as the current local version (and syncs it). */
  async restoreConflictVersion(conflictId: string): Promise<void> {
    const c = await this.db.conflicts.get(conflictId);
    if (!c) return;
    const t = this.db.entityTable(c.table);
    const current = (await t.get(c.entity_id)) as unknown as AnyEntity | undefined;
    const now = this.now().toISOString();
    const row = { ...(c.discarded as unknown as AnyEntity), version: current?.version ?? 0, updated_at: now } as AnyEntity;
    await this.writeMany([[c.table, row]]);
    await this.db.conflicts.update(conflictId, { dismissed: true });
  }

  async dismissConflict(conflictId: string): Promise<void> {
    await this.db.conflicts.update(conflictId, { dismissed: true });
  }

  /** Re-queues operations the server rejected (they are never dropped automatically). */
  async retryFailedOps(): Promise<number> {
    const failed = await this.db.outbox.where("status").equals("failed").toArray();
    await this.db.transaction("rw", this.db.outbox, async () => {
      for (const op of failed) await this.db.outbox.update(op.op_id, { status: "pending", next_attempt_at: 0, last_error: null });
    });
    return failed.length;
  }

  // ------------------------------------------------------------------ reset

  async wipe(): Promise<void> {
    await this.db.transaction("rw", this.db.tables, async () => {
      for (const t of this.db.tables) await t.clear();
    });
  }
}
