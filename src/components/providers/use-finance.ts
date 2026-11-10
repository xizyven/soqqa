"use client";

import { useMemo } from "react";
import { useApp } from "./app-provider";
import { makeContext, compareMonths, budgetStatuses, firstActivityMonth, monthlySeries } from "@/lib/domain/analytics";
import { netWorth, walletBalances } from "@/lib/domain/ledger";
import { goalProgress, safeToSpend } from "@/lib/domain/planning";
import { generateInsights } from "@/lib/domain/insights";
import { monthKey, shiftMonthKey } from "@/lib/domain/dates";
import { notificationSettings, type Category, type Ledger, type Wallet } from "@/lib/domain/types";

const EMPTY: Ledger = { wallets: [], categories: [], transactions: [], budgets: [], goals: [], contributions: [], rates: [], recurring: [] };

/** Memoised financial snapshot derived from the live ledger. */
export function useFinance() {
  const { ledger, prefs, today } = useApp();
  const l = ledger ?? EMPTY;
  const base = prefs.base_currency;
  return useMemo(() => {
    const ctx = makeContext(l, base);
    const month = monthKey(today);
    const balances = walletBalances(l);
    const nw = netWorth(l, base, today);
    const comparison = compareMonths(ctx, month, today);
    const safe = safeToSpend(l, base, today);
    const budgets = budgetStatuses(ctx, month);
    const insights = generateInsights(l, base, today, { categoryChange: notificationSettings(prefs).category_change });
    const first = firstActivityMonth(l.transactions);
    const seriesStart = first && first > shiftMonthKey(month, -5) ? (first < month ? first : shiftMonthKey(month, -1)) : shiftMonthKey(month, -5);
    const series = monthlySeries(ctx, seriesStart, month);
    const goals = l.goals.filter((g) => g.status !== "archived").map((g) => goalProgress(g, l.contributions, today));
    const categoriesById = new Map<string, Category>(l.categories.map((c) => [c.id, c]));
    const walletsById = new Map<string, Wallet>(l.wallets.map((w) => [w.id, w]));
    return { ctx, base, month, balances, nw, comparison, safe, budgets, insights, series, goals, categoriesById, walletsById, loaded: !!ledger };
  }, [l, base, today, ledger, prefs]);
}
