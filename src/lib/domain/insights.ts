/**
 * Rule-based insight generation. Every number in an insight is computed from
 * the ledger; insights are structured data rendered by the UI via i18n.
 */
import { mulBps, parseAmount, sum, type Cents } from "../money/money";
import { addDays, daysInMonth, monthEnd, monthKey, monthStart, shiftMonthKey } from "./dates";
import {
  averages,
  budgetStatuses,
  categoryChanges,
  compareMonths,
  detectAnomalies,
  filterTransactions,
  makeContext,
  rule503020,
  spendingVelocity,
  summarize,
  type AnalyticsContext,
} from "./analytics";
import { toBase } from "./ledger";
import { goalProgress } from "./planning";
import type { Currency, Ledger, LocalDate } from "./types";

export type InsightSeverity = "positive" | "info" | "warning" | "critical";

export type Insight =
  | { id: string; kind: "category_up"; severity: InsightSeverity; categoryId: string | null; change: number; current: Cents; previous: Cents }
  | { id: string; kind: "category_down"; severity: InsightSeverity; categoryId: string | null; change: number; current: Cents; previous: Cents }
  | { id: string; kind: "budget_over"; severity: InsightSeverity; categoryId: string; spent: Cents; limit: Cents }
  | { id: string; kind: "budget_warning"; severity: InsightSeverity; categoryId: string; utilization: number; remaining: Cents }
  | { id: string; kind: "small_expenses"; severity: InsightSeverity; monthlyTotal: Cents; reductionBps: number; monthlySaving: Cents; count: number; threshold: Cents }
  | { id: string; kind: "projection_over"; severity: InsightSeverity; projected: Cents; average: Cents }
  | { id: string; kind: "pace_good"; severity: InsightSeverity; spentToDate: Cents; previousToDate: Cents; change: number }
  | { id: string; kind: "anomaly"; severity: InsightSeverity; txId: string; categoryId: string | null; amount: Cents; multiple: number }
  | { id: string; kind: "savings_rate"; severity: InsightSeverity; rate: number; previous: number | null }
  | { id: string; kind: "rule_503020"; severity: InsightSeverity; needs: number; wants: number; savings: number }
  | { id: string; kind: "goal_behind"; severity: InsightSeverity; goalId: string; required: Cents; recent: Cents; currency: Currency }
  | { id: string; kind: "budget_pace"; severity: InsightSeverity; categoryId: string; utilization: number; elapsed: number; projected: Cents; limit: Cents }
  | { id: string; kind: "category_pace"; severity: InsightSeverity; categoryId: string | null; change: number; current: Cents; previous: Cents }
  | { id: string; kind: "bill_upcoming"; severity: InsightSeverity; recurringId: string; name: string; amount: Cents; currency: Currency; date: LocalDate };

/** Whether an insight states a fact from records, an estimate, or a forward-looking prediction. */
export type InsightBasis = "fact" | "estimate" | "prediction";

export function insightBasis(kind: Insight["kind"]): InsightBasis {
  if (kind === "projection_over" || kind === "budget_pace") return "prediction";
  if (kind === "small_expenses") return "estimate";
  return "fact";
}

export interface InsightOptions {
  /** Month-to-date category growth that triggers a warning (default 25%). */
  categoryChange?: number;
}

export function generateInsights(ledger: Ledger, base: Currency, today: LocalDate, opts: InsightOptions = {}): Insight[] {
  const ctx = makeContext(ledger, base);
  const month = monthKey(today);
  const out: Insight[] = [];
  const dayOfMonth = Number(today.slice(8, 10));

  // Budgets
  for (const b of budgetStatuses(ctx, month)) {
    if (b.state === "over")
      out.push({ id: `budget_over:${b.budget.id}`, kind: "budget_over", severity: "critical", categoryId: b.budget.category_id, spent: b.spent, limit: b.limit });
    else if (b.state === "warning")
      out.push({ id: `budget_warn:${b.budget.id}`, kind: "budget_warning", severity: "warning", categoryId: b.budget.category_id, utilization: b.utilization, remaining: b.remaining });
  }

  // Budget pace: spending running well ahead of the calendar (prediction, not yet over).
  const [yy, mm] = month.split("-").map(Number);
  const elapsed = dayOfMonth / daysInMonth(yy, mm);
  for (const b of budgetStatuses(ctx, month)) {
    if (b.state !== "ok" || elapsed < 0.15 || elapsed >= 1 || b.spent <= 0n) continue;
    if (b.utilization >= elapsed + 0.25) {
      const projected = (b.spent * BigInt(daysInMonth(yy, mm))) / BigInt(dayOfMonth);
      if (projected > b.limit)
        out.push({ id: `budget_pace:${month}:${b.budget.id}`, kind: "budget_pace", severity: "warning", categoryId: b.budget.category_id, utilization: b.utilization, elapsed, projected, limit: b.limit });
    }
  }

  // Category pace: month-to-date vs the same days of last month (fact).
  if (dayOfMonth >= 7) {
    const threshold = opts.categoryChange ?? 0.25;
    const prevKey = shiftMonthKey(month, -1);
    const prevCut = `${prevKey}-${String(Math.min(dayOfMonth, Number(monthEnd(prevKey).slice(8, 10)))).padStart(2, "0")}`;
    const cur = summarize(ctx, { from: monthStart(month), to: today });
    const prev = summarize(ctx, { from: monthStart(prevKey), to: prevCut });
    const floor = prev.expense / 20n; // ignore categories under 5% of last month's spending
    const paced = cur.expenseByCategory
      .map((c) => ({ c, p: prev.expenseByCategory.find((x) => x.categoryId === c.categoryId)?.amount ?? 0n }))
      .filter(({ c, p }) => p > 0n && p >= floor && c.amount > p && Number(((c.amount - p) * 10000n) / p) / 10000 >= threshold)
      .sort((a, b) => Number(b.c.amount - b.p - (a.c.amount - a.p)))
      .slice(0, 2);
    for (const { c, p } of paced)
      out.push({ id: `cat_pace:${month}:${c.categoryId}`, kind: "category_pace", severity: "warning", categoryId: c.categoryId, change: Number(((c.amount - p) * 10000n) / p) / 10000, current: c.amount, previous: p });
  }

  // Upcoming recurring bills in the next 3 days.
  for (const r of ledger.recurring) {
    if (r.deleted_at || !r.active || r.type !== "expense") continue;
    if (r.next_date >= today && r.next_date <= addDays(today, 3))
      out.push({ id: `bill:${r.id}:${r.next_date}`, kind: "bill_upcoming", severity: "info", recurringId: r.id, name: r.name, amount: parseAmount(r.amount), currency: r.currency, date: r.next_date });
  }

  // Category changes: compare complete previous month vs the month before when early
  // in the month; otherwise compare current month-to-date projection is noisy, so we
  // use last full month vs its predecessor for stability.
  const refMonth = dayOfMonth >= 20 ? month : shiftMonthKey(month, -1);
  const changes = categoryChanges(ctx, refMonth).filter((c) => c.change !== null && c.previous >= 1n);
  const ups = changes.filter((c) => (c.change ?? 0) >= 0.2 && c.current - c.previous > 0n).sort((a, b) => Number(b.current - b.previous) - Number(a.current - a.previous));
  const downs = changes.filter((c) => (c.change ?? 0) <= -0.2).sort((a, b) => Number(a.current - a.previous) - Number(b.current - b.previous));
  for (const c of ups.slice(0, 2))
    out.push({ id: `cat_up:${refMonth}:${c.categoryId}`, kind: "category_up", severity: "warning", categoryId: c.categoryId, change: c.change!, current: c.current, previous: c.previous });
  for (const c of downs.slice(0, 1))
    out.push({ id: `cat_down:${refMonth}:${c.categoryId}`, kind: "category_down", severity: "positive", categoryId: c.categoryId, change: c.change!, current: c.current, previous: c.previous });

  // Pace vs last month (like-for-like days)
  const cmp = compareMonths(ctx, month, today);
  if (cmp.previousToDate > 0n && cmp.expenseChange !== null && dayOfMonth >= 5) {
    if (cmp.expenseChange <= -0.1)
      out.push({ id: `pace:${month}`, kind: "pace_good", severity: "positive", spentToDate: cmp.current.expense, previousToDate: cmp.previousToDate, change: cmp.expenseChange });
  }

  // Projection vs average
  const avg = averages(ctx, month, 3);
  const vel = spendingVelocity(ctx, today);
  if (dayOfMonth >= 7 && avg.monthsCounted >= 1 && avg.avgMonthlyExpense > 0n && vel.projectedMonth > mulBps(avg.avgMonthlyExpense, 11500))
    out.push({ id: `proj:${month}`, kind: "projection_over", severity: "warning", projected: vel.projectedMonth, average: avg.avgMonthlyExpense });

  // Small daily expenses → saving opportunity (15% reduction)
  const small = smallExpenseOpportunity(ctx, today);
  if (small) out.push(small);

  // Savings rate for last complete month
  const last = shiftMonthKey(month, -1);
  const lastCmp = compareMonths(ctx, last, monthEnd(last));
  if (lastCmp.current.savingsRate !== null)
    out.push({
      id: `rate:${last}`,
      kind: "savings_rate",
      severity: lastCmp.current.savingsRate >= 0.2 ? "positive" : lastCmp.current.savingsRate < 0 ? "critical" : "info",
      rate: lastCmp.current.savingsRate,
      previous: lastCmp.previous.savingsRate,
    });

  const r = rule503020(ctx, last);
  if (r) out.push({ id: `503020:${last}`, kind: "rule_503020", severity: r.needsShare > 0.6 || r.savingsShare < 0.1 ? "warning" : "info", needs: r.needsShare, wants: r.wantsShare, savings: r.savingsShare });

  // Anomalies in the last 14 days
  for (const a of detectAnomalies(ctx, addDays(today, -13), today, addDays(today, -120)).slice(0, 2))
    out.push({ id: `anomaly:${a.tx.id}`, kind: "anomaly", severity: "info", txId: a.tx.id, categoryId: a.tx.category_id, amount: a.amount, multiple: a.multiple });

  // Goals behind schedule
  for (const g of ledger.goals) {
    if (g.deleted_at || g.status !== "active") continue;
    const p = goalProgress(g, ledger.contributions, today);
    if (p.state === "behind" && p.requiredMonthly)
      out.push({ id: `goal:${g.id}`, kind: "goal_behind", severity: "warning", goalId: g.id, required: p.requiredMonthly, recent: p.recentMonthly, currency: g.currency });
  }

  const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * "Small expenses" are expenses at or below 5% of average monthly spending
 * (minimum sample of 10 in the last 30 days). The opportunity is 15% of their
 * 30-day total.
 */
export function smallExpenseOpportunity(ctx: AnalyticsContext, today: LocalDate): Insight | null {
  const from = addDays(today, -29);
  const avg = averages(ctx, monthKey(today), 3);
  if (avg.avgMonthlyExpense <= 0n) return null;
  const threshold = mulBps(avg.avgMonthlyExpense, 500);
  const txs = filterTransactions(ctx.ledger.transactions, { from, to: today, types: ["expense"] });
  const smalls = txs.map((t) => toBase(t, ctx.base, ctx.book)).filter((a) => a <= threshold);
  if (smalls.length < 10) return null;
  const total = sum(smalls);
  const saving = mulBps(total, 1500);
  if (saving <= 0n) return null;
  return { id: `small:${monthKey(today)}`, kind: "small_expenses", severity: "info", monthlyTotal: total, reductionBps: 1500, monthlySaving: saving, count: smalls.length, threshold };
}
