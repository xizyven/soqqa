/**
 * Goals, recurring schedules and safe-to-spend.
 */
import { divideAmount, fraction, max, parseAmount, sum, type Cents } from "../money/money";
import { addDays, addMonths, daysBetween, monthEnd, monthKey, monthStart, monthsUntil } from "./dates";
import { goalSaved, netWorth } from "./ledger";
import { RateBook } from "./rates";
import { summarize } from "./analytics";
import type { Currency, Goal, GoalContribution, Ledger, LocalDate, Recurring } from "./types";

// ---------------------------------------------------------------------------
// Goals

export interface GoalProgress {
  goal: Goal;
  target: Cents;
  saved: Cents;
  remaining: Cents;
  progress: number; // 0..1
  monthsLeft: number | null;
  /** Amount needed per month to reach the target by the target date. */
  requiredMonthly: Cents | null;
  /** Average monthly net contribution over the last 3 months. */
  recentMonthly: Cents;
  contributedThisMonth: Cents;
  state: "completed" | "on_track" | "behind" | "overdue" | "no_deadline" | "paused";
}

export function goalProgress(goal: Goal, contributions: readonly GoalContribution[], today: LocalDate): GoalProgress {
  const target = parseAmount(goal.target_amount);
  const saved = goalSaved(goal.id, contributions);
  const remaining = max(0n, target - saved);
  const progress = target > 0n ? Math.min(1, Math.max(0, fraction(saved, target))) : 0;
  const month = monthKey(today);
  const threeMonthsAgo = monthStart(monthKey(addMonths(today, -2)));
  let recent = 0n;
  let thisMonth = 0n;
  for (const c of contributions) {
    if (c.deleted_at || c.goal_id !== goal.id) continue;
    const a = parseAmount(c.amount) * (c.kind === "contribution" ? 1n : -1n);
    if (c.local_date >= threeMonthsAgo && c.local_date <= today) recent += a;
    if (monthKey(c.local_date) === month) thisMonth += a;
  }
  const recentMonthly = divideAmount(recent, 3);
  let monthsLeft: number | null = null;
  let requiredMonthly: Cents | null = null;
  if (goal.target_date) {
    monthsLeft = goal.target_date < today ? 0 : monthsUntil(today, goal.target_date);
    requiredMonthly = remaining === 0n ? 0n : monthsLeft === 0 ? remaining : divideAmount(remaining, monthsLeft);
  }
  let state: GoalProgress["state"];
  if (saved >= target && target > 0n) state = "completed";
  else if (goal.status === "paused") state = "paused";
  else if (goal.target_date && goal.target_date < today) state = "overdue";
  else if (requiredMonthly === null) state = "no_deadline";
  else state = recentMonthly >= requiredMonthly ? "on_track" : "behind";
  return { goal, target, saved, remaining, progress, monthsLeft, requiredMonthly, recentMonthly, contributedThisMonth: thisMonth, state };
}

/** The monthly commitment for a goal: explicit target, else the required amount. */
export function monthlyCommitment(p: GoalProgress): Cents {
  if (p.state === "completed" || p.state === "paused" || p.goal.status !== "active") return 0n;
  if (p.goal.monthly_target) return parseAmount(p.goal.monthly_target);
  return p.requiredMonthly ?? 0n;
}

// ---------------------------------------------------------------------------
// Recurring

export function advanceRecurring(r: Pick<Recurring, "frequency" | "start_date">, date: LocalDate): LocalDate {
  const anchorDay = Number(r.start_date.slice(8, 10));
  switch (r.frequency) {
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonths(date, 1, anchorDay);
    case "yearly":
      return addMonths(date, 12, anchorDay);
  }
}

/** Occurrence dates of a rule within [from, to], starting at its next_date. */
export function occurrences(r: Recurring, from: LocalDate, to: LocalDate, limit = 400): LocalDate[] {
  if (!r.active || r.deleted_at) return [];
  const out: LocalDate[] = [];
  let d = r.next_date;
  let guard = 0;
  while (d <= to && guard++ < limit) {
    if (d >= from) out.push(d);
    d = advanceRecurring(r, d);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Safe to spend

export interface SafeToSpendItem {
  kind: "bill" | "goal" | "income";
  label: string;
  amount: Cents;
  date?: LocalDate;
  refId: string;
}

export interface SafeToSpend {
  periodEnd: LocalDate;
  daysLeft: number;
  /** Balances of spendable wallets, in base. */
  available: Cents;
  upcomingBills: Cents;
  goalCommitments: Cents;
  /** available − bills − remaining goal commitments (never below zero). */
  safe: Cents;
  perDay: Cents;
  /** Remaining budget for budgeted categories this month (null without budgets). */
  budgetRemaining: Cents | null;
  /** Expected recurring income before period end (shown, not counted). */
  expectedIncome: Cents;
  items: SafeToSpendItem[];
  netWorth: Cents;
  missingRates: Currency[];
}

export function safeToSpend(ledger: Ledger, base: Currency, today: LocalDate, periodEnd: LocalDate = monthEnd(monthKey(today))): SafeToSpend {
  const book = new RateBook(ledger.rates);
  const nw = netWorth(ledger, base, today);
  const items: SafeToSpendItem[] = [];
  const conv = (amount: Cents, cur: Currency) => {
    try {
      return book.convert(amount, cur, base, today);
    } catch {
      return 0n;
    }
  };

  let bills = 0n;
  let expectedIncome = 0n;
  // A rule's next_date only advances once its occurrence is posted, so anything
  // still scheduled (including overdue items) is still owed.
  for (const r of ledger.recurring) {
    for (const d of occurrences(r, "0000-01-01", periodEnd)) {
      const amt = conv(parseAmount(r.amount), r.currency);
      if (r.type === "expense") {
        bills += amt;
        items.push({ kind: "bill", label: r.name, amount: amt, date: d, refId: r.id });
      } else {
        expectedIncome += amt;
        items.push({ kind: "income", label: r.name, amount: amt, date: d, refId: r.id });
      }
    }
  }

  let goals = 0n;
  for (const g of ledger.goals) {
    if (g.deleted_at || g.status !== "active") continue;
    const p = goalProgress(g, ledger.contributions, today);
    const commitment = monthlyCommitment(p);
    const left = max(0n, commitment - max(0n, p.contributedThisMonth));
    const leftBase = conv(left, g.currency);
    if (leftBase > 0n) {
      goals += leftBase;
      items.push({ kind: "goal", label: g.name, amount: leftBase, refId: g.id });
    }
  }

  let budgetRemaining: Cents | null = null;
  const live = ledger.budgets.filter((b) => !b.deleted_at);
  if (live.length) {
    const month = monthKey(today);
    const s = summarize({ ledger, base, book }, { from: monthStart(month), to: monthEnd(month) });
    budgetRemaining = sum(
      live.map((b) => {
        const limit = conv(parseAmount(b.amount), b.currency);
        const spent = s.expenseByCategory.find((c) => c.categoryId === b.category_id)?.amount ?? 0n;
        return max(0n, limit - spent);
      }),
    );
  }

  const safe = max(0n, nw.spendable - bills - goals);
  const daysLeft = Math.max(1, daysBetween(today, periodEnd) + 1);
  return {
    periodEnd,
    daysLeft,
    available: nw.spendable,
    upcomingBills: bills,
    goalCommitments: goals,
    safe,
    perDay: divideAmount(safe, daysLeft),
    budgetRemaining,
    expectedIncome,
    items: items.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")),
    netWorth: nw.total,
    missingRates: nw.missingRates,
  };
}
