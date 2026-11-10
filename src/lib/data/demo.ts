/**
 * Demo data generator: three months of realistic Uzbekistan-context records.
 * Written ONLY to the separate demo database (never synced, never mixed with
 * personal data). Deterministic for a given "today" so charts are stable.
 */
import { SYSTEM_CATEGORIES } from "../domain/defaults";
import { addDays, addMonths, daysInMonth, monthKey } from "../domain/dates";
import { RateBook } from "../domain/rates";
import { buildTransaction, type TransactionDraft } from "../domain/transactions";
import type { Budget, ExchangeRate, Goal, GoalContribution, Locale, Recurring, Transaction, Wallet } from "../domain/types";
import { applyRate, parseAmount, ratio, toAmountString } from "../money/money";
import type { SoqqaDB } from "./db";
import { defaultPreferences, PREFS_ID, Repo, systemCategoryId } from "./repo";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cat = (key: string) => systemCategoryId(SYSTEM_CATEGORIES.findIndex((c) => c.key === key));

export async function loadDemoData(db: SoqqaDB, today: string, locale: Locale): Promise<void> {
  if (db.kind !== "demo") throw new Error("Demo data can only be written to the demo database");
  const repo = new Repo(db);
  await repo.wipe();
  await repo.ensureSeeded();

  const rnd = mulberry32(20261109);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const between = (lo: number, hi: number, step = 1000) => Math.round((lo + rnd() * (hi - lo)) / step) * step;
  let idn = 0;
  const id = () => {
    idn++;
    const hex = idn.toString(16).padStart(12, "0");
    return `d0000000-0000-4000-8000-${hex}`;
  };
  const nowIso = new Date().toISOString();
  const base = { created_at: nowIso, updated_at: nowIso, deleted_at: null, version: 0 };

  const start = `${monthKey(addMonths(today, -2))}-01`;

  // Rates (seed snapshots, clearly demo).
  const rates: ExchangeRate[] = [];
  const usdSteps = ["12610", "12680", "12755"];
  const eurSteps = ["13690", "13745", "13820"];
  const rubSteps = ["152.4", "154.1", "156.8"];
  for (let i = 0; i < 3; i++) {
    const d = `${monthKey(addMonths(start, i))}-01`;
    rates.push({ id: id(), ...base, currency: "USD", uzs_per_unit: usdSteps[i], effective_date: d, source: "seed" });
    rates.push({ id: id(), ...base, currency: "EUR", uzs_per_unit: eurSteps[i], effective_date: d, source: "seed" });
    rates.push({ id: id(), ...base, currency: "RUB", uzs_per_unit: rubSteps[i], effective_date: d, source: "seed" });
  }

  const wallets: Wallet[] = [
    { id: id(), ...base, name: "Asosiy karta", currency: "UZS", icon: "credit-card", color: "#3987e5", opening_balance: "6400000.00", spendable: true, archived: false, sort: 0 },
    { id: id(), ...base, name: "Naqd pul", currency: "UZS", icon: "banknote", color: "#199e70", opening_balance: "450000.00", spendable: true, archived: false, sort: 1 },
    { id: id(), ...base, name: "USD Jamg'arma", currency: "USD", icon: "piggy-bank", color: "#c98500", opening_balance: "1200.00", spendable: false, archived: false, sort: 2 },
    { id: id(), ...base, name: "Online Wallet", currency: "UZS", icon: "smartphone", color: "#9085e9", opening_balance: "150000.00", spendable: true, archived: false, sort: 3 },
  ];
  const [card, cash, usd, online] = wallets;

  const txs: Transaction[] = [];
  const book = new RateBook(rates);
  const ctx = () => ({
    wallets,
    transactions: txs,
    base: "UZS" as const,
    book,
    timezone: "Asia/Tashkent",
    now: new Date(),
    newId: id,
  });
  const add = (d: Omit<TransactionDraft, "source">) => {
    if (d.local_date > today) return null;
    const tx = buildTransaction({ ...d, source: "demo" }, ctx());
    txs.push(tx);
    return tx;
  };

  // Day by day simulation.
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const dom = Number(d.slice(8, 10));
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    const monthIdx = Math.round((Date.parse(`${monthKey(d)}-01`) - Date.parse(start)) / (30 * 86400000));
    const foodBoost = monthIdx === 1 ? 1.3 : 1; // a "heavier" previous month for meaningful comparisons

    if (dom === 1) add({ type: "expense", wallet_id: card.id, amount: "2400000", category_id: cat("housing"), local_date: d, note: "Kvartira ijarasi" });
    if (dom === 3) add({ type: "expense", wallet_id: card.id, amount: "650000", category_id: cat("education"), local_date: d, note: "Ingliz tili kursi", merchant: "Cambridge LC" });
    if (dom === 5) add({ type: "income", wallet_id: card.id, amount: "11500000", category_id: cat("salary"), local_date: d, note: "Oylik maosh" });
    if (dom === 6) add({ type: "transfer", wallet_id: card.id, to_wallet_id: cash.id, amount: "600000", local_date: d, note: "Naqd yechish" });
    if (dom === 20) add({ type: "transfer", wallet_id: card.id, to_wallet_id: cash.id, amount: "500000", local_date: d, note: "Naqd yechish" });
    if (dom === 8) {
      const usdAmt = 100;
      const r = book.resolve("USD", "UZS", d).rate;
      add({ type: "transfer", wallet_id: card.id, to_wallet_id: usd.id, amount: toAmountString(applyRate(parseAmount(String(usdAmt)), r)), to_amount: String(usdAmt), local_date: d, note: "Dollar sotib olish" });
    }
    if (dom === 10) add({ type: "expense", wallet_id: card.id, amount: String(between(280000, 420000, 5000)), category_id: cat("utilities"), local_date: d, note: "Kommunal to'lovlar" });
    if (dom === 12) add({ type: "expense", wallet_id: online.id, amount: "120000", category_id: cat("utilities"), local_date: d, note: "Internet", merchant: "Uzonline" });
    if (dom === 14) add({ type: "expense", wallet_id: online.id, amount: "65000", category_id: cat("subscriptions"), local_date: d, merchant: "Spotify" });
    if (dom === 16 && monthIdx !== 2) add({ type: "income", wallet_id: usd.id, amount: String(between(380, 620, 10)), category_id: cat("freelance"), local_date: d, note: "Upwork loyiha", merchant: "Upwork" });
    if (dom === 25) add({ type: "income", wallet_id: online.id, amount: "300000", category_id: cat("other_income"), local_date: d, note: "Cashback va bonuslar" });

    // Weekday lunch (tushlik)
    if (dow >= 1 && dow <= 5 && rnd() < 0.85) {
      add({ type: "expense", wallet_id: rnd() < 0.55 ? cash.id : card.id, amount: String(Math.round(between(32000, 62000) * foodBoost / 1000) * 1000), category_id: cat("food"), local_date: d, note: "Tushlik", merchant: pick(["Evos", "Oqtepa Lavash", "Milliy taomlar", "Choyxona", "Safia"]) });
    }
    // Weekend dinner out
    if ((dow === 0 || dow === 6) && rnd() < 0.5) add({ type: "expense", wallet_id: card.id, amount: String(Math.round(between(90000, 240000) * foodBoost / 1000) * 1000), category_id: cat("food"), local_date: d, note: "Kechki ovqat", merchant: pick(["Caravan", "Bellissimo", "Les Ailes"]) });
    // Taxi
    if (rnd() < 0.55) add({ type: "expense", wallet_id: card.id, amount: String(between(14000, 42000)), category_id: cat("transport"), local_date: d, note: "Taksi", merchant: "Yandex Go" });
    if (dow === 1 && rnd() < 0.6) add({ type: "expense", wallet_id: cash.id, amount: "50000", category_id: cat("transport"), local_date: d, note: "Metro kartasi" });
    // Groceries
    if ((dow === 6 || dow === 3) && rnd() < 0.85) add({ type: "expense", wallet_id: card.id, amount: String(between(110000, 290000)), category_id: cat("groceries"), local_date: d, merchant: pick(["Korzinka", "Makro", "Havas"]) });
    if (rnd() < 0.12) add({ type: "expense", wallet_id: cash.id, amount: String(between(25000, 80000)), category_id: cat("groceries"), local_date: d, note: "Bozor" });
    // Shopping, entertainment, health
    if (rnd() < 0.07) add({ type: "expense", wallet_id: card.id, amount: String(between(150000, 850000, 10000)), category_id: cat("shopping"), local_date: d, merchant: pick(["Uzum Market", "Wildberries", "Samarqand Darvoza"]) });
    if (rnd() < 0.06) add({ type: "expense", wallet_id: card.id, amount: String(between(60000, 180000)), category_id: cat("entertainment"), local_date: d, note: pick(["Kino", "Bouling", "Konsert"]) });
    if (rnd() < 0.04) add({ type: "expense", wallet_id: cash.id, amount: String(between(30000, 160000)), category_id: cat("health"), local_date: d, note: "Dorixona" });
    if (rnd() < 0.08) add({ type: "expense", wallet_id: cash.id, amount: String(between(8000, 22000)), category_id: cat("food"), local_date: d, note: "Kofe", merchant: pick(["Starbucks", "Bon!", "Coffee House"]) });
  }

  // One anomaly and one refund for realism.
  const anomalyDay = addDays(today, -6) >= start ? addDays(today, -6) : today;
  add({ type: "expense", wallet_id: card.id, amount: "780000", category_id: cat("food"), local_date: anomalyDay, note: "Tug'ilgan kun kechasi", merchant: "Caravan" });
  const shoe = add({ type: "expense", wallet_id: card.id, amount: "640000", category_id: cat("shopping"), local_date: addDays(today, -20) >= start ? addDays(today, -20) : start, note: "Krossovka", merchant: "Uzum Market" });
  if (shoe) add({ type: "refund", wallet_id: card.id, amount: "640000", related_id: shoe.id, local_date: addDays(shoe.local_date, 3) > today ? today : addDays(shoe.local_date, 3), note: "O'lchami to'g'ri kelmadi" });

  // Goals & contributions (wallet-linked: move money, never income/expense).
  const goals: Goal[] = [
    { id: id(), ...base, name: "MacBook Pro", target_amount: "32000000.00", currency: "UZS", target_date: addMonths(today, 7), monthly_target: null, icon: "laptop", color: "#9085e9", status: "active" },
    { id: id(), ...base, name: "Sayohat — Istanbul", target_amount: "1500.00", currency: "USD", target_date: addMonths(today, 5), monthly_target: "250.00", icon: "plane", color: "#3987e5", status: "active" },
    { id: id(), ...base, name: "Favqulodda jamg'arma", target_amount: "20000000.00", currency: "UZS", target_date: null, monthly_target: "1000000.00", icon: "shield", color: "#199e70", status: "active" },
  ];
  const contributions: GoalContribution[] = [];
  for (let i = 0; i < 3; i++) {
    const d = `${monthKey(addMonths(start, i))}-07`;
    if (d > today) continue;
    contributions.push({ id: id(), ...base, goal_id: goals[0].id, kind: "contribution", amount: "1500000.00", wallet_id: card.id, wallet_amount: "1500000.00", rate: "1", local_date: d, note: "" });
    contributions.push({ id: id(), ...base, goal_id: goals[2].id, kind: "contribution", amount: "600000.00", wallet_id: card.id, wallet_amount: "600000.00", rate: "1", local_date: d, note: "" });
    if (i > 0) contributions.push({ id: id(), ...base, goal_id: goals[1].id, kind: "contribution", amount: "150.00", wallet_id: usd.id, wallet_amount: "150.00", rate: ratio(parseAmount("150"), parseAmount("150")), local_date: d, note: "" });
  }

  const budgets: Budget[] = [
    ["food", "1600000"], ["transport", "650000"], ["groceries", "1500000"], ["shopping", "700000"], ["entertainment", "300000"],
  ].map(([k, amount]) => ({ id: id(), ...base, category_id: cat(k), amount: `${amount}.00`, currency: "UZS", alert_threshold: 0.8 }));

  const nextOn = (day: number) => {
    const [y, m] = today.split("-").map(Number);
    const thisMonth = `${today.slice(0, 7)}-${String(Math.min(day, daysInMonth(y, m))).padStart(2, "0")}`;
    return thisMonth > today ? thisMonth : addMonths(thisMonth, 1, day);
  };
  const recurring: Recurring[] = [
    { id: id(), ...base, name: "Kvartira ijarasi", type: "expense", amount: "2400000.00", currency: "UZS", wallet_id: card.id, category_id: cat("housing"), frequency: "monthly", start_date: start, next_date: nextOn(1), active: true },
    { id: id(), ...base, name: "Internet", type: "expense", amount: "120000.00", currency: "UZS", wallet_id: online.id, category_id: cat("utilities"), frequency: "monthly", start_date: `${start.slice(0, 7)}-12`, next_date: nextOn(12), active: true },
    { id: id(), ...base, name: "Spotify", type: "expense", amount: "65000.00", currency: "UZS", wallet_id: online.id, category_id: cat("subscriptions"), frequency: "monthly", start_date: `${start.slice(0, 7)}-14`, next_date: nextOn(14), active: true },
    { id: id(), ...base, name: "Ingliz tili kursi", type: "expense", amount: "650000.00", currency: "UZS", wallet_id: card.id, category_id: cat("education"), frequency: "monthly", start_date: `${start.slice(0, 7)}-03`, next_date: nextOn(3), active: true },
    { id: id(), ...base, name: "Oylik maosh", type: "income", amount: "11500000.00", currency: "UZS", wallet_id: card.id, category_id: cat("salary"), frequency: "monthly", start_date: `${start.slice(0, 7)}-05`, next_date: nextOn(5), active: true },
  ];

  const prefs = { ...defaultPreferences(nowIso), id: PREFS_ID, locale, onboarded: true };

  await db.transaction("rw", [db.wallets, db.transactions, db.exchange_rates, db.goals, db.goal_contributions, db.budgets, db.recurring, db.preferences, db.meta], async () => {
    await db.exchange_rates.bulkPut(rates);
    await db.wallets.bulkPut(wallets);
    await db.transactions.bulkPut(txs);
    await db.goals.bulkPut(goals);
    await db.goal_contributions.bulkPut(contributions);
    await db.budgets.bulkPut(budgets);
    await db.recurring.bulkPut(recurring);
    await db.preferences.put(prefs);
    await db.setMeta("demo_loaded_at", nowIso);
  });
}
