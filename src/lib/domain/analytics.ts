/**
 * Analytics engine. Pure, deterministic functions over a Ledger.
 * All money values are bigint minor units in the requested base currency.
 */
import { divideAmount, fraction, parseAmount, sum, type Cents } from "../money/money";
import { addDays, daysBetween, daysInMonth, monthEnd, monthKey, monthRange, monthStart, shiftMonthKey } from "./dates";
import { flowEffect, toBase } from "./ledger";
import { RateBook } from "./rates";
import type { Budget, Category, Currency, Ledger, LocalDate, Transaction, TransactionType } from "./types";

export interface AnalyticsFilter {
  from?: LocalDate;
  to?: LocalDate;
  walletIds?: string[];
  categoryIds?: string[];
  types?: TransactionType[];
  currencies?: Currency[];
}

export interface AnalyticsContext {
  ledger: Ledger;
  base: Currency;
  book: RateBook;
}

export function makeContext(ledger: Ledger, base: Currency): AnalyticsContext {
  return { ledger, base, book: new RateBook(ledger.rates) };
}

export function filterTransactions(txs: readonly Transaction[], f: AnalyticsFilter = {}): Transaction[] {
  return txs.filter((t) => {
    if (t.deleted_at) return false;
    if (f.from && t.local_date < f.from) return false;
    if (f.to && t.local_date > f.to) return false;
    if (f.walletIds?.length && !f.walletIds.includes(t.wallet_id) && !(t.to_wallet_id && f.walletIds.includes(t.to_wallet_id)))
      return false;
    if (f.categoryIds?.length && (!t.category_id || !f.categoryIds.includes(t.category_id))) return false;
    if (f.types?.length && !f.types.includes(t.type)) return false;
    if (f.currencies?.length && !f.currencies.includes(t.currency)) return false;
    return true;
  });
}

export interface CategoryTotal {
  categoryId: string | null;
  amount: Cents;
  count: number;
  share: number; // 0..1 of total expense (or income)
}

export interface PeriodSummary {
  income: Cents;
  expense: Cents;
  net: Cents;
  /** (income - expense) / income, or null when there is no income. */
  savingsRate: number | null;
  transactionCount: number;
  expenseByCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  largestExpense: { tx: Transaction; amount: Cents } | null;
}

export function summarize(ctx: AnalyticsContext, filter: AnalyticsFilter = {}): PeriodSummary {
  const txs = filterTransactions(ctx.ledger.transactions, filter);
  let income = 0n;
  let expense = 0n;
  const exp = new Map<string | null, { amount: Cents; count: number }>();
  const inc = new Map<string | null, { amount: Cents; count: number }>();
  let largest: PeriodSummary["largestExpense"] = null;
  let count = 0;
  for (const t of txs) {
    if (t.type === "transfer") continue;
    count++;
    const e = flowEffect(t, ctx.base, ctx.book);
    income += e.income;
    expense += e.expense;
    if (e.expense !== 0n) {
      const cur = exp.get(t.category_id) ?? { amount: 0n, count: 0 };
      cur.amount += e.expense;
      cur.count += 1;
      exp.set(t.category_id, cur);
      if (t.type === "expense" && (!largest || e.expense > largest.amount)) largest = { tx: t, amount: e.expense };
    }
    if (e.income !== 0n) {
      const cur = inc.get(t.category_id) ?? { amount: 0n, count: 0 };
      cur.amount += e.income;
      cur.count += 1;
      inc.set(t.category_id, cur);
    }
  }
  const toList = (m: Map<string | null, { amount: Cents; count: number }>, total: Cents): CategoryTotal[] =>
    [...m.entries()]
      .filter(([, v]) => v.amount > 0n)
      .map(([categoryId, v]) => ({ categoryId, amount: v.amount, count: v.count, share: fraction(v.amount, total) }))
      .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  const net = income - expense;
  return {
    income,
    expense,
    net,
    savingsRate: income > 0n ? fraction(net, income) : null,
    transactionCount: count,
    expenseByCategory: toList(exp, expense),
    incomeByCategory: toList(inc, income),
    largestExpense: largest,
  };
}

export interface MonthPoint {
  month: string;
  income: Cents;
  expense: Cents;
  net: Cents;
}

export function monthlySeries(ctx: AnalyticsContext, fromMonth: string, toMonth: string, filter: AnalyticsFilter = {}): MonthPoint[] {
  const months = monthRange(fromMonth, toMonth);
  const idx = new Map(months.map((m, i) => [m, i]));
  const points: MonthPoint[] = months.map((month) => ({ month, income: 0n, expense: 0n, net: 0n }));
  const txs = filterTransactions(ctx.ledger.transactions, { ...filter, from: monthStart(fromMonth), to: monthEnd(toMonth) });
  for (const t of txs) {
    const i = idx.get(monthKey(t.local_date));
    if (i === undefined) continue;
    const e = flowEffect(t, ctx.base, ctx.book);
    points[i].income += e.income;
    points[i].expense += e.expense;
  }
  for (const p of points) p.net = p.income - p.expense;
  return points;
}

export interface DayPoint {
  date: LocalDate;
  expense: Cents;
  income: Cents;
}

export function dailySeries(ctx: AnalyticsContext, from: LocalDate, to: LocalDate, filter: AnalyticsFilter = {}): DayPoint[] {
  const n = daysBetween(from, to) + 1;
  if (n <= 0) return [];
  const points: DayPoint[] = Array.from({ length: n }, (_, i) => ({ date: addDays(from, i), expense: 0n, income: 0n }));
  for (const t of filterTransactions(ctx.ledger.transactions, { ...filter, from, to })) {
    const i = daysBetween(from, t.local_date);
    const e = flowEffect(t, ctx.base, ctx.book);
    points[i].expense += e.expense;
    points[i].income += e.income;
  }
  return points;
}

export interface CategoryChange {
  categoryId: string | null;
  current: Cents;
  previous: Cents;
  /** Relative change, null when previous is zero. */
  change: number | null;
}

export function categoryChanges(ctx: AnalyticsContext, month: string, filter: AnalyticsFilter = {}): CategoryChange[] {
  const cur = summarize(ctx, { ...filter, from: monthStart(month), to: monthEnd(month) });
  const prevKey = shiftMonthKey(month, -1);
  const prev = summarize(ctx, { ...filter, from: monthStart(prevKey), to: monthEnd(prevKey) });
  const ids = new Set<string | null>([...cur.expenseByCategory.map((c) => c.categoryId), ...prev.expenseByCategory.map((c) => c.categoryId)]);
  const get = (list: CategoryTotal[], id: string | null) => list.find((c) => c.categoryId === id)?.amount ?? 0n;
  return [...ids]
    .map((categoryId) => {
      const current = get(cur.expenseByCategory, categoryId);
      const previous = get(prev.expenseByCategory, categoryId);
      return { categoryId, current, previous, change: previous > 0n ? fraction(current - previous, previous) : null };
    })
    .sort((a, b) => Number(b.current - b.previous) - Number(a.current - a.previous));
}

export interface MonthComparison {
  month: string;
  previousMonth: string;
  current: PeriodSummary;
  previous: PeriodSummary;
  /** Spending in the previous month up to the same day of month (like-for-like). */
  previousToDate: Cents;
  incomeChange: number | null;
  expenseChange: number | null;
}

export function compareMonths(ctx: AnalyticsContext, month: string, today: LocalDate, filter: AnalyticsFilter = {}): MonthComparison {
  const prevKey = shiftMonthKey(month, -1);
  const current = summarize(ctx, { ...filter, from: monthStart(month), to: monthEnd(month) });
  const previous = summarize(ctx, { ...filter, from: monthStart(prevKey), to: monthEnd(prevKey) });
  const isCurrent = monthKey(today) === month;
  const dayOfMonth = isCurrent ? Number(today.slice(8, 10)) : 31;
  const [py, pm] = prevKey.split("-").map(Number);
  const cutoff = `${prevKey}-${String(Math.min(dayOfMonth, daysInMonth(py, pm))).padStart(2, "0")}`;
  const prevSummaryToDate = summarize(ctx, { ...filter, from: monthStart(prevKey), to: cutoff });
  const rel = (a: Cents, b: Cents) => (b > 0n ? fraction(a - b, b) : null);
  // For the running month both sides are compared over the same days (like-for-like).
  return {
    month,
    previousMonth: prevKey,
    current,
    previous,
    previousToDate: prevSummaryToDate.expense,
    incomeChange: rel(current.income, isCurrent ? prevSummaryToDate.income : previous.income),
    expenseChange: rel(current.expense, isCurrent ? prevSummaryToDate.expense : previous.expense),
  };
}

export interface Averages {
  monthsCounted: number;
  avgMonthlyIncome: Cents;
  avgMonthlyExpense: Cents;
  avgDailyExpense: Cents;
  savingsRate: number | null;
}

/** Averages over complete months before `currentMonth` (up to `lookback`), falling back to the current month. */
export function averages(ctx: AnalyticsContext, currentMonth: string, lookback = 3, filter: AnalyticsFilter = {}): Averages {
  const first = firstActivityMonth(ctx.ledger.transactions);
  const months: string[] = [];
  for (let i = 1; i <= lookback; i++) {
    const m = shiftMonthKey(currentMonth, -i);
    if (first && m >= first) months.push(m);
  }
  if (months.length === 0) months.push(currentMonth);
  const series = months.map((m) => summarize(ctx, { ...filter, from: monthStart(m), to: monthEnd(m) }));
  const inc = sum(series.map((s) => s.income));
  const exp = sum(series.map((s) => s.expense));
  const days = months.reduce((d, m) => {
    const [y, mo] = m.split("-").map(Number);
    return d + daysInMonth(y, mo);
  }, 0);
  return {
    monthsCounted: months.length,
    avgMonthlyIncome: divideAmount(inc, months.length),
    avgMonthlyExpense: divideAmount(exp, months.length),
    avgDailyExpense: divideAmount(exp, days),
    savingsRate: inc > 0n ? fraction(inc - exp, inc) : null,
  };
}

export function firstActivityMonth(txs: readonly Transaction[]): string | null {
  let min: string | null = null;
  for (const t of txs) if (!t.deleted_at && (!min || t.local_date < min)) min = t.local_date;
  return min ? monthKey(min) : null;
}

export interface Velocity {
  spentToDate: Cents;
  daysElapsed: number;
  daysInMonth: number;
  dailyRate: Cents;
  /**
   * Month-end estimate: spending so far plus what was typically spent in the
   * REST of the month in up to 3 prior months (same day boundary). This keeps
   * early-month bills like rent from being extrapolated. Without history it
   * falls back to a linear projection.
   */
  projectedMonth: Cents;
}

export function spendingVelocity(ctx: AnalyticsContext, today: LocalDate, filter: AnalyticsFilter = {}): Velocity {
  const month = monthKey(today);
  const [y, m] = month.split("-").map(Number);
  const dim = daysInMonth(y, m);
  const elapsed = Number(today.slice(8, 10));
  const spent = summarize(ctx, { ...filter, from: monthStart(month), to: today }).expense;
  const daily = divideAmount(spent, elapsed);
  const first = firstActivityMonth(ctx.ledger.transactions);
  const rests: Cents[] = [];
  for (let i = 1; i <= 3; i++) {
    const m = shiftMonthKey(month, -i);
    if (!first || m < first) break;
    const [py, pm] = m.split("-").map(Number);
    const boundary = Math.min(elapsed, daysInMonth(py, pm));
    const restFrom = addDays(`${m}-${String(boundary).padStart(2, "0")}`, 1);
    rests.push(restFrom > monthEnd(m) ? 0n : summarize(ctx, { ...filter, from: restFrom, to: monthEnd(m) }).expense);
  }
  const projected = rests.length ? spent + divideAmount(sum(rests), rests.length) : daily * BigInt(dim);
  return { spentToDate: spent, daysElapsed: elapsed, daysInMonth: dim, dailyRate: daily, projectedMonth: projected };
}

export interface BudgetStatus {
  budget: Budget;
  category: Category | undefined;
  limit: Cents;
  spent: Cents;
  remaining: Cents;
  utilization: number;
  state: "ok" | "warning" | "over";
}

export function budgetStatuses(ctx: AnalyticsContext, month: string): BudgetStatus[] {
  const summary = summarize(ctx, { from: monthStart(month), to: monthEnd(month) });
  const date = monthEnd(month);
  return ctx.ledger.budgets
    .filter((b) => !b.deleted_at)
    .map((budget) => {
      const category = ctx.ledger.categories.find((c) => c.id === budget.category_id);
      let limit = parseAmount(budget.amount);
      if (budget.currency !== ctx.base) {
        try {
          limit = ctx.book.convert(limit, budget.currency, ctx.base, date);
        } catch {
          /* keep raw limit when no rate is known */
        }
      }
      const spent = summary.expenseByCategory.find((c) => c.categoryId === budget.category_id)?.amount ?? 0n;
      const utilization = fraction(spent, limit);
      const state: BudgetStatus["state"] = spent > limit ? "over" : utilization >= budget.alert_threshold ? "warning" : "ok";
      return { budget, category, limit, spent, remaining: limit - spent, utilization, state };
    })
    .sort((a, b) => b.utilization - a.utilization);
}

export interface Rule503020 {
  income: Cents;
  needs: Cents;
  wants: Cents;
  savings: Cents;
  needsShare: number;
  wantsShare: number;
  savingsShare: number;
}

/** 50/30/20 analysis for a month. Savings = income − needs − wants (includes goal contributions). */
export function rule503020(ctx: AnalyticsContext, month: string): Rule503020 | null {
  const s = summarize(ctx, { from: monthStart(month), to: monthEnd(month) });
  if (s.income <= 0n) return null;
  let needs = 0n;
  let wants = 0n;
  for (const c of s.expenseByCategory) {
    const cat = ctx.ledger.categories.find((x) => x.id === c.categoryId);
    if (cat?.bucket === "needs") needs += c.amount;
    else wants += c.amount;
  }
  const savings = s.income - needs - wants;
  return {
    income: s.income,
    needs,
    wants,
    savings,
    needsShare: fraction(needs, s.income),
    wantsShare: fraction(wants, s.income),
    savingsShare: fraction(savings, s.income),
  };
}

export interface Anomaly {
  tx: Transaction;
  amount: Cents;
  categoryMedian: Cents;
  multiple: number;
}

/**
 * Unusual expenses: at least 3× the median of the same category over the
 * trailing window, with at least 5 samples in that category.
 */
export function detectAnomalies(ctx: AnalyticsContext, from: LocalDate, to: LocalDate, windowStart: LocalDate): Anomaly[] {
  const history = filterTransactions(ctx.ledger.transactions, { from: windowStart, to, types: ["expense"] });
  const byCat = new Map<string | null, Cents[]>();
  for (const t of history) {
    const list = byCat.get(t.category_id) ?? [];
    list.push(toBase(t, ctx.base, ctx.book));
    byCat.set(t.category_id, list);
  }
  const medians = new Map<string | null, Cents>();
  for (const [k, list] of byCat) {
    if (list.length < 5) continue;
    const sorted = [...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const mid = sorted.length >> 1;
    medians.set(k, sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2n);
  }
  const out: Anomaly[] = [];
  for (const t of history) {
    if (t.local_date < from) continue;
    const med = medians.get(t.category_id);
    if (!med || med <= 0n) continue;
    const amount = toBase(t, ctx.base, ctx.book);
    if (amount >= med * 3n) out.push({ tx: t, amount, categoryMedian: med, multiple: fraction(amount, med) });
  }
  return out.sort((a, b) => b.multiple - a.multiple);
}

/** Heatmap cell values for a range (expense per day). */
export function spendingHeatmap(ctx: AnalyticsContext, from: LocalDate, to: LocalDate, filter: AnalyticsFilter = {}) {
  const days = dailySeries(ctx, from, to, filter);
  const maxV = days.reduce((m, d) => (d.expense > m ? d.expense : m), 0n);
  return days.map((d) => ({ date: d.date, expense: d.expense, intensity: maxV > 0n && d.expense > 0n ? Math.max(0.08, fraction(d.expense, maxV)) : 0 }));
}
