import { describe, expect, it } from "vitest";
import { toAmountString } from "@/lib/money/money";
import { goalSaved, netWorth, walletBalance, walletBalances } from "@/lib/domain/ledger";
import { makeContext, summarize } from "@/lib/domain/analytics";
import { TransactionError } from "@/lib/domain/transactions";
import { RateBook } from "@/lib/domain/rates";
import { category, contribution, emptyLedger, goal, rate, TxFactory, wallet } from "./fixtures";

function setup() {
  const card = wallet({ name: "Asosiy karta", opening_balance: "1000000.00" });
  const cash = wallet({ name: "Naqd pul", icon: "banknote", opening_balance: "200000.00" });
  const usd = wallet({ name: "USD Jamg'arma", currency: "USD", opening_balance: "100.00" });
  const food = category({ name: "Food" });
  const salary = category({ name: "Salary", kind: "income", bucket: null });
  const ledger = emptyLedger({
    wallets: [card, cash, usd],
    categories: [food, salary],
    rates: [rate("USD", "12500", "2026-01-01"), rate("USD", "12700", "2026-03-01")],
  });
  return { ledger, card, cash, usd, food, salary, f: new TxFactory(ledger) };
}

const bal = (ledger: ReturnType<typeof setup>["ledger"], id: string) => toAmountString(walletBalances(ledger).get(id)!);

describe("wallet balances", () => {
  it("applies income and expense to the opening balance", () => {
    const { ledger, card, food, salary, f } = setup();
    f.add({ type: "income", wallet_id: card.id, amount: "5000000", category_id: salary.id, local_date: "2026-02-05" });
    f.add({ type: "expense", wallet_id: card.id, amount: "45000", category_id: food.id, local_date: "2026-02-06" });
    expect(bal(ledger, card.id)).toBe("5955000.00");
    expect(toAmountString(walletBalance(card, ledger.transactions))).toBe("5955000.00");
  });

  it("supports balance as of a date", () => {
    const { ledger, card, food, f } = setup();
    f.add({ type: "expense", wallet_id: card.id, amount: "100000", category_id: food.id, local_date: "2026-02-01" });
    f.add({ type: "expense", wallet_id: card.id, amount: "50000", category_id: food.id, local_date: "2026-02-10" });
    expect(toAmountString(walletBalance(card, ledger.transactions, [], "2026-02-05"))).toBe("900000.00");
  });

  it("ignores soft-deleted transactions", () => {
    const { ledger, card, food, f } = setup();
    const t = f.add({ type: "expense", wallet_id: card.id, amount: "100000", category_id: food.id, local_date: "2026-02-01" });
    t.deleted_at = "2026-02-02T00:00:00Z";
    expect(bal(ledger, card.id)).toBe("1000000.00");
  });
});

describe("internal transfers", () => {
  it("debits source and credits destination, conserving total", () => {
    const { ledger, card, cash, f } = setup();
    f.add({ type: "transfer", wallet_id: card.id, to_wallet_id: cash.id, amount: "300000", local_date: "2026-02-03" });
    expect(bal(ledger, card.id)).toBe("700000.00");
    expect(bal(ledger, cash.id)).toBe("500000.00");
  });

  it("is excluded from income and expense analytics", () => {
    const { ledger, card, cash, f } = setup();
    f.add({ type: "transfer", wallet_id: card.id, to_wallet_id: cash.id, amount: "300000", local_date: "2026-02-03" });
    const s = summarize(makeContext(ledger, "UZS"), { from: "2026-02-01", to: "2026-02-28" });
    expect(s.income).toBe(0n);
    expect(s.expense).toBe(0n);
    expect(s.transactionCount).toBe(0);
  });

  it("stores both amounts and the applied rate for cross-currency transfers", () => {
    const { ledger, card, usd, f } = setup();
    const t = f.add({ type: "transfer", wallet_id: card.id, to_wallet_id: usd.id, amount: "1270000", to_amount: "100", local_date: "2026-03-02" });
    expect(t.amount).toBe("1270000.00");
    expect(t.to_amount).toBe("100.00");
    expect(t.to_currency).toBe("USD");
    expect(t.transfer_rate).toBe("0.0000787402");
    expect(bal(ledger, usd.id)).toBe("200.00");
    expect(bal(ledger, card.id)).toBe("-270000.00");
  });

  it("computes the destination amount from rates when not given", () => {
    const { card, usd, f } = setup();
    const t = f.add({ type: "transfer", wallet_id: usd.id, to_wallet_id: card.id, amount: "10", local_date: "2026-02-10" });
    expect(t.to_amount).toBe("125000.00");
    void card;
  });

  it("rejects transfers to the same wallet", () => {
    const { card, f } = setup();
    expect(() => f.add({ type: "transfer", wallet_id: card.id, to_wallet_id: card.id, amount: "1", local_date: "2026-02-10" })).toThrow(TransactionError);
  });
});

describe("refunds and reversals", () => {
  it("a refund returns money and reduces spending in the original category", () => {
    const { ledger, card, food, f } = setup();
    const e = f.add({ type: "expense", wallet_id: card.id, amount: "200000", category_id: food.id, local_date: "2026-02-03" });
    const r = f.add({ type: "refund", wallet_id: card.id, amount: "50000", related_id: e.id, local_date: "2026-02-04" });
    expect(r.direction).toBe("in");
    expect(r.category_id).toBe(food.id);
    expect(bal(ledger, card.id)).toBe("850000.00");
    const s = summarize(makeContext(ledger, "UZS"), { from: "2026-02-01", to: "2026-02-28" });
    expect(toAmountString(s.expense)).toBe("150000.00");
    expect(toAmountString(s.expenseByCategory[0].amount)).toBe("150000.00");
  });

  it("refunds cannot exceed the original amount", () => {
    const { card, food, f } = setup();
    const e = f.add({ type: "expense", wallet_id: card.id, amount: "100000", category_id: food.id, local_date: "2026-02-03" });
    f.add({ type: "refund", wallet_id: card.id, amount: "60000", related_id: e.id, local_date: "2026-02-04" });
    expect(() => f.add({ type: "refund", wallet_id: card.id, amount: "50000", related_id: e.id, local_date: "2026-02-05" })).toThrow("exceeds_original");
  });

  it("an expense reversal fully cancels its effect", () => {
    const { ledger, card, food, f } = setup();
    const e = f.add({ type: "expense", wallet_id: card.id, amount: "120000", category_id: food.id, local_date: "2026-02-03" });
    f.add({ type: "reversal", wallet_id: card.id, amount: "120000", related_id: e.id, local_date: "2026-02-03" });
    expect(bal(ledger, card.id)).toBe("1000000.00");
    const s = summarize(makeContext(ledger, "UZS"), { from: "2026-02-01", to: "2026-02-28" });
    expect(s.expense).toBe(0n);
  });

  it("an income reversal reduces income and takes money back", () => {
    const { ledger, card, salary, f } = setup();
    const i = f.add({ type: "income", wallet_id: card.id, amount: "3000000", category_id: salary.id, local_date: "2026-02-03" });
    const r = f.add({ type: "reversal", wallet_id: card.id, amount: "3000000", related_id: i.id, local_date: "2026-02-04" });
    expect(r.direction).toBe("out");
    expect(bal(ledger, card.id)).toBe("1000000.00");
    expect(summarize(makeContext(ledger, "UZS"), { from: "2026-02-01", to: "2026-02-28" }).income).toBe(0n);
  });

  it("reversal must cancel the full outstanding amount", () => {
    const { card, food, f } = setup();
    const e = f.add({ type: "expense", wallet_id: card.id, amount: "100000", category_id: food.id, local_date: "2026-02-03" });
    expect(() => f.add({ type: "reversal", wallet_id: card.id, amount: "1000", related_id: e.id, local_date: "2026-02-03" })).toThrow("reversal_full_amount");
  });
});

describe("multi-currency snapshots", () => {
  it("stores the rate used at creation and keeps history stable when new rates arrive", () => {
    const { ledger, usd, salary, f } = setup();
    const t = f.add({ type: "income", wallet_id: usd.id, amount: "200", category_id: salary.id, local_date: "2026-02-10" });
    expect(t.rate_to_base).toBe("12500");
    expect(t.base_amount).toBe("2500000.00");
    // A later rate for the same date range must not rewrite February's report.
    ledger.rates.push(rate("USD", "99999", "2026-02-01", { created_at: "2026-04-01T00:00:00Z" }));
    const s = summarize(makeContext(ledger, "UZS"), { from: "2026-02-01", to: "2026-02-28" });
    expect(toAmountString(s.income)).toBe("2500000.00");
  });

  it("net worth converts balances at the latest rate in the base currency", () => {
    const { ledger } = setup();
    const nw = netWorth(ledger, "UZS", "2026-03-05");
    // 1,000,000 + 200,000 + 100 USD × 12,700
    expect(toAmountString(nw.total)).toBe("2470000.00");
    const nwUsd = netWorth(ledger, "USD", "2026-03-05");
    expect(toAmountString(nwUsd.total)).toBe("194.49");
  });

  it("reports in another base via historical rates on the transaction date", () => {
    const { ledger, card, food, f } = setup();
    f.add({ type: "expense", wallet_id: card.id, amount: "1250000", category_id: food.id, local_date: "2026-02-10" });
    const s = summarize({ ledger, base: "USD", book: new RateBook(ledger.rates) }, { from: "2026-02-01", to: "2026-02-28" });
    expect(toAmountString(s.expense)).toBe("100.00");
  });
});

describe("goal contributions", () => {
  it("move wallet money into a goal without counting as spending", () => {
    const { ledger, card } = setup();
    const g = goal({ target_amount: "5000000.00" });
    ledger.goals.push(g);
    ledger.contributions.push(contribution(g.id, "400000.00", "2026-02-02", { wallet_id: card.id, wallet_amount: "400000.00" }));
    ledger.contributions.push(contribution(g.id, "100000.00", "2026-02-09", { wallet_id: card.id, wallet_amount: "100000.00", kind: "withdrawal" }));
    expect(toAmountString(goalSaved(g.id, ledger.contributions))).toBe("300000.00");
    expect(bal(ledger, card.id)).toBe("700000.00");
    const s = summarize(makeContext(ledger, "UZS"), { from: "2026-02-01", to: "2026-02-28" });
    expect(s.expense).toBe(0n);
    expect(s.income).toBe(0n);
  });
});
