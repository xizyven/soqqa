/**
 * Strategy calculators. All money math is integer (bigint minor units) and
 * splits always add back up to the input exactly.
 */
import { mulBps, sum, type Cents } from "../money/money";
import { monthsUntil, monthEnd, monthStart, shiftMonthKey, monthKey } from "../domain/dates";
import { summarize, type AnalyticsContext } from "../domain/analytics";
import type { LocalDate } from "../domain/types";

/**
 * Splits `amount` by basis-point shares. Shares must total 10 000; the rounding
 * remainder goes to the last part so the parts sum exactly to `amount`.
 */
export function splitByBps(amount: Cents, bps: readonly number[]): Cents[] {
  const total = bps.reduce((a, b) => a + b, 0);
  if (total !== 10000) throw new Error("shares must total 100%");
  const parts = bps.map((b) => mulBps(amount, b));
  parts[parts.length - 1] += amount - sum(parts);
  return parts;
}

/** Pay Yourself First: the amount to move to savings from one income. */
export function payYourselfFirst(income: Cents, bps: number): { save: Cents; spend: Cents } {
  const save = mulBps(income, bps);
  return { save, spend: income - save };
}

/** Zero-based budget: income minus every allocation must reach exactly zero. */
export function zeroBasedRemainder(income: Cents, allocations: readonly Cents[]): Cents {
  return income - sum(allocations);
}

export interface SinkingPlan {
  months: number;
  monthly: Cents;
  remaining: Cents;
}

/** Monthly amount to reach `target` by `targetDate` (rounded up to the minor unit). */
export function sinkingFund(target: Cents, saved: Cents, today: LocalDate, targetDate: LocalDate): SinkingPlan {
  const remaining = target > saved ? target - saved : 0n;
  const months = monthsUntil(today, targetDate);
  const monthly = remaining === 0n ? 0n : (remaining + BigInt(months) - 1n) / BigInt(months);
  return { months, monthly, remaining };
}

export interface EmergencyPlan {
  target: Cents;
  remaining: Cents;
  /** Coverage of the current savings in months (one decimal), relative to essential costs. */
  coverageMonths: number;
}

export function emergencyFund(essentialMonthly: Cents, months: number, current: Cents): EmergencyPlan {
  const target = essentialMonthly * BigInt(months);
  const remaining = target > current ? target - current : 0n;
  const coverageMonths = essentialMonthly > 0n ? Number((current * 10n) / essentialMonthly) / 10 : 0;
  return { target, remaining, coverageMonths };
}

/** Lifestyle-inflation control: keep a share of every raise for savings. */
export function raiseSplit(oldIncome: Cents, newIncome: Cents, saveBps: number): { raise: Cents; save: Cents; lifestyle: Cents } {
  const raise = newIncome > oldIncome ? newIncome - oldIncome : 0n;
  const save = mulBps(raise, saveBps);
  return { raise, save, lifestyle: raise - save };
}

/**
 * Average monthly spending in "needs" categories over the last `months`
 * complete months (the essential-cost basis for an emergency fund).
 */
export function essentialMonthly(ctx: AnalyticsContext, today: LocalDate, months = 3): { amount: Cents; months: number } {
  const month = monthKey(today);
  let total = 0n;
  let counted = 0;
  for (let i = 1; i <= months; i++) {
    const m = shiftMonthKey(month, -i);
    const s = summarize(ctx, { from: monthStart(m), to: monthEnd(m) });
    if (s.expense === 0n) continue;
    counted += 1;
    for (const c of s.expenseByCategory) if (ctx.ledger.categories.find((x) => x.id === c.categoryId)?.bucket === "needs") total += c.amount;
  }
  return { amount: counted ? total / BigInt(counted) : 0n, months: counted };
}

/** Average monthly income and spending over two consecutive windows (for lifestyle creep). */
export function incomeVsSpendingGrowth(ctx: AnalyticsContext, today: LocalDate, window = 3) {
  const month = monthKey(today);
  const sumRange = (fromBack: number) => {
    let income = 0n;
    let expense = 0n;
    for (let i = fromBack; i < fromBack + window; i++) {
      const m = shiftMonthKey(month, -i);
      const s = summarize(ctx, { from: monthStart(m), to: monthEnd(m) });
      income += s.income;
      expense += s.expense;
    }
    return { income: income / BigInt(window), expense: expense / BigInt(window) };
  };
  const recent = sumRange(1);
  const earlier = sumRange(1 + window);
  const growth = (a: Cents, b: Cents) => (b > 0n ? Number(((a - b) * 10000n) / b) / 10000 : null);
  return { recent, earlier, incomeGrowth: growth(recent.income, earlier.income), spendingGrowth: growth(recent.expense, earlier.expense) };
}
