import { afterEach, describe, expect, it } from "vitest";
import { SoqqaDB } from "@/lib/data/db";
import { Repo } from "@/lib/data/repo";
import { loadDemoData } from "@/lib/data/demo";
import { walletBalances } from "@/lib/domain/ledger";
import { makeContext, summarize } from "@/lib/domain/analytics";
import { generateInsights } from "@/lib/domain/insights";
import { answerQuestion, buildAdvisorSummary, detectIntent, type AdvisorFormatters } from "@/lib/ai/advisor";
import { evaluateExpression, pressKey } from "@/lib/money/expression";
import { toAmountString } from "@/lib/money/money";
import { transactionsCsv } from "@/lib/data/export";
import { DICTIONARIES, formatMoney } from "@/lib/i18n";
import { emptyLedger, wallet, category, TxFactory } from "./fixtures";

const opened: SoqqaDB[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
});

const fmt: AdvisorFormatters = {
  money: (c) => toAmountString(c),
  moneyIn: (c, cur) => `${toAmountString(c)} ${cur}`,
  pct: (v) => `${Math.round(v * 100)}%`,
  category: (id) => id ?? "none",
  day: (d) => d,
  month: (k) => k,
};

describe("demo data", () => {
  it("is written only to the demo database and produces meaningful analytics", async () => {
    const demo = new SoqqaDB("demo", "t_demo_1");
    const personal = new SoqqaDB("personal", "t_personal_1");
    opened.push(demo, personal);
    await new Repo(personal).ensureSeeded();
    await loadDemoData(demo, "2026-11-09", "uz");

    expect(await personal.transactions.count()).toBe(0);
    expect(await personal.outbox.count()).toBe(0);
    expect(await demo.outbox.count()).toBe(0);

    const ledger = await new Repo(demo).loadLedger();
    expect(ledger.wallets.length).toBe(4);
    expect(ledger.transactions.length).toBeGreaterThan(150);
    expect(ledger.transactions.every((t) => t.source === "demo")).toBe(true);
    expect(ledger.transactions.some((t) => t.type === "transfer")).toBe(true);
    expect(ledger.transactions.some((t) => t.type === "refund")).toBe(true);
    expect(ledger.contributions.length).toBeGreaterThan(0);
    const ctx = makeContext(ledger, "UZS");
    const oct = summarize(ctx, { from: "2026-10-01", to: "2026-10-31" });
    expect(oct.income > 11_000_000_00n).toBe(true);
    // Demo wallets stay solvent so safe-to-spend is meaningful.
    for (const b of walletBalances(ledger).values()) expect(b >= 0n).toBe(true);
    expect(oct.expense > 0n).toBe(true);
    expect(generateInsights(ledger, "UZS", "2026-11-09").length).toBeGreaterThan(0);
    // Balances are finite and deterministic.
    const b1 = [...walletBalances(ledger).values()].map(toAmountString);
    await loadDemoData(demo, "2026-11-09", "uz");
    const b2 = [...walletBalances(await new Repo(demo).loadLedger()).values()].map(toAmountString);
    expect(b2).toEqual(b1);
  });

  it("refuses to write demo data into the personal database", async () => {
    const personal = new SoqqaDB("personal", "t_personal_2");
    opened.push(personal);
    await expect(loadDemoData(personal, "2026-11-09", "uz")).rejects.toThrow();
  });
});

describe("offline advisor", () => {
  it("detects intents in three languages", () => {
    expect(detectIntent("Pulim asosan qayerga ketyapti?")).toBe("where");
    expect(detectIntent("Почему я потратил больше в этом месяце?")).toBe("why");
    expect(detectIntent("How can I save more?")).toBe("save");
    expect(detectIntent("Maqsadimga yeta olamanmi?")).toBe("goal");
    expect(detectIntent("Как мои дела по сравнению с прошлым месяцем?")).toBe("compare");
    expect(detectIntent("salom")).toBeNull();
  });

  it("answers from ledger data and labels estimates", () => {
    const card = wallet({ opening_balance: "0.00" });
    const food = category({ id: "food" });
    const salary = category({ id: "salary", kind: "income", bucket: null });
    const ledger = emptyLedger({ wallets: [card], categories: [food, salary] });
    const f = new TxFactory(ledger);
    f.add({ type: "income", wallet_id: card.id, amount: "5000000", category_id: salary.id, local_date: "2026-10-05" });
    f.add({ type: "expense", wallet_id: card.id, amount: "800000", category_id: food.id, local_date: "2026-10-10" });
    f.add({ type: "expense", wallet_id: card.id, amount: "300000", category_id: food.id, local_date: "2026-11-03" });
    const where = answerQuestion("where", ledger, "UZS", "2026-11-09", fmt);
    expect(where.facts[0]).toEqual({ key: "answers.where_total", params: { period: "2026-11-01 — 2026-11-09", total: "300000.00" } });
    expect(where.facts[1].params).toMatchObject({ category: "food", amount: "300000.00", pct: "100%" });
    const save = answerQuestion("save", ledger, "UZS", "2026-11-09", fmt);
    expect(save.facts[0].params).toMatchObject({ income: "5000000.00", expense: "800000.00" });
    expect(save.estimates[0]).toEqual({ key: "answers.save_cut", params: { category: "food", amount: "160000.00" } });
    expect(answerQuestion("where", emptyLedger(), "UZS", "2026-11-09", fmt).noData).toBe(true);
  });

  it("cloud summary contains only aggregates (no notes, merchants or names)", () => {
    const card = wallet({ name: "Secret card" });
    const food = category({ id: "food" });
    const ledger = emptyLedger({ wallets: [card], categories: [food] });
    new TxFactory(ledger).add({ type: "expense", wallet_id: card.id, amount: "1000", category_id: food.id, local_date: "2026-11-02", note: "private note", merchant: "Hidden LLC" });
    const json = JSON.stringify(buildAdvisorSummary(ledger, "UZS", "2026-11-09", () => "Food"));
    expect(json).not.toContain("private note");
    expect(json).not.toContain("Hidden LLC");
    expect(json).not.toContain("Secret card");
    expect(json).toContain('"expense":"1000.00"');
  });
});

describe("calculator amount input", () => {
  it("evaluates sums exactly", () => {
    expect(toAmountString(evaluateExpression("45000+12500−500")!)).toBe("57000.00");
    expect(toAmountString(evaluateExpression("0.1+0.2")!)).toBe("0.30");
    expect(evaluateExpression("12..5")).toBeNull();
    expect(evaluateExpression("abc")).toBeNull();
  });
  it("keypad guards", () => {
    expect(pressKey("", "000")).toBe("");
    expect(pressKey("", ".")).toBe("0.");
    expect(pressKey("12.34", "5")).toBe("12.34");
    expect(pressKey("12+", "−")).toBe("12−");
    expect(pressKey("120", "back")).toBe("12");
  });
});

describe("localization", () => {
  const keys = (o: unknown, p = ""): string[] =>
    typeof o === "string" || Array.isArray(o) ? [p] : Object.entries(o as object).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k));
  it("en and ru define exactly the same keys as uz", () => {
    const uz = keys(DICTIONARIES.uz).sort();
    expect(keys(DICTIONARIES.en).sort()).toEqual(uz);
    expect(keys(DICTIONARIES.ru).sort()).toEqual(uz);
  });
  it("formats money per locale from minor units", () => {
    expect(formatMoney(125000051n, "UZS", "uz")).toBe("1 250 001 so'm");
    expect(formatMoney(-123456n, "USD", "en")).toBe("−$1,234.56");
    expect(formatMoney(123456n, "RUB", "ru")).toBe("1 234,56 ₽");
    expect(formatMoney(450000000n, "UZS", "uz", { compact: true })).toBe("4,5 mln so'm");
  });
});

describe("csv export", () => {
  it("neutralises spreadsheet formula injection", () => {
    const card = wallet();
    const food = category();
    const ledger = emptyLedger({ wallets: [card], categories: [food] });
    new TxFactory(ledger).add({ type: "expense", wallet_id: card.id, amount: "10", category_id: food.id, local_date: "2026-11-02", note: "=HYPERLINK(\"x\")" });
    const csv = transactionsCsv(ledger.transactions, ledger, () => "Food");
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
