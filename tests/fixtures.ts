import { RateBook } from "@/lib/domain/rates";
import { buildTransaction, type TransactionDraft } from "@/lib/domain/transactions";
import type { Category, ExchangeRate, Goal, GoalContribution, Ledger, Transaction, Wallet } from "@/lib/domain/types";

let n = 0;
export const uid = (p = "id") => `${p}-${++n}`;
const T = "2026-01-01T00:00:00.000Z";
const sync = (id: string) => ({ id, created_at: T, updated_at: T, deleted_at: null, version: 0 });

export function wallet(p: Partial<Wallet> = {}): Wallet {
  return { ...sync(p.id ?? uid("w")), name: "Karta", currency: "UZS", icon: "credit-card", color: "#3B82F6", opening_balance: "0.00", spendable: true, archived: false, sort: 0, ...p };
}

export function category(p: Partial<Category> = {}): Category {
  return { ...sync(p.id ?? uid("c")), kind: "expense", system_key: null, name: "Food", icon: "utensils", color: "#F59E0B", bucket: "wants", archived: false, sort: 0, ...p };
}

export function rate(currency: ExchangeRate["currency"], uzs: string, date: string, p: Partial<ExchangeRate> = {}): ExchangeRate {
  return { ...sync(p.id ?? uid("r")), currency, uzs_per_unit: uzs, effective_date: date, source: "manual", ...p };
}

export function goal(p: Partial<Goal> = {}): Goal {
  return { ...sync(p.id ?? uid("g")), name: "MacBook", target_amount: "20000000.00", currency: "UZS", target_date: null, monthly_target: null, icon: "laptop", color: "#8B5CF6", status: "active", ...p };
}

export function contribution(goalId: string, amount: string, date: string, p: Partial<GoalContribution> = {}): GoalContribution {
  return { ...sync(p.id ?? uid("gc")), goal_id: goalId, kind: "contribution", amount, wallet_id: null, wallet_amount: null, rate: null, local_date: date, note: "", ...p };
}

export function emptyLedger(p: Partial<Ledger> = {}): Ledger {
  return { wallets: [], categories: [], transactions: [], budgets: [], goals: [], contributions: [], rates: [], recurring: [], ...p };
}

/** Builds transactions through the real constructor so snapshots are realistic. */
export class TxFactory {
  txs: Transaction[] = [];
  constructor(public ledger: Ledger, public base: Ledger["wallets"][number]["currency"] = "UZS") {}
  add(d: TransactionDraft): Transaction {
    const tx = buildTransaction(d, {
      wallets: this.ledger.wallets,
      transactions: this.txs,
      base: this.base,
      book: new RateBook(this.ledger.rates),
      timezone: "Asia/Tashkent",
      now: new Date("2026-03-01T10:00:00Z"),
      newId: () => uid("t"),
    });
    this.txs.push(tx);
    this.ledger.transactions = this.txs;
    return tx;
  }
}
