/**
 * Domain model shared by the local database, the sync protocol and the
 * Postgres schema (supabase/migrations). Field names are snake_case so a row
 * can be sent to the server verbatim.
 */

export const CURRENCIES = ["UZS", "USD", "EUR", "RUB"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** ISO date in the user's timezone, e.g. "2026-11-09". */
export type LocalDate = string;
/** ISO-8601 instant in UTC. */
export type Instant = string;
/** Canonical decimal string, e.g. "45000.00". */
export type AmountString = string;
/** Decimal rate string, e.g. "12650.45". */
export type RateString = string;

export interface SyncFields {
  id: string;
  created_at: Instant;
  /** Client clock time of the last local modification (used for last-writer-wins). */
  updated_at: Instant;
  /** Soft-deletion marker. Records are never hard-deleted by the app. */
  deleted_at: Instant | null;
  /** Server version this local copy is based on; 0 = never acknowledged by the server. */
  version: number;
}

export type EntityTable =
  | "wallets"
  | "categories"
  | "transactions"
  | "budgets"
  | "goals"
  | "goal_contributions"
  | "exchange_rates"
  | "recurring"
  | "preferences"
  | "strategy_plans"
  | "day_reviews"
  | "achievements";

export const ENTITY_TABLES: readonly EntityTable[] = [
  "wallets",
  "categories",
  "transactions",
  "budgets",
  "goals",
  "goal_contributions",
  "exchange_rates",
  "recurring",
  "preferences",
  "strategy_plans",
  "day_reviews",
  "achievements",
];

export interface Wallet extends SyncFields {
  name: string;
  currency: Currency;
  icon: string;
  color: string;
  opening_balance: AmountString;
  /** Counted as immediately spendable money for safe-to-spend. */
  spendable: boolean;
  archived: boolean;
  sort: number;
}

export type CategoryKind = "income" | "expense";
/** 50/30/20 bucket for expense categories. */
export type CategoryBucket = "needs" | "wants";

export interface Category extends SyncFields {
  kind: CategoryKind;
  /** Stable key for built-in categories (translated in the UI); null for custom ones. */
  system_key: string | null;
  name: string;
  icon: string;
  color: string;
  bucket: CategoryBucket | null;
  archived: boolean;
  sort: number;
}

export type TransactionType = "income" | "expense" | "transfer" | "refund" | "reversal";
export type Direction = "in" | "out";

export interface Transaction extends SyncFields {
  type: TransactionType;
  /** For non-transfers: effect on the wallet. Transfers are always "out" from wallet_id. */
  direction: Direction;
  wallet_id: string;
  amount: AmountString; // always positive, in `currency`
  currency: Currency; // equals the wallet currency at creation
  category_id: string | null;
  occurred_at: Instant;
  local_date: LocalDate;
  note: string;
  merchant: string;
  /** Immutable snapshot: base currency at creation and the rate used. */
  base_currency: Currency;
  rate_to_base: RateString;
  base_amount: AmountString;
  rate_snapshot_id: string | null;
  /** Transfer destination. */
  to_wallet_id: string | null;
  to_amount: AmountString | null;
  to_currency: Currency | null;
  transfer_rate: RateString | null;
  /** Refunds and reversals reference the original transaction. */
  related_id: string | null;
  source: "manual" | "ai" | "recurring" | "demo";
}

export interface Budget extends SyncFields {
  category_id: string;
  /** Monthly limit in the base currency recorded in `currency`. */
  amount: AmountString;
  currency: Currency;
  alert_threshold: number; // 0..1
}

export type GoalStatus = "active" | "paused" | "completed" | "archived";

export interface Goal extends SyncFields {
  name: string;
  target_amount: AmountString;
  currency: Currency;
  target_date: LocalDate | null;
  monthly_target: AmountString | null;
  icon: string;
  color: string;
  status: GoalStatus;
}

export interface GoalContribution extends SyncFields {
  goal_id: string;
  kind: "contribution" | "withdrawal";
  amount: AmountString; // goal currency, positive
  /** Optional source/destination wallet. When set, the wallet balance moves accordingly. */
  wallet_id: string | null;
  wallet_amount: AmountString | null; // wallet currency, positive
  rate: RateString | null; // goal currency → wallet currency
  local_date: LocalDate;
  note: string;
}

export interface ExchangeRate extends SyncFields {
  /** Rates are pivoted on UZS: 1 unit of `currency` = `uzs_per_unit` UZS. Rows are immutable. */
  currency: Exclude<Currency, "UZS">;
  uzs_per_unit: RateString;
  effective_date: LocalDate;
  source: "manual" | "cbu" | "seed";
}

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export interface Recurring extends SyncFields {
  name: string;
  type: "income" | "expense";
  amount: AmountString;
  currency: Currency;
  wallet_id: string;
  category_id: string | null;
  frequency: RecurringFrequency;
  /** Day anchor: the first occurrence date. */
  start_date: LocalDate;
  next_date: LocalDate;
  active: boolean;
}

export type Locale = "uz" | "en" | "ru";
export type ThemePref = "dark" | "light" | "system";

/** Which in-app notifications the user wants, and their thresholds. */
export interface NotificationSettings {
  budget: boolean;
  reminders: boolean;
  achievements: boolean;
  insights: boolean;
  /** Also show a system notification (browser permission required). */
  system: boolean;
  /** Local hour after which a "nothing recorded today" reminder may appear. */
  reminder_hour: number;
  /** Month-to-date category growth (vs. same days last month) that triggers a warning, 0.1–1. */
  category_change: number;
  /** One-tap categories pinned by the user (category ids); empty = learn from history. */
  quick_categories: string[];
}

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  budget: true,
  reminders: true,
  achievements: true,
  insights: true,
  system: false,
  reminder_hour: 20,
  category_change: 0.25,
  quick_categories: [],
};

export interface Preferences extends SyncFields {
  base_currency: Currency;
  locale: Locale;
  timezone: string;
  theme: ThemePref;
  ai_cloud_enabled: boolean;
  onboarded: boolean;
  /** Added in schema v2; may be missing on older rows — read through notificationSettings(). */
  notification_settings?: Partial<NotificationSettings>;
}

export function notificationSettings(p: Pick<Preferences, "notification_settings">): NotificationSettings {
  return { ...DEFAULT_NOTIFICATIONS, ...(p.notification_settings ?? {}) };
}

export type StrategySlug =
  | "pay-yourself-first"
  | "rule-50-30-20"
  | "zero-based"
  | "envelopes"
  | "kakeibo"
  | "profit-first"
  | "sinking-funds"
  | "emergency-fund"
  | "debt-payoff"
  | "lifestyle-inflation";

export type StrategyStatus = "active" | "paused" | "archived";

/** A user's adoption of a financial strategy. Content is static; only this row is personal. */
export interface StrategyPlan extends SyncFields {
  strategy: StrategySlug;
  status: StrategyStatus;
  selected_at: Instant;
  /** Strategy-specific settings (percentages, debts, reflections…), validated per strategy. */
  configuration: Record<string, unknown>;
}

export type DayReviewStatus = "no_spending" | "complete" | "needs_review";

/** The user's answer to "did you forget something?" for one day. */
export interface DayReview extends SyncFields {
  local_date: LocalDate;
  status: DayReviewStatus;
}

/** An unlocked badge. The id is derived from the key, so a badge exists at most once per user. */
export interface Achievement extends SyncFields {
  key: string;
  unlocked_at: Instant;
}

export interface EntityMap {
  wallets: Wallet;
  categories: Category;
  transactions: Transaction;
  budgets: Budget;
  goals: Goal;
  goal_contributions: GoalContribution;
  exchange_rates: ExchangeRate;
  recurring: Recurring;
  preferences: Preferences;
  strategy_plans: StrategyPlan;
  day_reviews: DayReview;
  achievements: Achievement;
}

export type AnyEntity = EntityMap[EntityTable];

/** In-memory snapshot of all live (non-deleted) records used by the engines. */
export interface Ledger {
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  contributions: GoalContribution[];
  rates: ExchangeRate[];
  recurring: Recurring[];
}
