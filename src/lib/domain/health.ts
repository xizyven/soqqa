/**
 * Financial Health Score (0–100): five transparent factors of 20 points each.
 * It measures money-management HABITS — consistency, planning, staying within
 * one's own limits — never wealth or income level. All amounts are relative
 * (shares and variation), so a low or high income alone neither helps nor hurts.
 */
import { budgetStatuses, makeContext, monthlySeries, summarize } from "./analytics";
import { indexActivity, streaks } from "./activity";
import { addDays, daysInMonth, monthEnd, monthKey, monthStart, shiftMonthKey } from "./dates";
import { goalProgress } from "./planning";
import type { Currency, DayReview, Ledger, LocalDate, StrategyPlan } from "./types";

export type HealthFactorKey = "tracking" | "budgets" | "savings" | "stability" | "planning";

export interface HealthFactor {
  key: HealthFactorKey;
  /** Points earned out of 20. */
  points: number;
  /** Translation key + params explaining the points. */
  reason: { key: string; params?: Record<string, string | number> };
  /** Recommendation key when the factor is below 15 points. */
  tip: string | null;
  limitedData: boolean;
}

export interface HealthScore {
  score: number;
  band: "strong" | "good" | "fair" | "weak";
  factors: HealthFactor[];
  asOf: LocalDate;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function healthScore(ledger: Ledger, base: Currency, asOf: LocalDate, extras: { reviews: readonly DayReview[]; plans: readonly StrategyPlan[] }): HealthScore {
  // Evaluate only what was known on `asOf`, so history is reproducible.
  const l: Ledger = {
    ...ledger,
    transactions: ledger.transactions.filter((t) => t.local_date <= asOf),
    contributions: ledger.contributions.filter((c) => c.local_date <= asOf),
  };
  const ctx = makeContext(l, base);
  const month = monthKey(asOf);
  const dayOfMonth = Number(asOf.slice(8, 10));
  const [y, m] = month.split("-").map(Number);
  const elapsed = dayOfMonth / daysInMonth(y, m);
  const factors: HealthFactor[] = [];

  // 1. Tracking consistency — accounted days in the last 30.
  const ix = indexActivity(l.transactions, extras.reviews.filter((r) => r.local_date <= asOf));
  const st = streaks(ix, asOf);
  if (st.window30 === 0) {
    factors.push({ key: "tracking", points: 0, reason: { key: "health.reason.tracking_none" }, tip: "health.tip.tracking", limitedData: true });
  } else {
    const rate = st.accounted30 / st.window30;
    const points = round1(20 * Math.min(1, rate / 0.8));
    factors.push({ key: "tracking", points, reason: { key: "health.reason.tracking", params: { days: st.accounted30, window: st.window30 } }, tip: points < 15 ? "health.tip.tracking" : null, limitedData: st.window30 < 7 });
  }

  // 2. Budget management — budgets kept within their limit (pace-adjusted mid-month).
  const statuses = budgetStatuses(ctx, month);
  if (!statuses.length) {
    factors.push({ key: "budgets", points: 0, reason: { key: "health.reason.budgets_none" }, tip: "health.tip.budgets_create", limitedData: false });
  } else {
    // Mid-month a budget is "on track" if spending is no more than 15 points ahead of the calendar.
    const onTrack = statuses.filter((s) => s.utilization <= 1 && s.utilization <= Math.min(1, elapsed + 0.15)).length;
    const share = onTrack / statuses.length;
    const points = round1(20 * share);
    factors.push({ key: "budgets", points, reason: { key: "health.reason.budgets", params: { ok: onTrack, total: statuses.length } }, tip: points < 15 ? "health.tip.budgets_pace" : null, limitedData: false });
  }

  // 3. Savings progress — positive net savings in the last complete month (relative) + goal contributions.
  const last = shiftMonthKey(month, -1);
  const s = summarize(ctx, { from: monthStart(last), to: monthEnd(last) });
  let savePts = 0;
  let saveKey = "health.reason.savings_no_income";
  let saveParams: Record<string, string | number> = {};
  if (s.income > 0n) {
    const rate = s.savingsRate ?? 0;
    savePts = rate <= 0 ? 0 : 10 * Math.min(1, rate / 0.1);
    saveKey = "health.reason.savings";
    saveParams = { pct: Math.round(rate * 100) };
  }
  const activeGoals = l.goals.filter((g) => g.status === "active" || g.status === "completed");
  const contributed30 = l.contributions.some((c) => c.kind === "contribution" && c.local_date > addDays(asOf, -30));
  const anyCompleted = activeGoals.some((g) => goalProgress(g, l.contributions, asOf).state === "completed");
  const goalPts = contributed30 || anyCompleted ? 10 : activeGoals.length ? 4 : 0;
  // Without income data, goal habits carry the whole factor.
  const savingsPoints = round1(s.income > 0n ? savePts + goalPts : Math.min(20, goalPts * 2));
  factors.push({ key: "savings", points: savingsPoints, reason: { key: saveKey, params: { ...saveParams, goal: contributed30 ? 1 : 0 } }, tip: savingsPoints < 15 ? (activeGoals.length ? "health.tip.savings_contribute" : "health.tip.savings_goal") : null, limitedData: s.income === 0n });

  // 4. Spending stability — month-to-month variation of spending over the last 3 complete months.
  const series = monthlySeries(ctx, shiftMonthKey(month, -3), last).filter((p) => p.expense > 0n);
  if (series.length < 2) {
    factors.push({ key: "stability", points: 10, reason: { key: "health.reason.stability_limited" }, tip: null, limitedData: true });
  } else {
    const xs = series.map((p) => Number(p.expense));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    const cv = mean > 0 ? sd / mean : 0;
    const points = round1(20 * Math.max(0, Math.min(1, (0.6 - cv) / 0.5)));
    factors.push({ key: "stability", points, reason: { key: "health.reason.stability", params: { pct: Math.round(cv * 100), months: series.length } }, tip: points < 15 ? "health.tip.stability" : null, limitedData: false });
  }

  // 5. Financial planning — the planning tools in use.
  const hasBudgets = statuses.length > 0;
  const hasGoal = l.goals.some((g) => g.status === "active");
  const hasSafety = l.goals.some((g) => g.status !== "archived" && g.icon === "shield") || extras.plans.some((p) => p.status === "active" && p.strategy === "emergency-fund");
  const hasStrategy = extras.plans.some((p) => p.status === "active");
  const hasRecurring = l.recurring.some((r) => r.active);
  const planningPoints = (hasBudgets ? 6 : 0) + (hasGoal ? 5 : 0) + (hasSafety ? 4 : 0) + (hasStrategy ? 3 : 0) + (hasRecurring ? 2 : 0);
  factors.push({
    key: "planning",
    points: planningPoints,
    reason: { key: "health.reason.planning", params: { tools: [hasBudgets, hasGoal, hasSafety, hasStrategy, hasRecurring].filter(Boolean).length } },
    tip: planningPoints >= 15 ? null : !hasSafety ? "health.tip.planning_safety" : !hasGoal ? "health.tip.savings_goal" : !hasStrategy ? "health.tip.planning_strategy" : "health.tip.planning_recurring",
    limitedData: false,
  });

  const score = Math.round(factors.reduce((a, f) => a + f.points, 0));
  const band = score >= 80 ? "strong" : score >= 60 ? "good" : score >= 40 ? "fair" : "weak";
  return { score, band, factors, asOf };
}

/** Month-end scores for the last `months` months (from the first activity), plus today. */
export function healthHistory(ledger: Ledger, base: Currency, today: LocalDate, extras: { reviews: readonly DayReview[]; plans: readonly StrategyPlan[] }, months = 6): { date: LocalDate; score: number }[] {
  const first = ledger.transactions.reduce<string | null>((m, t) => (!t.deleted_at && (!m || t.local_date < m) ? t.local_date : m), null);
  if (!first) return [];
  const out: { date: LocalDate; score: number }[] = [];
  for (let i = months; i >= 1; i--) {
    const end = monthEnd(shiftMonthKey(monthKey(today), -i));
    if (end < first) continue;
    out.push({ date: end, score: healthScore(ledger, base, end, extras).score });
  }
  out.push({ date: today, score: healthScore(ledger, base, today, extras).score });
  return out;
}

