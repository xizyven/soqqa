/**
 * Zod schemas for every user input. Shared by the client (forms, repository)
 * and server route handlers. The Postgres schema enforces the same constraints.
 */
import { z } from "zod";
import { isValidLocalDate } from "../domain/dates";
import { isValidRate, tryParseAmount } from "../money/money";
import { CURRENCIES } from "../domain/types";

export const currencySchema = z.enum(CURRENCIES);
export const localDateSchema = z.string().refine(isValidLocalDate, "invalid_date");
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "invalid_color");
const MAX = 10n ** 15n; // 10 trillion in cents

export const amountSchema = z
  .string()
  .refine((s) => {
    const c = tryParseAmount(s);
    return c !== null && c > 0n && c < MAX;
  }, "invalid_amount");

export const signedAmountSchema = z.string().refine((s) => {
  const c = tryParseAmount(s);
  return c !== null && c > -MAX && c < MAX;
}, "invalid_amount");

export const rateSchema = z.string().refine(isValidRate, "invalid_rate");

export const walletInputSchema = z.object({
  name: z.string().trim().min(1, "required").max(60),
  currency: currencySchema,
  icon: z.string().min(1).max(40),
  color: hexColor,
  opening_balance: signedAmountSchema,
  spendable: z.boolean(),
});
export type WalletInput = z.infer<typeof walletInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "required").max(40),
  kind: z.enum(["income", "expense"]),
  icon: z.string().min(1).max(40),
  color: hexColor,
  bucket: z.enum(["needs", "wants"]).nullable(),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const transactionDraftSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer", "refund", "reversal"]),
    wallet_id: z.string().min(1, "wallet_required"),
    amount: amountSchema,
    category_id: z.string().nullable().optional(),
    local_date: localDateSchema,
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    note: z.string().max(500).optional(),
    merchant: z.string().max(120).optional(),
    to_wallet_id: z.string().nullable().optional(),
    to_amount: amountSchema.nullable().optional(),
    related_id: z.string().nullable().optional(),
    source: z.enum(["manual", "ai", "recurring", "demo"]).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "transfer" && !d.to_wallet_id) ctx.addIssue({ code: "custom", path: ["to_wallet_id"], message: "wallet_required" });
    if ((d.type === "income" || d.type === "expense") && !d.category_id)
      ctx.addIssue({ code: "custom", path: ["category_id"], message: "category_required" });
  });

export const budgetInputSchema = z.object({
  category_id: z.string().min(1),
  amount: amountSchema,
  currency: currencySchema,
  alert_threshold: z.number().min(0.1).max(1),
});
export type BudgetInput = z.infer<typeof budgetInputSchema>;

export const goalInputSchema = z.object({
  name: z.string().trim().min(1, "required").max(60),
  target_amount: amountSchema,
  currency: currencySchema,
  target_date: localDateSchema.nullable(),
  monthly_target: amountSchema.nullable(),
  icon: z.string().min(1).max(40),
  color: hexColor,
  status: z.enum(["active", "paused", "completed", "archived"]),
});
export type GoalInput = z.infer<typeof goalInputSchema>;

export const contributionInputSchema = z.object({
  goal_id: z.string().min(1),
  kind: z.enum(["contribution", "withdrawal"]),
  amount: amountSchema,
  wallet_id: z.string().nullable(),
  wallet_amount: amountSchema.nullable().optional(),
  local_date: localDateSchema,
  note: z.string().max(200).optional(),
});
export type ContributionInput = z.infer<typeof contributionInputSchema>;

export const rateInputSchema = z.object({
  currency: z.enum(["USD", "EUR", "RUB"]),
  uzs_per_unit: rateSchema,
  effective_date: localDateSchema,
  source: z.enum(["manual", "cbu", "seed"]),
});
export type RateInput = z.infer<typeof rateInputSchema>;

export const recurringInputSchema = z.object({
  name: z.string().trim().min(1, "required").max(60),
  type: z.enum(["income", "expense"]),
  amount: amountSchema,
  wallet_id: z.string().min(1),
  category_id: z.string().nullable(),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  start_date: localDateSchema,
  active: z.boolean(),
});
export type RecurringInput = z.infer<typeof recurringInputSchema>;

export const notificationSettingsSchema = z.object({
  budget: z.boolean(),
  reminders: z.boolean(),
  achievements: z.boolean(),
  insights: z.boolean(),
  system: z.boolean(),
  reminder_hour: z.number().int().min(0).max(23),
  category_change: z.number().min(0.1).max(1),
  quick_categories: z.array(z.string().min(1).max(64)).max(12),
});

export const preferencesInputSchema = z.object({
  base_currency: currencySchema,
  locale: z.enum(["uz", "en", "ru"]),
  timezone: z.string().min(1).max(64),
  theme: z.enum(["dark", "light", "system"]),
  ai_cloud_enabled: z.boolean(),
  onboarded: z.boolean(),
  notification_settings: notificationSettingsSchema.partial().optional(),
});

export const STRATEGY_SLUGS = [
  "pay-yourself-first",
  "rule-50-30-20",
  "zero-based",
  "envelopes",
  "kakeibo",
  "profit-first",
  "sinking-funds",
  "emergency-fund",
  "debt-payoff",
  "lifestyle-inflation",
] as const;

export const strategyPlanInputSchema = z.object({
  strategy: z.enum(STRATEGY_SLUGS),
  status: z.enum(["active", "paused", "archived"]),
  configuration: z.record(z.string(), z.unknown()).refine((c) => JSON.stringify(c).length <= 16_000, "too_large"),
});
export type StrategyPlanInput = z.infer<typeof strategyPlanInputSchema>;

export const dayReviewInputSchema = z.object({
  local_date: localDateSchema,
  status: z.enum(["no_spending", "complete", "needs_review"]),
});
export type DayReviewInput = z.infer<typeof dayReviewInputSchema>;
export type PreferencesInput = z.infer<typeof preferencesInputSchema>;

/** First issue message per field path, for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
