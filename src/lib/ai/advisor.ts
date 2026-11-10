/**
 * Offline financial advisor: deterministic intent detection + calculations.
 * Every number comes from the ledger; estimates are labelled as estimates.
 * The engine returns translation keys with formatted params so it stays
 * language-neutral and testable.
 */
import { mulBps, sum, toAmountString, type Cents } from "../money/money";
import { averages, budgetStatuses, compareMonths, makeContext, summarize, spendingVelocity, type AnalyticsContext } from "../domain/analytics";
import { daysInMonth, monthEnd, monthKey, monthStart, shiftMonthKey } from "../domain/dates";
import { goalProgress } from "../domain/planning";
import { smallExpenseOpportunity } from "../domain/insights";
import type { Currency, Ledger, LocalDate } from "../domain/types";

export type AdvisorIntent = "where" | "why" | "save" | "reduce" | "goal" | "compare" | "category" | "top_increase" | "budget" | "improve";

export interface AdvisorLine {
  key: string;
  params?: Record<string, string | number>;
}

export interface AdvisorAnswer {
  intent: AdvisorIntent | null;
  facts: AdvisorLine[];
  estimates: AdvisorLine[];
  method: AdvisorLine | null;
  noData?: boolean;
}

export interface AdvisorFormatters {
  money: (c: Cents) => string;
  moneyIn: (c: Cents, currency: Currency) => string;
  pct: (v: number, signed?: boolean) => string;
  category: (id: string | null) => string;
  day: (d: LocalDate) => string;
  month: (key: string) => string;
}

const INTENTS: [AdvisorIntent, RegExp][] = [
  ["top_increase", /eng ko'p oshgan|qaysi kategoriya oshdi|ko'proq oshdi|increased the most|grew the most|больше всего вырос|сильнее всего вырос/i],
  ["improve", /yaxshila|keyingi oy|nimani o'zgartir|improve|next month|what should i change|улучш|следующ(ий|ем) месяц|что изменить/i],
  ["budget", /byudjet|rejadami|limit|budget|on track|бюджет|укладываюсь|лимит/i],
  ["category", /qancha sarfladim|qancha ketdi|how much did i spend|how much have i spent|сколько (я )?потратил|сколько ушло/i],
  ["goal", /maqsad|yeta olamanmi|yetishaman|afford|goal|цел|успею|накопить на/i],
  ["compare", /o'tgan oyga|taqqos|solishtir|compared|last month|vs last|прошл|сравнен/i],
  ["why", /nega|nima uchun|sababi|why|почему|из-за чего/i],
  ["reduce", /qisqart|kamaytir|reduce|cut back|which categor|сократ|урез/i],
  ["save", /teja|jamg'ar|ko'proq qold|save more|saving|how can i save|сэконом|отклад|накоп/i],
  ["where", /qayerga|nimaga ko'p|eng ko'p|where|most of my money|куда|на что уходит/i],
];

/** Words that point at built-in categories, in all three languages. */
const CATEGORY_WORDS: Record<string, RegExp> = {
  food: /restoran|kafe|ovqat|tushlik|ресторан|кафе|обед|еда|restaurant|cafe|eating out|lunch|food/i,
  transport: /taksi|transport|metro|такси|транспорт|метро|taxi|bus/i,
  groceries: /oziq|bozor|supermarket|продукт|рынок|grocer/i,
  shopping: /xarid|kiyim|покупк|одежд|shopping|clothes/i,
  housing: /ijara|uy-joy|аренд|жиль|rent|housing/i,
  utilities: /kommunal|svet|коммунал|utilit|electricity/i,
  entertainment: /ko'ngilochar|kino|развлеч|кино|entertainment|movies/i,
  health: /dori|shifokor|sog'liq|лекарств|врач|здоров|health|doctor|pharmacy/i,
  education: /ta'lim|o'qish|kurs|образован|учёб|курс|education|course|tuition/i,
  subscriptions: /obuna|подписк|subscription/i,
  travel: /sayohat|путешеств|travel|trip/i,
};

export function matchCategory(question: string, ledger: Ledger, label: (id: string | null) => string): string | null {
  const q = question.toLowerCase().replace(/[\u2018\u2019\u02bb\u02bc`]/g, "'");
  const expense = ledger.categories.filter((c) => c.kind === "expense" && !c.archived);
  for (const c of expense) {
    const name = label(c.id).toLowerCase();
    if (name.length >= 3 && q.includes(name)) return c.id;
  }
  for (const c of expense) if (c.system_key && CATEGORY_WORDS[c.system_key]?.test(q)) return c.id;
  return null;
}

export function detectIntent(question: string): AdvisorIntent | null {
  const q = question.toLowerCase().replace(/[‘’ʻʼ`]/g, "'");
  for (const [intent, re] of INTENTS) if (re.test(q)) return intent;
  return null;
}

export function answerQuestion(intent: AdvisorIntent | null, ledger: Ledger, base: Currency, today: LocalDate, f: AdvisorFormatters, question = ""): AdvisorAnswer {
  if (!intent) return { intent: null, facts: [], estimates: [], method: null };
  if (ledger.transactions.length === 0) return { intent, facts: [], estimates: [], method: null, noData: true };
  const ctx = makeContext(ledger, base);
  const month = monthKey(today);
  const facts: AdvisorLine[] = [];
  const estimates: AdvisorLine[] = [];

  switch (intent) {
    case "where": {
      // Use the current month if it has spending, else the previous month.
      let from = monthStart(month);
      let to = today;
      let s = summarize(ctx, { from, to });
      if (s.expense === 0n) {
        const prev = shiftMonthKey(month, -1);
        from = monthStart(prev);
        to = monthEnd(prev);
        s = summarize(ctx, { from, to });
      }
      if (s.expense === 0n) return { intent, facts, estimates, method: null, noData: true };
      facts.push({ key: "answers.where_total", params: { period: `${f.day(from)} — ${f.day(to)}`, total: f.money(s.expense) } });
      s.expenseByCategory.slice(0, 5).forEach((c, i) => facts.push({ key: "answers.where_item", params: { rank: i + 1, category: f.category(c.categoryId), amount: f.money(c.amount), pct: f.pct(c.share) } }));
      return { intent, facts, estimates, method: { key: "answers.where_method" } };
    }
    case "why":
    case "compare": {
      const cmp = compareMonths(ctx, month, today);
      if (intent === "compare") {
        facts.push({ key: "answers.compare_income", params: { prev: f.money(cmp.previous.income), cur: f.money(cmp.current.income), pct: cmp.incomeChange === null ? "—" : f.pct(cmp.incomeChange, true) } });
        facts.push({ key: "answers.compare_expense", params: { prev: f.money(cmp.previousToDate), cur: f.money(cmp.current.expense), pct: cmp.expenseChange === null ? "—" : f.pct(cmp.expenseChange, true) } });
        facts.push({ key: "answers.compare_net", params: { prev: f.money(cmp.previous.net), cur: f.money(cmp.current.net) } });
        const v = spendingVelocity(ctx, today);
        estimates.push({ key: "answers.projection", params: { amount: f.money(v.projectedMonth) } });
        return { intent, facts, estimates, method: { key: "answers.compare_method" } };
      }
      const cur = cmp.current.expense;
      const prev = cmp.previousToDate;
      if (cur === 0n && prev === 0n) return { intent, facts, estimates, method: null, noData: true };
      facts.push({
        key: cur >= prev ? "answers.why_more" : "answers.why_less",
        params: { date: f.day(today), cur: f.money(cur), prev: f.money(prev), pct: cmp.expenseChange === null ? "—" : f.pct(cmp.expenseChange, true) },
      });
      // Category drivers, like-for-like.
      const dayOfMonth = Number(today.slice(8, 10));
      const prevKey = shiftMonthKey(month, -1);
      const prevCut = `${prevKey}-${String(Math.min(dayOfMonth, Number(monthEnd(prevKey).slice(8, 10)))).padStart(2, "0")}`;
      const a = summarize(ctx, { from: monthStart(month), to: today });
      const b = summarize(ctx, { from: monthStart(prevKey), to: prevCut });
      const ids = new Set([...a.expenseByCategory, ...b.expenseByCategory].map((c) => c.categoryId));
      const diffs = [...ids]
        .map((id) => {
          const ca = a.expenseByCategory.find((c) => c.categoryId === id)?.amount ?? 0n;
          const cb = b.expenseByCategory.find((c) => c.categoryId === id)?.amount ?? 0n;
          return { id, ca, cb, d: ca - cb };
        })
        .filter((x) => (cur >= prev ? x.d > 0n : x.d < 0n))
        .sort((x, y) => (cur >= prev ? Number(y.d - x.d) : Number(x.d - y.d)))
        .slice(0, 3);
      for (const x of diffs) facts.push({ key: "answers.why_item", params: { category: f.category(x.id), prev: f.money(x.cb), cur: f.money(x.ca), diff: (x.d > 0n ? "+" : "−") + f.money(x.d < 0n ? -x.d : x.d) } });
      return { intent, facts, estimates, method: { key: "answers.why_method" } };
    }
    case "save":
    case "reduce": {
      const avg = averages(ctx, month, 3);
      if (avg.avgMonthlyExpense === 0n) return { intent, facts, estimates, method: null, noData: true };
      const months: string[] = [];
      for (let i = 1; i <= avg.monthsCounted; i++) months.push(shiftMonthKey(month, -i));
      if (!months.length || avg.monthsCounted === 0) months.push(month);
      const per = new Map<string | null, Cents>();
      for (const m of months) {
        const s = summarize(ctx, { from: monthStart(m), to: monthEnd(m) });
        for (const c of s.expenseByCategory) per.set(c.categoryId, (per.get(c.categoryId) ?? 0n) + c.amount);
      }
      const n = BigInt(months.length);
      const wants = [...per.entries()]
        .map(([id, total]) => ({ id, avg: total / n, bucket: ledger.categories.find((c) => c.id === id)?.bucket ?? "wants" }))
        .filter((x) => x.bucket === "wants")
        .sort((x, y) => Number(y.avg - x.avg));
      if (intent === "save") {
        facts.push({ key: "answers.save_rate", params: { n: avg.monthsCounted, income: f.money(avg.avgMonthlyIncome), expense: f.money(avg.avgMonthlyExpense), pct: avg.savingsRate === null ? "—" : f.pct(avg.savingsRate) } });
        const cuts = wants.slice(0, 3).map((w) => ({ ...w, save: mulBps(w.avg, 2000) }));
        for (const c of cuts) estimates.push({ key: "answers.save_cut", params: { category: f.category(c.id), amount: f.money(c.save) } });
        if (cuts.length > 1) estimates.push({ key: "answers.save_total", params: { amount: f.money(sum(cuts.map((c) => c.save))) } });
        const small = smallExpenseOpportunity(ctx, today);
        if (small && small.kind === "small_expenses") estimates.push({ key: "insight.small_expenses", params: { pct: f.pct(small.reductionBps / 10000), amount: f.money(small.monthlySaving) } });
        return { intent, facts, estimates, method: { key: "answers.save_method" } };
      }
      const curS = summarize(ctx, { from: monthStart(month), to: today });
      for (const w of wants.slice(0, 4)) {
        const cur = curS.expenseByCategory.find((c) => c.categoryId === w.id)?.amount ?? 0n;
        facts.push({ key: "answers.reduce_item", params: { category: f.category(w.id), avg: f.money(w.avg), cur: f.money(cur) } });
      }
      if (wants[0]) estimates.push({ key: "answers.save_cut", params: { category: f.category(wants[0].id), amount: f.money(mulBps(wants[0].avg, 2000)) } });
      return { intent, facts, estimates, method: { key: "answers.reduce_method" } };
    }
    case "category": {
      const id = matchCategory(question, ledger, f.category);
      if (!id) {
        facts.push({ key: "answers.category_unknown" });
        return { intent, facts, estimates, method: null };
      }
      const cur = summarize(ctx, { from: monthStart(month), to: today, categoryIds: [id] });
      const prevKey = shiftMonthKey(month, -1);
      const prev = summarize(ctx, { from: monthStart(prevKey), to: monthEnd(prevKey), categoryIds: [id] });
      const prevSame = summarize(ctx, { from: monthStart(prevKey), to: sameDay(prevKey, today), categoryIds: [id] });
      facts.push({ key: "answers.category_spend", params: { category: f.category(id), cur: f.money(cur.expense), n: cur.transactionCount, prev: f.money(prev.expense), same: f.money(prevSame.expense) } });
      return { intent, facts, estimates, method: { key: "answers.category_method" } };
    }
    case "top_increase": {
      const diffs = categoryDiffs(ctx, month, today).filter((x) => x.d > 0n).slice(0, 3);
      if (!diffs.length) {
        facts.push({ key: "answers.top_increase_none" });
        return { intent, facts, estimates, method: { key: "answers.why_method" } };
      }
      for (const x of diffs) facts.push({ key: "answers.top_increase_item", params: { category: f.category(x.id), prev: f.money(x.cb), cur: f.money(x.ca), diff: f.money(x.d), pct: x.cb > 0n ? f.pct(Number(((x.ca - x.cb) * 10000n) / x.cb) / 10000, true) : "—" } });
      return { intent, facts, estimates, method: { key: "answers.why_method" } };
    }
    case "budget": {
      const statuses = budgetStatuses(ctx, month);
      if (!statuses.length) {
        facts.push({ key: "answers.budget_none" });
        return { intent, facts, estimates, method: null };
      }
      const [y, m] = month.split("-").map(Number);
      const dim = daysInMonth(y, m);
      const day = Number(today.slice(8, 10));
      facts.push({ key: "answers.budget_elapsed", params: { pct: f.pct(day / dim) } });
      for (const b of statuses) {
        facts.push({ key: "answers.budget_item", params: { category: f.category(b.budget.category_id), spent: f.money(b.spent), limit: f.money(b.limit), pct: f.pct(b.utilization) } });
        const projected = (b.spent * BigInt(dim)) / BigInt(day);
        if (b.spent <= b.limit && projected > b.limit && day < dim) estimates.push({ key: "answers.budget_projection", params: { category: f.category(b.budget.category_id), projected: f.money(projected), limit: f.money(b.limit) } });
      }
      const over = statuses.filter((b) => b.spent > b.limit).length;
      facts.push({ key: over ? "answers.budget_over_count" : "answers.budget_all_ok", params: { n: over } });
      return { intent, facts, estimates, method: { key: "answers.budget_method" } };
    }
    case "improve": {
      const diffs = categoryDiffs(ctx, month, today).filter((x) => x.d > 0n && x.cb > 0n).slice(0, 2);
      for (const x of diffs) {
        facts.push({ key: "answers.top_increase_item", params: { category: f.category(x.id), prev: f.money(x.cb), cur: f.money(x.ca), diff: f.money(x.d), pct: f.pct(Number(((x.ca - x.cb) * 10000n) / x.cb) / 10000, true) } });
        estimates.push({ key: "answers.improve_back", params: { category: f.category(x.id), amount: f.money(x.d) } });
      }
      for (const b of budgetStatuses(ctx, month).filter((b) => b.spent > b.limit)) facts.push({ key: "answers.improve_over", params: { category: f.category(b.budget.category_id), amount: f.money(b.spent - b.limit) } });
      const small = smallExpenseOpportunity(ctx, today);
      if (small && small.kind === "small_expenses") estimates.push({ key: "insight.small_expenses", params: { pct: f.pct(small.reductionBps / 10000), amount: f.money(small.monthlySaving) } });
      for (const g of ledger.goals.filter((g) => !g.deleted_at && g.status === "active")) {
        const p = goalProgress(g, ledger.contributions, today);
        if (p.state === "behind" && p.requiredMonthly) facts.push({ key: "answers.goal_item", params: { goal: g.name, required: f.moneyIn(p.requiredMonthly, g.currency), recent: f.moneyIn(p.recentMonthly, g.currency) } });
      }
      if (!facts.length && !estimates.length) facts.push({ key: "answers.improve_none" });
      return { intent, facts, estimates, method: { key: "answers.improve_method" } };
    }
    case "goal": {
      const avg = averages(ctx, month, 3);
      const surplus = avg.avgMonthlyIncome - avg.avgMonthlyExpense;
      facts.push({ key: "answers.goal_surplus", params: { surplus: f.money(surplus), n: avg.monthsCounted } });
      const goals = ledger.goals.filter((g) => !g.deleted_at && g.status === "active").map((g) => goalProgress(g, ledger.contributions, today));
      const withDeadline = goals.filter((g) => g.requiredMonthly !== null && g.state !== "completed");
      if (!withDeadline.length) {
        facts.push({ key: "answers.goal_none" });
        return { intent, facts, estimates, method: { key: "answers.goal_method" } };
      }
      let total = 0n;
      for (const g of withDeadline) {
        facts.push({ key: "answers.goal_item", params: { goal: g.goal.name, required: f.moneyIn(g.requiredMonthly!, g.goal.currency), recent: f.moneyIn(g.recentMonthly, g.goal.currency) } });
        try {
          total += ctx.book.convert(g.requiredMonthly!, g.goal.currency, base, today);
        } catch {
          /* missing rate: excluded from the total */
        }
      }
      if (total <= surplus) estimates.push({ key: "answers.goal_yes", params: { total: f.money(total) } });
      else estimates.push({ key: "answers.goal_no", params: { total: f.money(total), surplus: f.money(surplus), gap: f.money(total - surplus) } });
      return { intent, facts, estimates, method: { key: "answers.goal_method" } };
    }
  }
}

function sameDay(prevKey: string, today: LocalDate): LocalDate {
  return `${prevKey}-${String(Math.min(Number(today.slice(8, 10)), Number(monthEnd(prevKey).slice(8, 10)))).padStart(2, "0")}`;
}

/** Month-to-date category spending vs the same days of last month, largest increase first. */
function categoryDiffs(ctx: AnalyticsContext, month: string, today: LocalDate) {
  const prevKey = shiftMonthKey(month, -1);
  const a = summarize(ctx, { from: monthStart(month), to: today });
  const b = summarize(ctx, { from: monthStart(prevKey), to: sameDay(prevKey, today) });
  const ids = new Set([...a.expenseByCategory, ...b.expenseByCategory].map((c) => c.categoryId));
  return [...ids]
    .map((id) => {
      const ca = a.expenseByCategory.find((c) => c.categoryId === id)?.amount ?? 0n;
      const cb = b.expenseByCategory.find((c) => c.categoryId === id)?.amount ?? 0n;
      return { id, ca, cb, d: ca - cb };
    })
    .sort((x, y) => (y.d > x.d ? 1 : y.d < x.d ? -1 : 0));
}

/**
 * Privacy-preserving aggregate for the optional cloud advisor: month totals
 * and category totals only. No notes, merchants, wallet names or goal names.
 */
export function buildAdvisorSummary(ledger: Ledger, base: Currency, today: LocalDate, categoryLabel: (id: string | null) => string) {
  const ctx = makeContext(ledger, base);
  const month = monthKey(today);
  const toStr = (c: Cents) => toAmountString(c);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const m = shiftMonthKey(month, -i);
    const s = summarize(ctx, { from: monthStart(m), to: i === 0 ? today : monthEnd(m) });
    months.push({
      month: m,
      partial: i === 0,
      income: toStr(s.income),
      expense: toStr(s.expense),
      categories: s.expenseByCategory.slice(0, 10).map((c) => ({ category: categoryLabel(c.categoryId), amount: toStr(c.amount) })),
    });
  }
  const goals = ledger.goals
    .filter((g) => !g.deleted_at && g.status === "active")
    .map((g, i) => {
      const p = goalProgress(g, ledger.contributions, today);
      return { label: `goal_${i + 1}`, currency: g.currency, target: toStr(p.target), saved: toStr(p.saved), required_monthly: p.requiredMonthly === null ? null : toStr(p.requiredMonthly), months_left: p.monthsLeft };
    });
  return { base_currency: base, today, months, goals };
}
