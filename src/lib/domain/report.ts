/** Monthly report model — every figure computed from the ledger. */
import { budgetStatuses, compareMonths, type AnalyticsContext, type BudgetStatus, type CategoryTotal, type PeriodSummary } from "./analytics";
import { monthEnd } from "./dates";
import type { Transaction } from "./types";
import type { Cents } from "../money/money";

export interface MonthlyReport {
  month: string;
  income: Cents;
  expense: Cents;
  net: Cents;
  savingsRate: number | null;
  topCategories: CategoryTotal[];
  largest: { tx: Transaction; amount: Cents } | null;
  previous: PeriodSummary;
  incomeChange: number | null;
  expenseChange: number | null;
  budgets: BudgetStatus[];
  transactionCount: number;
}

export function buildMonthlyReport(ctx: AnalyticsContext, month: string): MonthlyReport {
  const cmp = compareMonths(ctx, month, monthEnd(month));
  const cur = cmp.current;
  return {
    month,
    income: cur.income,
    expense: cur.expense,
    net: cur.net,
    savingsRate: cur.savingsRate,
    topCategories: cur.expenseByCategory.slice(0, 3),
    largest: cur.largestExpense,
    previous: cmp.previous,
    incomeChange: cmp.incomeChange,
    expenseChange: cmp.previous.expense > 0n ? Number(((cur.expense - cmp.previous.expense) * 1_000_000n) / cmp.previous.expense) / 1_000_000 : null,
    budgets: budgetStatuses(ctx, month),
    transactionCount: cur.transactionCount,
  };
}
