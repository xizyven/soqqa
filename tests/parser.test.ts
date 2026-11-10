import { describe, expect, it } from "vitest";
import { parseTransactionText, type ParserWallet } from "@/lib/ai/parser";

const wallets: ParserWallet[] = [
  { id: "card", name: "Asosiy karta", currency: "UZS", icon: "credit-card" },
  { id: "cash", name: "Naqd pul", currency: "UZS", icon: "banknote" },
  { id: "usd", name: "USD Jamg'arma", currency: "USD", icon: "piggy-bank" },
];
const today = "2026-11-09";
const parse = (s: string) => parseTransactionText(s, { today, wallets });

describe("offline NLP transaction parser", () => {
  it("Uzbek expense with multiplier, currency and wallet", () => {
    const r = parse("Bugun tushlikka 45 ming so'm sarfladim, naqd puldan.");
    expect(r).toMatchObject({ amount: "45000.00", currency: "UZS", type: "expense", categoryKey: "food", walletId: "cash", date: "2026-11-09" });
    expect(r.recognized.wallet).toBe(true);
  });

  it("Uzbek income in dollars yesterday", () => {
    const r = parse("Kecha 200 dollar oylik oldim.");
    expect(r).toMatchObject({ amount: "200.00", currency: "USD", type: "income", categoryKey: "salary", date: "2026-11-08", walletId: "usd" });
  });

  it("Russian taxi expense", () => {
    const r = parse("Вчера потратил 150 тысяч сум на такси.");
    expect(r).toMatchObject({ amount: "150000.00", currency: "UZS", type: "expense", categoryKey: "transport", date: "2026-11-08" });
  });

  it("English freelance income with symbol", () => {
    const r = parse("Received $500 from freelance work.");
    expect(r).toMatchObject({ amount: "500.00", currency: "USD", type: "income", categoryKey: "freelance", date: today });
  });

  it("'sotib oldim' means bought, not received", () => {
    const r = parse("Korzinkadan 230 000 so'mlik mahsulot sotib oldim kartadan");
    expect(r).toMatchObject({ amount: "230000.00", type: "expense", categoryKey: "groceries", walletId: "card", merchant: "Korzinka" });
  });

  it("decimal millions and relative days", () => {
    expect(parse("3 kun oldin kontrakt uchun 1,5 mln to'ladim")).toMatchObject({ amount: "1500000.00", categoryKey: "education", date: "2026-11-06", type: "expense" });
    expect(parse("позавчера аптека 85 тыс")).toMatchObject({ amount: "85000.00", categoryKey: "health", date: "2026-11-07" });
  });

  it("explicit dates and future-date year rollback", () => {
    expect(parse("05.11 yandex 32000").date).toBe("2026-11-05");
    expect(parse("25.12 sovg'a 100 ming").date).toBe("2025-12-25");
  });

  it("does not invent fields it cannot find", () => {
    const r = parse("nimadir");
    expect(r.amount).toBeNull();
    expect(r.categoryKey).toBeNull();
    expect(r.recognized.type).toBe(false);
  });
});
