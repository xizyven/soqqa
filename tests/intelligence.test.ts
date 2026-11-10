import { afterEach, describe, expect, it } from "vitest";
import { addDays } from "@/lib/domain/dates";
import { detectGaps, indexActivity, streaks } from "@/lib/domain/activity";
import { healthHistory, healthScore } from "@/lib/domain/health";
import { BADGES, evaluateBadges, newlyEarned } from "@/lib/domain/achievements";
import { monthlyInterest, simulatePayoff, type DebtInput } from "@/lib/domain/debt";
import { emergencyFund, payYourselfFirst, raiseSplit, sinkingFund, splitByBps, zeroBasedRemainder } from "@/lib/strategies/calc";
import { recommendStrategies } from "@/lib/strategies/recommend";
import { STRATEGIES } from "@/lib/strategies";
import { sanitizeReceipt, itemsNote } from "@/lib/ai/receipt";
import { answerQuestion, detectIntent, matchCategory, type AdvisorFormatters } from "@/lib/ai/advisor";
import { generateInsights } from "@/lib/domain/insights";
import { parseAmount, sum, toAmountString } from "@/lib/money/money";
import { SoqqaDB } from "@/lib/data/db";
import { achievementId, dayReviewId, Repo } from "@/lib/data/repo";
import type { Budget, DayReview, Ledger, Transaction } from "@/lib/domain/types";
import { category, emptyLedger, TxFactory, uid, wallet } from "./fixtures";

const UZS = (s: string) => parseAmount(s);
const T = "2026-01-01T00:00:00.000Z";
const sync = (id: string) => ({ id, created_at: T, updated_at: T, deleted_at: null, version: 0 });

/** A ledger with one wallet, food (wants) and rent (needs) categories, and a salary category. */
function base() {
  const w = wallet({ id: "w1", opening_balance: "100000000.00" });
  const food = category({ id: "food", system_key: "food", bucket: "wants" });
  const rent = category({ id: "rent", system_key: "housing", bucket: "needs", name: "Rent" });
  const sal = category({ id: "sal", kind: "income", system_key: "salary", bucket: null, name: "Salary" });
  const ledger = emptyLedger({ wallets: [w], categories: [food, rent, sal] });
  const f = new TxFactory(ledger);
  const spend = (date: string, amount: string, cat = "food") => f.add({ type: "expense", wallet_id: "w1", amount, category_id: cat, local_date: date, note: "", merchant: "" });
  const earn = (date: string, amount: string) => f.add({ type: "income", wallet_id: "w1", amount, category_id: "sal", local_date: date, note: "", merchant: "" });
  return { ledger, f, spend, earn };
}

const review = (date: string, status: DayReview["status"]): DayReview => ({ ...sync(dayReviewId(date)), local_date: date, status });

// --------------------------------------------------------------- activity & forgotten expenses

describe("forgotten-expense detection", () => {
  const today = "2026-03-20";

  function habitual(perDay: number, days = 28, skip: string[] = []) {
    const b = base();
    for (let i = days; i >= 1; i--) {
      const d = addDays(today, -i);
      if (skip.includes(d)) continue;
      for (let k = 0; k < perDay; k++) b.spend(d, "10000");
    }
    return b;
  }

  it("asks about today after the reminder hour only when nothing is recorded", () => {
    const { ledger } = habitual(3);
    const ix = indexActivity(ledger.transactions, []);
    expect(detectGaps(ix, today, { hour: 19, reminderHour: 20 })).toEqual([]);
    const gaps = detectGaps(ix, today, { hour: 21, reminderHour: 20 });
    expect(gaps.map((g) => g.reason)).toEqual(["none_today"]);
    expect(gaps[0].typical).toBe(3);
  });

  it("flags a missed day for a habitual recorder, but never a reviewed day", () => {
    const missed = addDays(today, -2);
    const { ledger } = habitual(3, 28, [missed]);
    const ix = indexActivity(ledger.transactions, []);
    expect(detectGaps(ix, today, { hour: 9, reminderHour: 20 })).toEqual([{ date: missed, reason: "missed_day", recorded: 0, typical: 3 }]);
    // "No spending that day" removes the prompt and counts the day as accounted.
    const ix2 = indexActivity(ledger.transactions, [review(missed, "no_spending")]);
    expect(detectGaps(ix2, today, { hour: 9, reminderHour: 20 })).toEqual([]);
  });

  it("flags unusually low activity relative to the user's own median", () => {
    const low = addDays(today, -1);
    const b = habitual(6, 28, [low]);
    b.spend(low, "5000");
    const gaps = detectGaps(indexActivity(b.ledger.transactions, []), today, { hour: 9, reminderHour: 20 });
    expect(gaps).toEqual([{ date: low, reason: "low_day", recorded: 1, typical: 6 }]);
  });

  it("does not raise false alarms for people who rarely record", () => {
    const b = base();
    for (let i = 28; i >= 1; i -= 7) b.spend(addDays(today, -i), "50000"); // weekly recorder
    const gaps = detectGaps(indexActivity(b.ledger.transactions, []), today, { hour: 22, reminderHour: 20 });
    expect(gaps).toEqual([]);
  });

  it("new users only get the gentle daily reminder, not gap accusations", () => {
    const b = base();
    b.spend(addDays(today, -3), "1000");
    const gaps = detectGaps(indexActivity(b.ledger.transactions, []), today, { hour: 21, reminderHour: 20 });
    expect(gaps.map((g) => g.reason)).toEqual(["none_today"]);
  });

  it("streaks count confirmed zero-spending days and survive an open today", () => {
    const b = base();
    b.spend(addDays(today, -3), "1000");
    b.spend(addDays(today, -1), "1000");
    const ix = indexActivity(b.ledger.transactions, [review(addDays(today, -2), "no_spending")]);
    const s = streaks(ix, today);
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
    const broken = streaks(indexActivity(b.ledger.transactions, []), today);
    expect(broken.current).toBe(1);
  });
});

// --------------------------------------------------------------- health score

describe("financial health score", () => {
  const today = "2026-03-20";
  function scenario(scale: bigint) {
    const b = base();
    for (const m of ["2025-12", "2026-01", "2026-02"]) {
      b.earn(`${m}-05`, toAmountString(UZS("5000000") * scale));
      for (let d = 1; d <= 28; d += 1) b.spend(`${m}-${String(d).padStart(2, "0")}`, toAmountString(UZS("100000") * scale));
    }
    for (let d = 1; d < 20; d++) b.spend(`2026-03-${String(d).padStart(2, "0")}`, toAmountString(UZS("100000") * scale));
    return b.ledger;
  }

  it("is bounded, explained by five factors, and independent of income level", () => {
    const small = healthScore(scenario(1n), "UZS", today, { reviews: [], plans: [] });
    const big = healthScore(scenario(10n), "UZS", today, { reviews: [], plans: [] });
    expect(small.factors.map((f) => f.key)).toEqual(["tracking", "budgets", "savings", "stability", "planning"]);
    expect(small.score).toBeGreaterThanOrEqual(0);
    expect(small.score).toBeLessThanOrEqual(100);
    expect(small.score).toBe(big.score);
    for (const f of small.factors) expect(f.points).toBeLessThanOrEqual(20);
  });

  it("rewards budgets that stay on pace and tells users without budgets how to improve", () => {
    const l = scenario(1n);
    const none = healthScore(l, "UZS", today, { reviews: [], plans: [] });
    expect(none.factors[1].points).toBe(0);
    expect(none.factors[1].tip).toBe("health.tip.budgets_create");
    const budget: Budget = { ...sync("b1"), category_id: "food", amount: "5000000.00", currency: "UZS", alert_threshold: 0.8 };
    const withBudget = healthScore({ ...l, budgets: [budget] }, "UZS", today, { reviews: [], plans: [] });
    expect(withBudget.factors[1].points).toBe(20);
    expect(withBudget.score).toBeGreaterThan(none.score);
  });

  it("produces reproducible month-end history", () => {
    const h = healthHistory(scenario(1n), "UZS", today, { reviews: [], plans: [] });
    expect(h.at(-1)!.date).toBe(today);
    expect(h.map((x) => x.date)).toContain("2026-02-28");
    expect(new Set(h.map((x) => x.date)).size).toBe(h.length);
  });
});

// --------------------------------------------------------------- achievements

describe("achievements", () => {
  it("tracks progress and never re-awards a persisted badge", () => {
    const b = base();
    for (let i = 0; i < 12; i++) b.spend(addDays("2026-03-20", -i), "1000");
    const badges = evaluateBadges(b.ledger, "UZS", "2026-03-20", [], []);
    const get = (k: string) => badges.find((x) => x.key === k)!;
    expect(get("first_tx").earned).toBe(true);
    expect(get("tx_10").earned).toBe(true);
    expect(get("streak_7").earned).toBe(true);
    expect(get("streak_30")).toMatchObject({ earned: false, current: 12, target: 30 });
    expect(newlyEarned(badges)).toEqual(["first_tx", "tx_10", "streak_7"]);
    const persisted = evaluateBadges(b.ledger, "UZS", "2026-03-20", [], [{ ...sync(achievementId("first_tx")), key: "first_tx", unlocked_at: T }]);
    expect(newlyEarned(persisted)).toEqual(["tx_10", "streak_7"]);
  });

  it("derives a distinct, stable id per badge", () => {
    const ids = BADGES.map((b) => achievementId(b.key));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(dayReviewId("2026-11-10")).toBe("00000000-0000-4000-9000-000020261110");
  });
});

// --------------------------------------------------------------- debt

describe("debt payoff", () => {
  const debts: DebtInput[] = [
    { id: "loan", name: "Loan", balance: UZS("4000000"), aprBps: 2000, minPayment: UZS("250000") },
    { id: "card", name: "Card", balance: UZS("10000000"), aprBps: 3000, minPayment: UZS("500000") },
  ];

  it("computes monthly interest exactly", () => {
    expect(monthlyInterest(UZS("1200000"), 2400)).toBe(UZS("24000"));
  });

  it("avalanche never pays more interest than snowball; orders differ as expected", () => {
    const a = simulatePayoff(debts, UZS("1200000"), "avalanche");
    const s = simulatePayoff(debts, UZS("1200000"), "snowball");
    expect(a.feasible && s.feasible).toBe(true);
    expect(a.totalInterest).toBeLessThanOrEqual(s.totalInterest);
    expect(a.payoffOrder[0].id).toBe("card");
    expect(s.payoffOrder[0].id).toBe("loan");
    // Everything borrowed plus interest is paid, to the minor unit.
    expect(a.totalPaid).toBe(UZS("14000000") + a.totalInterest);
    expect(s.totalPaid).toBe(UZS("14000000") + s.totalInterest);
  });

  it("handles zero interest and infeasible budgets", () => {
    const zero = simulatePayoff([{ id: "n", name: "Nasiya", balance: UZS("1200000"), aprBps: 0, minPayment: UZS("100000") }], UZS("300000"), "snowball");
    expect(zero).toMatchObject({ feasible: true, months: 4, totalInterest: 0n });
    expect(simulatePayoff(debts, UZS("700000"), "avalanche").problem).toBe("budget_below_minimums");
    const notAmortizing = simulatePayoff([{ id: "x", name: "X", balance: UZS("10000000"), aprBps: 6000, minPayment: UZS("100000") }], UZS("100000"), "avalanche");
    expect(notAmortizing.problem).toBe("not_amortizing");
  });
});

// --------------------------------------------------------------- strategy calculators

describe("strategy calculators", () => {
  it("splits always add back up exactly", () => {
    const odd = UZS("1000000.01");
    const parts = splitByBps(odd, [5000, 3000, 2000]);
    expect(sum(parts)).toBe(odd);
    expect(splitByBps(UZS("6000000"), [5000, 3000, 2000])).toEqual([UZS("3000000"), UZS("1800000"), UZS("1200000")]);
    expect(() => splitByBps(odd, [5000, 3000])).toThrow();
  });

  it("pay-yourself-first, zero-based, sinking, emergency and raise maths", () => {
    expect(payYourselfFirst(UZS("6000000"), 1500)).toEqual({ save: UZS("900000"), spend: UZS("5100000") });
    expect(zeroBasedRemainder(UZS("6000000"), [UZS("5000000"), UZS("1000000")])).toBe(0n);
    const s = sinkingFund(UZS("1000000"), 0n, "2026-01-15", "2026-04-15");
    expect(s).toEqual({ months: 3, monthly: UZS("333333.34"), remaining: UZS("1000000") });
    expect(sinkingFund(UZS("1000000"), UZS("1200000"), "2026-01-15", "2026-04-15").monthly).toBe(0n);
    expect(emergencyFund(UZS("3500000"), 3, UZS("1750000"))).toEqual({ target: UZS("10500000"), remaining: UZS("8750000"), coverageMonths: 0.5 });
    expect(raiseSplit(UZS("6000000"), UZS("7500000"), 5000)).toEqual({ raise: UZS("1500000"), save: UZS("750000"), lifestyle: UZS("750000") });
    expect(raiseSplit(UZS("6000000"), UZS("5000000"), 5000).raise).toBe(0n);
  });

  it("recommends sensibly and only suggests Profit First with a business", () => {
    expect(recommendStrategies({ income: "business", goal: "business", style: "detailed", debt: "none", reserve: "full", raise: "no" })[0].slug).toBe("profit-first");
    expect(recommendStrategies({ income: "regular", goal: "control", style: "reflective", debt: "none", reserve: "full", raise: "no" })[0].slug).toBe("kakeibo");
    const r = recommendStrategies({ income: "irregular", goal: "safety", style: "simple", debt: "none", reserve: "none", raise: "no" });
    expect(r[0].slug).toBe("emergency-fund");
    expect(r.every((x) => x.slug !== "profit-first")).toBe(true);
    expect(r[0].reasons).toContain("reserve_none");
  });
});

// --------------------------------------------------------------- strategy content

describe("strategy content", () => {
  function walkL(v: unknown, path: string, out: string[]) {
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("uz" in o && "ru" in o && "en" in o) {
        for (const k of ["uz", "ru", "en"]) if (typeof o[k] !== "string" || !(o[k] as string).trim()) out.push(`${path}.${k}`);
        return;
      }
      for (const [k, x] of Object.entries(o)) walkL(x, `${path}.${k}`, out);
    }
  }

  it("has ten strategies, every text in three languages, and references", () => {
    expect(STRATEGIES).toHaveLength(10);
    expect(new Set(STRATEGIES.map((s) => s.slug)).size).toBe(10);
    const missing: string[] = [];
    for (const s of STRATEGIES) {
      walkL(s, s.slug, missing);
      expect(s.references.length).toBeGreaterThan(0);
      expect(s.benefits.length).toBeGreaterThanOrEqual(2);
      expect(s.drawbacks.length).toBeGreaterThanOrEqual(2);
      expect(s.professions.length).toBeGreaterThanOrEqual(3);
      expect(s.example.rows.length).toBeGreaterThan(0);
    }
    expect(missing).toEqual([]);
  });

  it("examples are consistent with the calculators", () => {
    const r = STRATEGIES.find((s) => s.slug === "rule-50-30-20")!;
    expect(sum(r.example.rows.map((x) => x.amount))).toBe(UZS("6000000"));
    const z = STRATEGIES.find((s) => s.slug === "zero-based")!;
    expect(z.example.rows.at(-1)!.amount).toBe(0n);
    expect(STRATEGIES.find((s) => s.slug === "profit-first")!.businessOnly).toBe(true);
  });
});

// --------------------------------------------------------------- receipts

describe("receipt validation", () => {
  const ctx = { today: "2026-03-20", categoryKeys: ["groceries", "food"] };
  it("keeps printed values, rejects invented ones and flags mismatches", () => {
    const r = sanitizeReceipt(
      { isReceipt: true, merchant: "Korzinka", date: "2026-03-19", currency: "UZS", total: "125 000", items: [{ name: "Non", amount: "5,000" }, { name: "Sut", amount: "abc" }], categoryKey: "groceries" },
      ctx,
    );
    expect(r).toMatchObject({ total: "125000.00", date: "2026-03-19", dateFound: true, categoryKey: "groceries", totalMismatch: true });
    expect(r.items).toEqual([{ name: "Non", amount: "5000.00" }, { name: "Sut", amount: null }]);
  });

  it("never accepts future dates, unknown categories or zero totals", () => {
    const r = sanitizeReceipt({ isReceipt: true, merchant: "", date: "2027-01-01", currency: null, total: "0", items: [], categoryKey: "casino" }, ctx);
    expect(r).toMatchObject({ total: null, date: "2026-03-20", dateFound: false, categoryKey: null });
  });

  it("falls back to the item sum only when every item has an amount", () => {
    const r = sanitizeReceipt({ isReceipt: true, merchant: "X", date: null, currency: "UZS", total: null, items: [{ name: "A", amount: "1000" }, { name: "B", amount: "2500.50" }], categoryKey: null }, ctx);
    expect(r.total).toBe("3500.50");
    expect(itemsNote(Array.from({ length: 40 }, (_, i) => ({ name: `Mahsulot ${i}`, amount: null }))).length).toBeLessThanOrEqual(200);
  });
});

// --------------------------------------------------------------- advisor & warnings

describe("advisor and predictive warnings", () => {
  const today = "2026-03-20";
  const f: AdvisorFormatters = {
    money: (c) => toAmountString(c),
    moneyIn: (c) => toAmountString(c),
    pct: (v) => `${Math.round(v * 100)}%`,
    category: (id) => ({ food: "Ovqatlanish", rent: "Ijara" })[id ?? ""] ?? "—",
    day: (d) => d,
    month: (m) => m,
  };

  it("detects the new question types in three languages", () => {
    expect(detectIntent("Restoranlarga qancha sarfladim?")).toBe("category");
    expect(detectIntent("How much did I spend on restaurants?")).toBe("category");
    expect(detectIntent("Какая категория больше всего выросла? больше всего выросла")).toBe("top_increase");
    expect(detectIntent("Am I on track with my budget?")).toBe("budget");
    expect(detectIntent("Keyingi oy nimani yaxshilashim kerak?")).toBe("improve");
  });

  it("answers category questions from real records", () => {
    const b = base();
    b.spend("2026-02-10", "300000");
    b.spend("2026-02-25", "200000");
    b.spend("2026-03-05", "150000");
    b.spend("2026-03-12", "250000");
    expect(matchCategory("how much on restaurants", b.ledger, f.category)).toBe("food");
    const a = answerQuestion("category", b.ledger, "UZS", today, f, "Restoranlarga qancha sarfladim?");
    expect(a.facts[0]).toEqual({ key: "answers.category_spend", params: { category: "Ovqatlanish", cur: "400000.00", n: 2, prev: "500000.00", same: "300000.00" } });
  });

  it("warns about budget pace and category growth with valid maths", () => {
    const b = base();
    b.spend("2026-02-05", "100000");
    b.spend("2026-03-05", "1200000");
    const budget: Budget = { ...sync("b1"), category_id: "food", amount: "2000000.00", currency: "UZS", alert_threshold: 0.95 };
    const ledger: Ledger = { ...b.ledger, budgets: [budget] };
    const ins = generateInsights(ledger, "UZS", "2026-03-10");
    const pace = ins.find((i) => i.kind === "budget_pace");
    expect(pace).toBeDefined();
    if (pace?.kind === "budget_pace") expect(pace.projected).toBe(UZS("3720000")); // 1.2M × 31 / 10
    const cat = ins.find((i) => i.kind === "category_pace");
    if (cat?.kind === "category_pace") expect(cat.change).toBe(11);
    expect(cat).toBeDefined();
  });
});

// --------------------------------------------------------------- repository

describe("repository: strategies, reviews, achievements", () => {
  const opened: SoqqaDB[] = [];
  afterEach(async () => {
    for (const db of opened.splice(0)) {
      db.close();
      await db.delete();
    }
  });
  const repo = async () => {
    const db = new SoqqaDB("personal", `intel_${uid("db")}`);
    opened.push(db);
    const r = new Repo(db);
    await r.ensureSeeded();
    return r;
  };

  it("keeps one plan per strategy and one review per day, each synced through the outbox", async () => {
    const r = await repo();
    const p1 = await r.saveStrategyPlan({ strategy: "emergency-fund", status: "active", configuration: { months: 3 } });
    const p2 = await r.saveStrategyPlan({ strategy: "emergency-fund", status: "active", configuration: { months: 6 } });
    expect(p2.id).toBe(p1.id);
    expect(p2.selected_at).toBe(p1.selected_at);
    await r.reviewDay({ local_date: "2026-03-01", status: "no_spending" });
    await r.reviewDay({ local_date: "2026-03-01", status: "complete" });
    const extras = await r.loadExtras();
    expect(extras.plans).toHaveLength(1);
    expect(extras.reviews).toEqual([expect.objectContaining({ local_date: "2026-03-01", status: "complete" })]);
    expect((await r.db.outbox.toArray()).map((o) => o.table).sort()).toEqual(["day_reviews", "strategy_plans"]);
    await expect(r.saveStrategyPlan({ strategy: "nope" as never, status: "active", configuration: {} })).rejects.toThrow();
  });

  it("unlocks each achievement at most once", async () => {
    const r = await repo();
    expect(await r.unlockAchievements(["first_tx", "tx_10", "first_tx"])).toEqual(["first_tx", "tx_10"]);
    expect(await r.unlockAchievements(["first_tx", "streak_7"])).toEqual(["streak_7"]);
    expect((await r.loadExtras()).achievements).toHaveLength(3);
  });

  it("stores notification settings in preferences", async () => {
    const r = await repo();
    const p = await r.savePreferences({ notification_settings: { reminder_hour: 21, budget: false } });
    expect(p.notification_settings).toEqual({ reminder_hour: 21, budget: false });
  });
});

// keep the Transaction import used for type-checking fixtures
export type _T = Transaction;
