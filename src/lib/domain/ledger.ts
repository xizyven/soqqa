/**
 * Ledger engine: wallet balances and the analytic meaning of each transaction.
 *
 * Rules (mandatory, covered by tests):
 *  - Balances are derived, never stored: opening balance + effects.
 *  - Transfers move money between wallets and never count as income/expense.
 *  - Goal contributions/withdrawals linked to a wallet move the wallet balance
 *    and never count as income/expense.
 *  - A refund reduces spending in its category; a reversal cancels the
 *    original's analytic effect (expense reversal reduces spending, income
 *    reversal reduces income).
 */
import { parseAmount, type Cents } from "../money/money";
import { RateBook } from "./rates";
import type { Currency, GoalContribution, Ledger, LocalDate, Transaction, Wallet } from "./types";

/** Signed effect of a transaction on a single wallet, in that wallet's currency. */
export function walletEffect(tx: Transaction, walletId: string): Cents {
  if (tx.deleted_at) return 0n;
  let effect = 0n;
  if (tx.type === "transfer") {
    if (tx.wallet_id === walletId) effect -= parseAmount(tx.amount);
    if (tx.to_wallet_id === walletId && tx.to_amount) effect += parseAmount(tx.to_amount);
    return effect;
  }
  if (tx.wallet_id !== walletId) return 0n;
  const amount = parseAmount(tx.amount);
  return tx.direction === "in" ? amount : -amount;
}

export function contributionWalletEffect(c: GoalContribution, walletId: string): Cents {
  if (c.deleted_at || c.wallet_id !== walletId || !c.wallet_amount) return 0n;
  const a = parseAmount(c.wallet_amount);
  return c.kind === "contribution" ? -a : a;
}

export function walletBalance(
  wallet: Wallet,
  transactions: readonly Transaction[],
  contributions: readonly GoalContribution[] = [],
  asOf?: LocalDate,
): Cents {
  let bal = parseAmount(wallet.opening_balance);
  for (const tx of transactions) {
    if (asOf && tx.local_date > asOf) continue;
    bal += walletEffect(tx, wallet.id);
  }
  for (const c of contributions) {
    if (asOf && c.local_date > asOf) continue;
    bal += contributionWalletEffect(c, wallet.id);
  }
  return bal;
}

export function walletBalances(ledger: Pick<Ledger, "wallets" | "transactions" | "contributions">): Map<string, Cents> {
  const map = new Map<string, Cents>();
  for (const w of ledger.wallets) map.set(w.id, parseAmount(w.opening_balance));
  const bump = (id: string | null, v: Cents) => {
    if (!id || !map.has(id)) return;
    map.set(id, map.get(id)! + v);
  };
  for (const tx of ledger.transactions) {
    if (tx.deleted_at) continue;
    if (tx.type === "transfer") {
      bump(tx.wallet_id, -parseAmount(tx.amount));
      if (tx.to_amount) bump(tx.to_wallet_id, parseAmount(tx.to_amount));
    } else {
      const a = parseAmount(tx.amount);
      bump(tx.wallet_id, tx.direction === "in" ? a : -a);
    }
  }
  for (const c of ledger.contributions) {
    if (c.deleted_at || !c.wallet_id || !c.wallet_amount) continue;
    const a = parseAmount(c.wallet_amount);
    bump(c.wallet_id, c.kind === "contribution" ? -a : a);
  }
  return map;
}

/** Analytic classification of a transaction. */
export interface FlowEffect {
  /** Signed contribution to income (reversed income is negative). */
  income: Cents;
  /** Signed contribution to spending (refunds and expense reversals are negative). */
  expense: Cents;
}

/** Effect in the transaction's own currency. */
export function flowEffectRaw(tx: Transaction): FlowEffect {
  if (tx.deleted_at || tx.type === "transfer") return { income: 0n, expense: 0n };
  const a = parseAmount(tx.amount);
  switch (tx.type) {
    case "income":
      return { income: a, expense: 0n };
    case "expense":
      return { income: 0n, expense: a };
    case "refund":
      return { income: 0n, expense: -a };
    case "reversal":
      // Reversal of an expense returns money ("in") and cancels spending;
      // reversal of income takes money back ("out") and cancels income.
      return tx.direction === "in" ? { income: 0n, expense: -a } : { income: -a, expense: 0n };
  }
}

/**
 * Converts a transaction amount into `base`. Uses the transaction's immutable
 * snapshot when the requested base matches the one recorded at creation, so
 * historical reports never shift when new rates are added.
 */
export function toBase(tx: Transaction, base: Currency, book: RateBook): Cents {
  if (tx.currency === base) return parseAmount(tx.amount);
  if (tx.base_currency === base) return parseAmount(tx.base_amount);
  return book.convert(parseAmount(tx.amount), tx.currency, base, tx.local_date);
}

export function flowEffect(tx: Transaction, base: Currency, book: RateBook): FlowEffect {
  const raw = flowEffectRaw(tx);
  if (raw.income === 0n && raw.expense === 0n) return raw;
  const amountBase = toBase(tx, base, book);
  const sign = (v: Cents) => (v === 0n ? 0n : v > 0n ? amountBase : -amountBase);
  return { income: sign(raw.income), expense: sign(raw.expense) };
}

export interface NetWorth {
  total: Cents;
  spendable: Cents;
  byWallet: { wallet: Wallet; balance: Cents; balanceBase: Cents; approximate: boolean }[];
  missingRates: Currency[];
}

/** Net worth in `base` at the latest available rates (as of `asOf`). */
export function netWorth(ledger: Ledger, base: Currency, asOf: LocalDate, includeArchived = false): NetWorth {
  const book = new RateBook(ledger.rates);
  const balances = walletBalances(ledger);
  const missing = new Set<Currency>();
  let total = 0n;
  let spendable = 0n;
  const byWallet: NetWorth["byWallet"] = [];
  for (const w of ledger.wallets) {
    if (w.deleted_at || (w.archived && !includeArchived)) continue;
    const bal = balances.get(w.id) ?? 0n;
    let balBase = 0n;
    let approximate = false;
    try {
      const r = book.resolve(w.currency, base, asOf);
      balBase = w.currency === base ? bal : book.convert(bal, w.currency, base, asOf);
      approximate = !r.exact;
    } catch {
      missing.add(w.currency);
      approximate = true;
    }
    total += balBase;
    if (w.spendable) spendable += balBase;
    byWallet.push({ wallet: w, balance: bal, balanceBase: balBase, approximate });
  }
  return { total, spendable, byWallet, missingRates: [...missing] };
}

/** Sum of contributions minus withdrawals for a goal, in goal currency. */
export function goalSaved(goalId: string, contributions: readonly GoalContribution[]): Cents {
  let s = 0n;
  for (const c of contributions) {
    if (c.deleted_at || c.goal_id !== goalId) continue;
    const a = parseAmount(c.amount);
    s += c.kind === "contribution" ? a : -a;
  }
  return s;
}

export function liveLedger(ledger: Ledger): Ledger {
  const live = <T extends { deleted_at: string | null }>(xs: T[]) => xs.filter((x) => !x.deleted_at);
  return {
    wallets: live(ledger.wallets),
    categories: live(ledger.categories),
    transactions: live(ledger.transactions),
    budgets: live(ledger.budgets),
    goals: live(ledger.goals),
    contributions: live(ledger.contributions),
    rates: live(ledger.rates),
    recurring: live(ledger.recurring),
  };
}
