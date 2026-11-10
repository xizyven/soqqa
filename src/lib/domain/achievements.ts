/**
 * Achievements reward consistent, responsible money habits — recording,
 * reviewing, planning and keeping one's own limits — never spending less for
 * its own sake. Progress is derived from records; unlocks are persisted once
 * (see Repo.unlockAchievements) so a badge can never be awarded twice.
 */
import { budgetStatuses, makeContext, monthlySeries } from "./analytics";
import { indexActivity, streaks } from "./activity";
import { monthKey, shiftMonthKey } from "./dates";
import { goalProgress } from "./planning";
import type { Achievement, Currency, DayReview, Ledger, LocalDate } from "./types";

export type BadgeKey =
  | "first_tx"
  | "tx_10"
  | "streak_7"
  | "streak_30"
  | "consistent_tracker"
  | "spending_awareness"
  | "budget_master"
  | "savings_milestone"
  | "financial_discipline";

export type BadgeTier = "bronze" | "silver" | "gold";

export interface BadgeDef {
  key: BadgeKey;
  tier: BadgeTier;
  /** lucide icon name rendered inside the khatam medallion. */
  icon: string;
}

export const BADGES: BadgeDef[] = [
  { key: "first_tx", tier: "bronze", icon: "feather" },
  { key: "tx_10", tier: "bronze", icon: "list-checks" },
  { key: "streak_7", tier: "silver", icon: "flame" },
  { key: "streak_30", tier: "gold", icon: "flame" },
  { key: "consistent_tracker", tier: "gold", icon: "calendar-check" },
  { key: "spending_awareness", tier: "silver", icon: "eye" },
  { key: "budget_master", tier: "gold", icon: "shield-check" },
  { key: "savings_milestone", tier: "silver", icon: "piggy-bank" },
  { key: "financial_discipline", tier: "gold", icon: "scale" },
];

export interface BadgeStatus extends BadgeDef {
  current: number;
  target: number;
  /** Earned according to the current records. */
  earned: boolean;
  /** Persisted unlock (earned at some point), with its date. */
  unlockedAt: string | null;
}

export function evaluateBadges(ledger: Ledger, base: Currency, today: LocalDate, reviews: readonly DayReview[], unlocked: readonly Achievement[]): BadgeStatus[] {
  const txCount = ledger.transactions.filter((t) => !t.deleted_at).length;
  const ix = indexActivity(ledger.transactions, reviews);
  const st = streaks(ix, today);
  const ctx = makeContext(ledger, base);
  const month = monthKey(today);

  // Budget master: a completed month in which ≥3 budgets all stayed within limit.
  let budgetMaster = 0;
  if (ledger.budgets.length >= 3) {
    for (let i = 1; i <= 6 && !budgetMaster; i++) {
      const s = budgetStatuses(ctx, shiftMonthKey(month, -i));
      if (s.length >= 3 && s.every((b) => b.spent <= b.limit) && s.some((b) => b.spent > 0n)) budgetMaster = 1;
    }
  }

  // Savings milestone: any goal at least half way (or completed).
  const bestGoal = ledger.goals.filter((g) => g.status !== "archived").reduce((mx, g) => Math.max(mx, goalProgress(g, ledger.contributions, today).progress), 0);

  // Financial discipline: three consecutive completed months with income > spending.
  const series = monthlySeries(ctx, shiftMonthKey(month, -12), shiftMonthKey(month, -1));
  let run = 0;
  let bestRun = 0;
  for (const p of series) {
    if (p.income > 0n && p.net > 0n) {
      run += 1;
      bestRun = Math.max(bestRun, run);
    } else run = 0;
  }

  const reviewCount = reviews.filter((r) => !r.deleted_at).length;
  const progress: Record<BadgeKey, [number, number]> = {
    first_tx: [Math.min(txCount, 1), 1],
    tx_10: [Math.min(txCount, 10), 10],
    streak_7: [Math.min(st.longest, 7), 7],
    streak_30: [Math.min(st.longest, 30), 30],
    consistent_tracker: [Math.min(st.window30 >= 30 ? st.accounted30 : 0, 25), 25],
    spending_awareness: [Math.min(reviewCount, 5), 5],
    budget_master: [budgetMaster, 1],
    savings_milestone: [Math.min(Math.round(bestGoal * 100), 50), 50],
    financial_discipline: [Math.min(bestRun, 3), 3],
  };

  const unlockedAt = new Map(unlocked.filter((a) => !a.deleted_at).map((a) => [a.key, a.unlocked_at]));
  return BADGES.map((b) => {
    const [current, target] = progress[b.key];
    return { ...b, current, target, earned: current >= target, unlockedAt: unlockedAt.get(b.key) ?? null };
  });
}

/** Badges that are earned now but not yet persisted. */
export function newlyEarned(badges: readonly BadgeStatus[]): BadgeKey[] {
  return badges.filter((b) => b.earned && !b.unlockedAt).map((b) => b.key);
}
