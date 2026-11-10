import { describe, expect, it } from "vitest";
import { toAmountString } from "@/lib/money/money";
import {
  averages,
  budgetStatuses,
  categoryChanges,
  compareMonths,
  dailySeries,
  detectAnomalies,
  makeContext,
  monthlySeries,
  rule503020,
  spendingVelocity,
  summarize,
} from "@/lib/domain/analytics";
import { goalProgress, occurrences, safeToSpend } from "@/lib/domain/planning";
import { generateInsights } from "@/lib/domain/insights";
import { localDateToInstant, monthsUntil, toLocalDate, addMonths } from "@/lib/domain/dates";
import type { Budget, Recurring } from "@/lib/domain/types";
import { category, contribution, emptyLedger, goal, TxFactory, wallet } from "./fixtures";

const S = (c: bigint) => toAmountString(c);

function world() {
  const card = wallet({ opening_balance: "0.00" });
  const savings = wallet({ name: "Jamg'arma", spendable: false, opening_balance: "10000000.00" });
  const food = category({ name: "Food", bucket: "wants" });
  const transport = category({ name: "Transport", bucket: "needs" });
  const salary = category({ name: "Salary", kind: "income", bucket: null });
  const ledger = emptyLedger({ wallets: [card, savings], categories: [food, transport, salary] });
  const f = new TxFactory(ledger);
  // January: income 6,000,000; food 1,000,000; transport 500,000
  f.add({ type: "income", wallet_id: card.id, amount: "6000000", category_id: salary.id, local_date: "2026-01-05" });
  f.add({ type: "expense", wallet_id: card.id, amount: "1000000", category_id: food.id, local_date: "2026-01-10" });
  f.add({ type: "expense", wallet_id: card.id, amount: "500000", category_id: transport.id, local_date: "2026-01-12" });
  // February: income 6,000,000; food 1,280,000; transport 300,000
  f.add({ type: "income", wallet_id: card.id, amount: "6000000", category_id: salary.id, local_date: "2026-02-05" });
  f.add({ type: "expense", wallet_id: card.id, amount: "1280000", category_id: food.id, local_date: "2026-02-10" });
  f.add({ type: "expense", wallet_id: card.id, amount: "300000", category_id: transport.id, local_date: "2026-02-11" });
  return { ledger, card, savings, food, transport, salary, f };
}

describe("monthly analytics", () => {
  it("summarises income, expense, savings rate and categories", () => {
    const { ledger, food } = world();
    const s = summarize(makeContext(ledger, "UZS"), { from: "2026-02-01", to: "2026-02-28" });
    expect(S(s.income)).toBe("6000000.00");
    expect(S(s.expense)).toBe("1580000.00");
    expect(S(s.net)).toBe("4420000.00");
    expect(s.savingsRate).toBeCloseTo(0.736667, 5);
    expect(s.expenseByCategory[0].categoryId).toBe(food.id);
    expect(S(s.largestExpense!.amount)).toBe("1280000.00");
  });

  it("builds a monthly series and month-over-month comparison", () => {
    const { ledger } = world();
    const ctx = makeContext(ledger, "UZS");
    const series = monthlySeries(ctx, "2026-01", "2026-03");
    expect(series.map((p) => S(p.expense))).toEqual(["1500000.00", "1580000.00", "0.00"]);
    const cmp = compareMonths(ctx, "2026-02", "2026-02-28");
    expect(cmp.expenseChange).toBeCloseTo(0.053333, 5);
    expect(cmp.incomeChange).toBe(0);
  });

  it("computes category changes (food +28%)", () => {
    const { ledger, food, transport } = world();
    const changes = categoryChanges(makeContext(ledger, "UZS"), "2026-02");
    expect(changes.find((c) => c.categoryId === food.id)!.change).toBeCloseTo(0.28, 6);
    expect(changes.find((c) => c.categoryId === transport.id)!.change).toBeCloseTo(-0.4, 6);
  });

  it("daily series and velocity", () => {
    const { ledger } = world();
    const ctx = makeContext(ledger, "UZS");
    const days = dailySeries(ctx, "2026-02-09", "2026-02-11");
    expect(days.map((d) => S(d.expense))).toEqual(["0.00", "1280000.00", "300000.00"]);
    const v = spendingVelocity(ctx, "2026-02-14");
    expect(S(v.spentToDate)).toBe("1580000.00");
    expect(S(v.dailyRate)).toBe("112857.14");
    // 1,580,000 so far + what January spent after the 14th (nothing) = 1,580,000
    expect(S(v.projectedMonth)).toBe("1580000.00");
    // Without history the projection is linear.
    const onlyFeb = { ...ledger, transactions: ledger.transactions.filter((x) => x.local_date >= "2026-02-01") };
    expect(S(spendingVelocity(makeContext(onlyFeb, "UZS"), "2026-02-14").projectedMonth)).toBe("3159999.92");
  });

  it("averages over complete previous months", () => {
    const { ledger } = world();
    const a = averages(makeContext(ledger, "UZS"), "2026-03");
    expect(a.monthsCounted).toBe(2);
    expect(S(a.avgMonthlyExpense)).toBe("1540000.00");
    expect(S(a.avgDailyExpense)).toBe("52203.39"); // 3,080,000 / 59 days
  });

  it("budget utilisation and threshold states", () => {
    const { ledger, food, transport } = world();
    const b = (cat: string, amount: string): Budget => ({ id: cat + "b", created_at: "", updated_at: "", deleted_at: null, version: 0, category_id: cat, amount, currency: "UZS", alert_threshold: 0.8 });
    ledger.budgets = [b(food.id, "1200000.00"), b(transport.id, "350000.00")];
    const st = budgetStatuses(makeContext(ledger, "UZS"), "2026-02");
    const foodSt = st.find((s) => s.budget.category_id === food.id)!;
    expect(foodSt.state).toBe("over");
    expect(S(foodSt.remaining)).toBe("-80000.00");
    const tr = st.find((s) => s.budget.category_id === transport.id)!;
    expect(tr.state).toBe("warning");
    expect(tr.utilization).toBeCloseTo(0.857143, 5);
  });

  it("50/30/20 analysis", () => {
    const { ledger } = world();
    const r = rule503020(makeContext(ledger, "UZS"), "2026-02")!;
    expect(r.needsShare).toBeCloseTo(0.05, 6);
    expect(r.wantsShare).toBeCloseTo(0.213333, 5);
    expect(r.savingsShare).toBeCloseTo(0.736667, 5);
  });

  it("detects unusual expenses against the category median", () => {
    const { ledger, card, food, f } = world();
    for (let d = 1; d <= 6; d++) f.add({ type: "expense", wallet_id: card.id, amount: "40000", category_id: food.id, local_date: `2026-03-0${d}` });
    f.add({ type: "expense", wallet_id: card.id, amount: "600000", category_id: food.id, local_date: "2026-03-08" });
    const a = detectAnomalies(makeContext(ledger, "UZS"), "2026-03-01", "2026-03-08", "2026-02-01");
    expect(a[0].tx.amount).toBe("600000.00");
  });
});

describe("timezones", () => {
  it("assigns local dates in Asia/Tashkent", () => {
    // 20:30 UTC on Jan 31 is 01:30 on Feb 1 in Tashkent (UTC+5).
    expect(toLocalDate("2026-01-31T20:30:00Z", "Asia/Tashkent")).toBe("2026-02-01");
    expect(toLocalDate("2026-01-31T20:30:00Z", "America/New_York")).toBe("2026-01-31");
    expect(localDateToInstant("2026-02-01", "Asia/Tashkent", "01:30")).toBe("2026-01-31T20:30:00.000Z");
  });

  it("month arithmetic clamps to month length", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(monthsUntil("2026-01-15", "2026-07-15")).toBe(6);
    expect(monthsUntil("2026-01-15", "2026-07-20")).toBe(7);
  });
});

describe("savings goals", () => {
  it("computes progress and the required monthly contribution", () => {
    const g = goal({ target_amount: "24000000.00", target_date: "2026-12-31" });
    const cs = [contribution(g.id, "3000000.00", "2026-01-10"), contribution(g.id, "1000000.00", "2026-02-10")];
    const p = goalProgress(g, cs, "2026-03-01");
    expect(S(p.saved)).toBe("4000000.00");
    expect(p.progress).toBeCloseTo(0.166667, 5);
    expect(p.monthsLeft).toBe(10);
    expect(S(p.requiredMonthly!)).toBe("2000000.00");
    expect(p.state).toBe("behind"); // recent average 1,333,333.33 < 2,000,000
  });

  it("marks completion and overdue goals", () => {
    const g = goal({ target_amount: "1000.00", target_date: "2026-01-01" });
    expect(goalProgress(g, [contribution(g.id, "1000.00", "2025-12-01")], "2026-03-01").state).toBe("completed");
    expect(goalProgress(g, [], "2026-03-01").state).toBe("overdue");
  });
});

describe("recurring & safe-to-spend", () => {
  const rec = (p: Partial<Recurring>): Recurring => ({
    id: "r1", created_at: "", updated_at: "", deleted_at: null, version: 0, name: "Internet", type: "expense", amount: "150000.00", currency: "UZS",
    wallet_id: "w", category_id: null, frequency: "monthly", start_date: "2026-01-31", next_date: "2026-02-28", active: true, ...p,
  });

  it("expands occurrences with month-end anchoring", () => {
    expect(occurrences(rec({}), "2026-02-01", "2026-05-31")).toEqual(["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
    expect(occurrences(rec({ frequency: "weekly", start_date: "2026-03-02", next_date: "2026-03-02" }), "2026-03-01", "2026-03-20")).toEqual([
      "2026-03-02", "2026-03-09", "2026-03-16",
    ]);
  });

  it("subtracts upcoming bills and goal commitments from spendable balances only", () => {
    const { ledger, card } = world();
    // Card balance after Jan+Feb: 12,000,000 − 3,080,000 = 8,920,000; savings wallet is not spendable.
    ledger.recurring = [rec({ wallet_id: card.id, next_date: "2026-02-20", amount: "500000.00", name: "Ijara" })];
    const g = goal({ target_amount: "12000000.00", monthly_target: "1000000.00" });
    ledger.goals = [g];
    ledger.contributions = [contribution(g.id, "400000.00", "2026-02-02")];
    const s = safeToSpend(ledger, "UZS", "2026-02-14");
    expect(S(s.available)).toBe("8920000.00");
    expect(S(s.upcomingBills)).toBe("500000.00");
    expect(S(s.goalCommitments)).toBe("600000.00");
    expect(S(s.safe)).toBe("7820000.00");
    expect(s.daysLeft).toBe(15);
    expect(S(s.perDay)).toBe("521333.33");
    expect(S(s.netWorth)).toBe("18920000.00"); // net worth ≠ safe-to-spend
  });
});

describe("insights", () => {
  it("are computed from data (food +28% month over month)", () => {
    const { ledger } = world();
    const ins = generateInsights(ledger, "UZS", "2026-03-05");
    const up = ins.find((i) => i.kind === "category_up");
    expect(up && up.kind === "category_up" && Math.round(up.change * 100)).toBe(28);
  });

  it("produce nothing misleading on an empty ledger", () => {
    expect(generateInsights(emptyLedger(), "UZS", "2026-03-05")).toEqual([]);
  });
});
