/**
 * Debt repayment simulation: avalanche (highest rate first) vs snowball
 * (smallest balance first). Integer minor units throughout; monthly interest
 * is the annual rate / 12, rounded half-to-even per month.
 */
import { divRound, min, type Cents } from "../money/money";

export interface DebtInput {
  id: string;
  name: string;
  balance: Cents;
  /** Annual interest rate in basis points (24.5% = 2450). */
  aprBps: number;
  minPayment: Cents;
}

export type PayoffMethod = "avalanche" | "snowball";

export interface PayoffResult {
  method: PayoffMethod;
  feasible: boolean;
  /** Why it is not feasible: the budget doesn't cover the minimums, or never reduces the balance. */
  problem: "budget_below_minimums" | "not_amortizing" | null;
  months: number;
  totalInterest: Cents;
  totalPaid: Cents;
  /** Month (1-based) in which each debt reaches zero, in payoff order. */
  payoffOrder: { id: string; month: number }[];
  /** Remaining total balance at the end of each month. */
  balances: Cents[];
}

const MAX_MONTHS = 600;

export function monthlyInterest(balance: Cents, aprBps: number): Cents {
  if (balance <= 0n || aprBps <= 0) return 0n;
  return divRound(balance * BigInt(aprBps), 120000n);
}

export function orderDebts(debts: readonly DebtInput[], method: PayoffMethod): DebtInput[] {
  return [...debts].sort((a, b) =>
    method === "avalanche"
      ? b.aprBps - a.aprBps || (a.balance < b.balance ? -1 : a.balance > b.balance ? 1 : 0)
      : a.balance < b.balance ? -1 : a.balance > b.balance ? 1 : b.aprBps - a.aprBps,
  );
}

/**
 * Pays every minimum each month, then puts the rest of `monthlyBudget` on the
 * priority debt. Freed-up minimums roll into the next priority automatically
 * because the total budget stays constant.
 */
export function simulatePayoff(debts: readonly DebtInput[], monthlyBudget: Cents, method: PayoffMethod): PayoffResult {
  const live = debts.filter((d) => d.balance > 0n);
  const empty: PayoffResult = { method, feasible: true, problem: null, months: 0, totalInterest: 0n, totalPaid: 0n, payoffOrder: [], balances: [] };
  if (!live.length) return empty;
  const minTotal = live.reduce((s, d) => s + d.minPayment, 0n);
  if (monthlyBudget < minTotal) return { ...empty, feasible: false, problem: "budget_below_minimums" };

  const priority = orderDebts(live, method).map((d) => d.id);
  const bal = new Map(live.map((d) => [d.id, d.balance]));
  const info = new Map(live.map((d) => [d.id, d]));
  let totalInterest = 0n;
  let totalPaid = 0n;
  const payoffOrder: { id: string; month: number }[] = [];
  const balances: Cents[] = [];
  let previousTotal = live.reduce((s, d) => s + d.balance, 0n);

  for (let month = 1; month <= MAX_MONTHS; month++) {
    // Interest accrues on the opening balance.
    for (const [id, b] of bal) {
      if (b <= 0n) continue;
      const i = monthlyInterest(b, info.get(id)!.aprBps);
      bal.set(id, b + i);
      totalInterest += i;
    }
    let budget = monthlyBudget;
    // Minimums first.
    for (const [id, b] of bal) {
      if (b <= 0n) continue;
      const pay = min(min(b, info.get(id)!.minPayment), budget);
      bal.set(id, b - pay);
      budget -= pay;
      totalPaid += pay;
    }
    // Extra to the priority debt(s), cascading if one is cleared this month.
    for (const id of priority) {
      if (budget <= 0n) break;
      const b = bal.get(id)!;
      if (b <= 0n) continue;
      const pay = b < budget ? b : budget;
      bal.set(id, b - pay);
      budget -= pay;
      totalPaid += pay;
    }
    for (const id of priority) if (bal.get(id)! <= 0n && !payoffOrder.some((p) => p.id === id)) payoffOrder.push({ id, month });
    const total = [...bal.values()].reduce((s, b) => s + (b > 0n ? b : 0n), 0n);
    balances.push(total);
    if (total === 0n) return { method, feasible: true, problem: null, months: month, totalInterest, totalPaid, payoffOrder, balances };
    if (month === 1 && total >= previousTotal) return { ...empty, feasible: false, problem: "not_amortizing", balances };
    previousTotal = total;
  }
  return { method, feasible: false, problem: "not_amortizing", months: MAX_MONTHS, totalInterest, totalPaid, payoffOrder, balances };
}

