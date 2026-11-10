"use client";

import { useMemo, useState } from "react";
import { ChartColumn, Download, FileText, Printer } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useFinance } from "@/components/providers/use-finance";
import { Badge, Button, Card, cn, EmptyState, Progress, Select, Skeleton, PageHeader } from "@/components/ui/primitives";
import { Money } from "@/components/ui/money";
import { Sheet } from "@/components/ui/sheet";
import { CashflowChart, CategoryDonut, DailyBars, Legend, SpendingHeatmap, TrendLine, type DonutItem } from "@/components/charts/charts";
import { averages, categoryChanges, dailySeries, monthlySeries, rule503020, spendingHeatmap, spendingVelocity, summarize, type AnalyticsContext, type AnalyticsFilter } from "@/lib/domain/analytics";
import { addDays, daysBetween, daysInMonth, monthEnd, monthKey, monthStart, shiftMonthKey } from "@/lib/domain/dates";
import { buildMonthlyReport, type MonthlyReport } from "@/lib/domain/report";
import { formatDay, formatMoney, formatMonth, formatPercent } from "@/lib/i18n";
import { download } from "@/lib/data/export";
import { CURRENCIES, type Currency } from "@/lib/domain/types";
import type { Cents } from "@/lib/money/money";

type Range = "month" | "last3" | "last6" | "year" | "custom";

export default function AnalyticsPage() {
  const { t, ledger, today, locale, categoryName, prefs } = useApp();
  const f = useFinance();
  const [range, setRange] = useState<Range>("last3");
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState<"" | Currency>("");
  const [reportMonth, setReportMonth] = useState<string | null>(null);
  const base = prefs.base_currency;
  const month = monthKey(today);

  const period = useMemo(() => {
    switch (range) {
      case "month": return { from: monthStart(month), to: today };
      case "last3": return { from: monthStart(shiftMonthKey(month, -2)), to: today };
      case "last6": return { from: monthStart(shiftMonthKey(month, -5)), to: today };
      case "year": return { from: monthStart(shiftMonthKey(month, -11)), to: today };
      case "custom": return { from: from <= to ? from : to, to: from <= to ? to : from };
    }
  }, [range, month, today, from, to]);

  const filter: AnalyticsFilter = useMemo(
    () => ({ walletIds: walletId ? [walletId] : undefined, categoryIds: categoryId ? [categoryId] : undefined, currencies: currency ? [currency] : undefined }),
    [walletId, categoryId, currency],
  );
  const ctx = f.ctx;

  const data = useMemo(() => {
    const summary = summarize(ctx, { ...filter, ...period });
    const series = monthlySeries(ctx, monthKey(period.from), monthKey(period.to), filter);
    const span = daysBetween(period.from, period.to);
    const daily = dailySeries(ctx, span <= 62 ? period.from : addDays(period.to, -29), period.to, filter);
    const heat = spendingHeatmap(ctx, span >= 84 ? period.from : addDays(period.to, -111), period.to, filter);
    const avg = averages(ctx, month, 3, filter);
    const vel = spendingVelocity(ctx, today, filter);
    // Cumulative this month vs last month (like-for-like days).
    const curDaily = dailySeries(ctx, monthStart(month), today, filter);
    const prevKey = shiftMonthKey(month, -1);
    const prevDaily = dailySeries(ctx, monthStart(prevKey), monthEnd(prevKey), filter);
    const curCum: (Cents | null)[] = cumulative(curDaily.map((d) => d.expense));
    const prevCum = cumulative(prevDaily.map((d) => d.expense));
    const [y, m] = month.split("-").map(Number);
    while (curCum.length < daysInMonth(y, m)) curCum.push(null);
    return { summary, series, daily, heat, avg, vel, curCum, prevCum, changes: categoryChanges(ctx, month, filter), rule: rule503020(ctx, shiftMonthKey(month, -1)) };
  }, [ctx, filter, period, month, today]);

  const donut: DonutItem[] = data.summary.expenseByCategory.map((c) => {
    const cat = c.categoryId ? f.categoriesById.get(c.categoryId) : undefined;
    return { key: c.categoryId ?? "none", label: categoryName(cat), color: cat?.color ?? "#64748B", amount: c.amount, share: c.share };
  });

  if (!ledger) return <Skeleton className="h-96" />;
  const empty = ledger.transactions.length === 0;
  const largest = data.summary.largestExpense;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("analytics.title")}
        description={`${formatDay(period.from, locale, { year: true })} — ${formatDay(period.to, locale, { year: true })}`}
        actions={<Button variant="secondary" icon={<FileText size={15} />} onClick={() => setReportMonth(shiftMonthKey(month, -1))} disabled={empty}>{t("analytics.report")}</Button>}
      />
      <Card padded={false} className="no-print p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onChange={(e) => setRange(e.target.value as Range)} className="h-8 w-auto text-[13px]" aria-label={t("tx.period")}>
            {(["month", "last3", "last6", "year", "custom"] as const).map((r) => <option key={r} value={r}>{t(`analytics.range.${r}`)}</option>)}
          </Select>
          {range === "custom" && (
            <span className="flex items-center gap-1">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[13px] text-fg" aria-label={t("common.from")} />
              <span className="text-fg-3">–</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[13px] text-fg" aria-label={t("common.to")} />
            </span>
          )}
          <Select value={walletId} onChange={(e) => setWalletId(e.target.value)} className="h-8 w-auto max-w-[170px] text-[13px]" aria-label={t("tx.filterWallet")}>
            <option value="">{t("tx.filterWallet")}: {t("common.all")}</option>
            {ledger.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-8 w-auto max-w-[180px] text-[13px]" aria-label={t("tx.filterCategory")}>
            <option value="">{t("tx.filterCategory")}: {t("common.all")}</option>
            {ledger.categories.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
          </Select>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency | "")} className="h-8 w-auto text-[13px]" aria-label={t("common.currency")}>
            <option value="">{t("common.currency")}: {t("common.all")}</option>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </Card>

      {empty ? (
        <Card><EmptyState icon={<ChartColumn size={20} />} title={t("analytics.empty")} body={t("analytics.emptyHint")} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line shadow-[var(--shadow)] lg:grid-cols-4">
            <Metric label={t("dashboard.income")} value={<Money value={data.summary.income} currency={base} className="text-income" />} />
            <Metric label={t("dashboard.expenses")} value={<Money value={data.summary.expense} currency={base} className="text-expense" />} />
            <Metric label={t("analytics.savingsRate")} value={<span className="num">{data.summary.savingsRate === null ? "—" : formatPercent(data.summary.savingsRate, locale)}</span>} sub={data.summary.savingsRate === null ? t("analytics.noIncome") : undefined} />
            <Metric label={t("analytics.avgDaily")} value={<Money value={data.avg.avgDailyExpense} currency={base} />} sub={t("analytics.based", { n: data.avg.monthsCounted })} />
            <Metric label={t("analytics.avgIncome")} value={<Money value={data.avg.avgMonthlyIncome} currency={base} />} sub={t("analytics.based", { n: data.avg.monthsCounted })} />
            <Metric label={t("analytics.avgExpense")} value={<Money value={data.avg.avgMonthlyExpense} currency={base} />} sub={t("analytics.based", { n: data.avg.monthsCounted })} />
            <Metric label={t("analytics.velocity")} value={<span><Money value={data.vel.dailyRate} currency={base} /> <span className="text-[12px] font-normal text-fg-3">/{t("common.perDay")}</span></span>} sub={`${t("analytics.projected")}: ${formatMoney(data.vel.projectedMonth, base, locale, { compact: true })} · ${t("common.estimate")}`} />
            <Metric
              label={t("analytics.largest")}
              value={largest ? <Money value={largest.amount} currency={base} /> : <span>—</span>}
              sub={largest ? `${largest.tx.merchant || largest.tx.note || categoryName(f.categoriesById.get(largest.tx.category_id ?? ""))} · ${formatDay(largest.tx.local_date, locale)}` : undefined}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <Card className="lg:col-span-7" title={t("analytics.incomeVsExpense")} subtitle={`${formatMonth(monthKey(period.from), locale)} — ${formatMonth(monthKey(period.to), locale)}`}>
              <CashflowChart data={data.series} currency={base} height={240} />
              <NetTable series={data.series} />
            </Card>
            <Card className="lg:col-span-5" title={t("analytics.byCategory")} subtitle={`${formatDay(period.from, locale)} — ${formatDay(period.to, locale)}`}>
              {donut.length ? <CategoryDonut items={donut} total={data.summary.expense} currency={base} /> : <p className="text-[13px] text-fg-3">{t("tx.empty")}</p>}
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={t("analytics.trend")} subtitle={`${formatMonth(month, locale)} vs ${formatMonth(shiftMonthKey(month, -1), locale)}`}>
              <TrendLine current={data.curCum} previous={data.prevCum} currency={base} labels={{ current: t("analytics.current"), previous: t("analytics.previous") }} />
            </Card>
            <Card title={t("analytics.daily")} subtitle={`${formatDay(data.daily[0]?.date ?? today, locale)} — ${formatDay(period.to, locale)}`}>
              <Legend items={[{ label: t("dashboard.expenses"), color: "var(--viz-expense)" }, { label: t("common.today"), color: "var(--accent)" }]} />
              <div className="mt-2"><DailyBars data={data.daily} currency={base} highlight={today} /></div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <Card className="lg:col-span-7" title={t("analytics.heatmap")}>
              <SpendingHeatmap cells={data.heat} currency={base} />
            </Card>
            <Card className="lg:col-span-5" title={t("ishkor.currencyMix")} subtitle={t("ishkor.currencyMixHint", { currency: base })}>
              <CurrencyMix />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <Card className="lg:col-span-5" title={t("analytics.rule")} subtitle={formatMonth(shiftMonthKey(month, -1), locale)}>
              {data.rule ? (
                <div className="flex flex-col gap-3">
                  {([["needs", data.rule.needsShare, 0.5, "var(--accent)"], ["wants", data.rule.wantsShare, 0.3, "var(--ai)"], ["savings", data.rule.savingsShare, 0.2, "var(--income)"]] as const).map(([k, v, target, color]) => (
                    <div key={k}>
                      <div className="mb-1 flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-2 text-fg-2"><span className="size-2.5 rounded-[3px]" style={{ background: color }} />{t(`analytics.${k}`)}</span>
                        <span className="num text-fg">{formatPercent(v, locale)} <span className="text-[11px] text-fg-3">· {t("analytics.target", { pct: formatPercent(target, locale) })}</span></span>
                      </div>
                      <div className="relative h-2 rounded-full bg-surface-3">
                        <div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: color }} />
                        <span className="absolute top-[-3px] h-[14px] w-[2px] rounded bg-fg-2" style={{ left: `${target * 100}%` }} aria-hidden />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-fg-3">{t("analytics.noIncome")}</p>
              )}
            </Card>
            <Card className="lg:col-span-7" title={t("analytics.mom")} subtitle={`${formatMonth(month, locale)} · ${t("analytics.categoryChanges")}`}>
              <div className="scroll-thin -mx-1 overflow-x-auto">
                <table className="w-full min-w-[480px] text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-fg-3">
                      <th className="px-1 py-2 font-semibold">{t("common.category")}</th>
                      <th className="px-1 py-2 text-right font-semibold">{t("analytics.previous")}</th>
                      <th className="px-1 py-2 text-right font-semibold">{t("analytics.current")}</th>
                      <th className="px-1 py-2 text-right font-semibold">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.changes.slice(0, 10).map((c) => (
                      <tr key={c.categoryId ?? "none"}>
                        <td className="px-1 py-2 text-fg">{categoryName(f.categoriesById.get(c.categoryId ?? ""))}</td>
                        <td className="num px-1 py-2 text-right text-fg-2">{formatMoney(c.previous, base, locale)}</td>
                        <td className="num px-1 py-2 text-right text-fg">{formatMoney(c.current, base, locale)}</td>
                        <td className="px-1 py-2 text-right">
                          {c.change === null ? <span className="text-fg-3">—</span> : <Badge tone={c.change > 0 ? "expense" : "income"} glyph={c.change > 0 ? "up" : "down"}>{formatPercent(c.change, locale, { sign: true })}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11.5px] text-fg-3">{t("tx.excludedNote")}</p>
            </Card>
          </div>
        </>
      )}

      <ReportSheet month={reportMonth} onClose={() => setReportMonth(null)} onMonth={setReportMonth} ctx={ctx} />
    </div>
  );
}

function cumulative(values: Cents[]): Cents[] {
  const out: Cents[] = [];
  for (const v of values) out.push((out.length ? out[out.length - 1] : 0n) + v);
  return out;
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0 bg-surface p-4 sm:p-5">
      <p className="truncate text-[12.5px] font-semibold text-fg-2">{label}</p>
      <div className="mt-2.5 truncate text-[19px] font-medium tracking-[-0.035em] text-fg sm:text-[21px]">{value}</div>
      {sub && <p className="mt-1 truncate text-[11.5px] text-fg-3" title={sub}>{sub}</p>}
    </div>
  );
}

const CURRENCY_COLOR: Record<Currency, string> = { UZS: "#2F69E8", USD: "#B07A12", EUR: "#0B7A5C", RUB: "#B42840" };

/** Net worth by currency (converted to the base currency at the latest rate). */
function CurrencyMix() {
  const { t, locale, prefs } = useApp();
  const f = useFinance();
  const base = prefs.base_currency;
  const mix = useMemo(() => {
    const m = new Map<Currency, { base: bigint; raw: bigint; n: number }>();
    for (const e of f.nw.byWallet) {
      const cur = m.get(e.wallet.currency) ?? { base: 0n, raw: 0n, n: 0 };
      m.set(e.wallet.currency, { base: cur.base + e.balanceBase, raw: cur.raw + e.balance, n: cur.n + 1 });
    }
    const pos = [...m.entries()].filter(([, v]) => v.base > 0n);
    const total = pos.reduce((acc, [, v]) => acc + v.base, 0n);
    return total > 0n ? pos.map(([currency, v]) => ({ currency, ...v, share: Number((v.base * 1000n) / total) / 1000 })).sort((a, b) => b.share - a.share) : [];
  }, [f.nw.byWallet]);
  if (!mix.length) return <p className="text-[13px] text-fg-3">—</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-10 gap-1" role="img" aria-label={mix.map((c) => `${c.currency} ${formatPercent(c.share, locale)}`).join(", ")}>
        {mix.map((c) => (
          <span key={c.currency} className="num flex items-center overflow-hidden whitespace-nowrap rounded-[8px] px-2.5 text-[12.5px] font-semibold text-white" style={{ flex: `${Math.max(c.share, 0.02)} 1 0`, background: CURRENCY_COLOR[c.currency] }}>
            {c.share >= 0.14 ? `${c.currency} ${formatPercent(c.share, locale)}` : ""}
          </span>
        ))}
      </div>
      <ul className="divide-y divide-line">
        {mix.map((c) => (
          <li key={c.currency} className="flex items-center gap-3 py-2.5">
            <span className="h-6 w-9 shrink-0 rounded-[6px]" style={{ background: CURRENCY_COLOR[c.currency] }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-fg">{c.currency} · {formatPercent(c.share, locale)}</span>
              <span className="block text-[12px] text-fg-3">{t("ishkor.walletCount", { n: c.n })}</span>
            </span>
            <span className="flex flex-col items-end">
              <Money value={c.raw} currency={c.currency} className="text-[13.5px] font-semibold text-fg" />
              {c.currency !== base && <Money value={c.base} currency={base} className="text-[11.5px] text-fg-3" />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NetTable({ series }: { series: { month: string; income: Cents; expense: Cents; net: Cents }[] }) {
  const { t, locale, prefs } = useApp();
  return (
    <details className="mt-3 text-[12.5px]">
      <summary className="cursor-pointer text-fg-3 hover:text-fg">{t("analytics.netChange")}</summary>
      <table className="mt-2 w-full">
        <tbody className="divide-y divide-line">
          {series.map((p) => (
            <tr key={p.month}>
              <td className="py-1.5 text-fg-2">{formatMonth(p.month, locale)}</td>
              <td className="num py-1.5 text-right text-income">{formatMoney(p.income, prefs.base_currency, locale)}</td>
              <td className="num py-1.5 text-right text-expense">{formatMoney(p.expense, prefs.base_currency, locale)}</td>
              <td className={cn("num py-1.5 text-right", p.net >= 0n ? "text-fg" : "text-expense")}>{formatMoney(p.net, prefs.base_currency, locale, { sign: "always" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function ReportSheet({ month, onClose, onMonth, ctx }: { month: string | null; onClose: () => void; onMonth: (m: string) => void; ctx: AnalyticsContext }) {
  const { t, locale, categoryName, prefs, today, ledger } = useApp();
  const report: MonthlyReport | null = useMemo(() => (month ? buildMonthlyReport(ctx, month) : null), [ctx, month]);
  const base = prefs.base_currency;
  const months = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 12; i++) out.push(shiftMonthKey(monthKey(today), -i));
    return out;
  }, [today]);
  const cat = (id: string | null) => categoryName(ledger?.categories.find((c) => c.id === id));
  const m = (c: Cents) => formatMoney(c, base, locale);

  const exportHtml = () => {
    if (!report) return;
    const rows = (pairs: [string, string][]) => pairs.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${esc(v)}</td></tr>`).join("");
    const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>Soqqa — ${esc(formatMonth(report.month, locale))}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#0f172a;max-width:720px;margin:40px auto;padding:0 20px}h1{font-size:22px;margin:0}h2{font-size:15px;margin:28px 0 8px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #e2e8f0}.n{text-align:right;font-family:ui-monospace,monospace}.muted{color:#64748b;font-size:12px}</style></head><body>
<h1>${esc(t("analytics.report"))} — ${esc(formatMonth(report.month, locale))}</h1><p class="muted">Soqqa · ${esc(formatDay(today, locale, { year: true }))} · ${esc(base)}</p>
<table>${rows([[t("dashboard.income"), m(report.income)], [t("dashboard.expenses"), m(report.expense)], [t("dashboard.netSavings"), m(report.net)], [t("analytics.savingsRate"), report.savingsRate === null ? "—" : formatPercent(report.savingsRate, locale)]])}</table>
<h2>${esc(t("analytics.topCategories"))}</h2><table>${rows(report.topCategories.map((c) => [cat(c.categoryId), `${m(c.amount)} · ${formatPercent(c.share, locale)}`]))}</table>
<h2>${esc(t("analytics.largest"))}</h2><table>${rows(report.largest ? [[`${report.largest.tx.merchant || report.largest.tx.note || cat(report.largest.tx.category_id)} · ${formatDay(report.largest.tx.local_date, locale)}`, m(report.largest.amount)]] : [["—", ""]])}</table>
<h2>${esc(t("analytics.mom"))}</h2><table>${rows([[`${t("dashboard.income")} (${t("analytics.previous")})`, m(report.previous.income)], [`${t("dashboard.expenses")} (${t("analytics.previous")})`, m(report.previous.expense)], [t("dashboard.expenses") + " %", report.expenseChange === null ? "—" : formatPercent(report.expenseChange, locale, { sign: true })]])}</table>
<h2>${esc(t("analytics.budgetPerformance"))}</h2><table>${rows(report.budgets.map((b) => [cat(b.budget.category_id), `${m(b.spent)} / ${m(b.limit)} · ${t(`budgets.states.${b.state}`)}`]))}</table>
</body></html>`;
    download(`soqqa-report-${report.month}.html`, html, "text/html;charset=utf-8");
  };

  return (
    <Sheet open={!!report} onClose={onClose} title={t("analytics.report")} width={600}>
      {report && (
        <div id="report" className="flex flex-col gap-4">
          <div className="no-print flex flex-wrap items-center gap-2">
            <Select value={report.month} onChange={(e) => onMonth(e.target.value)} className="h-9 w-auto text-[13px]">
              {months.map((mm) => <option key={mm} value={mm}>{formatMonth(mm, locale)}</option>)}
            </Select>
            <div className="flex-1" />
            <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => window.print()}>{t("analytics.printReport")}</Button>
            <Button size="sm" variant="primary" icon={<Download size={14} />} onClick={exportHtml}>{t("analytics.exportReport")}</Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ReportStat label={t("dashboard.income")} value={m(report.income)} tone="text-income" />
            <ReportStat label={t("dashboard.expenses")} value={m(report.expense)} tone="text-expense" />
            <ReportStat label={t("dashboard.netSavings")} value={formatMoney(report.net, base, locale, { sign: "always" })} />
            <ReportStat label={t("analytics.savingsRate")} value={report.savingsRate === null ? "—" : formatPercent(report.savingsRate, locale)} />
          </div>
          <section>
            <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-3">{t("analytics.topCategories")}</h3>
            {report.topCategories.length === 0 ? <p className="text-[13px] text-fg-3">—</p> : report.topCategories.map((c, i) => (
              <div key={c.categoryId ?? i} className="flex items-center justify-between border-b border-line py-2 text-[13.5px]">
                <span className="text-fg">{i + 1}. {cat(c.categoryId)}</span>
                <span className="num text-fg-2">{m(c.amount)} · {formatPercent(c.share, locale)}</span>
              </div>
            ))}
          </section>
          <section>
            <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-3">{t("analytics.largest")}</h3>
            {report.largest ? (
              <div className="flex items-center justify-between text-[13.5px]">
                <span className="truncate text-fg">{report.largest.tx.merchant || report.largest.tx.note || cat(report.largest.tx.category_id)} · <span className="text-fg-3">{formatDay(report.largest.tx.local_date, locale)}</span></span>
                <span className="num text-expense">{m(report.largest.amount)}</span>
              </div>
            ) : <p className="text-[13px] text-fg-3">—</p>}
          </section>
          <section>
            <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-3">{t("analytics.mom")}</h3>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="text-fg-3">{t("dashboard.income")}</p>
                <p className="num text-fg">{m(report.previous.income)} → {m(report.income)}</p>
                {report.incomeChange !== null && <Badge tone={report.incomeChange >= 0 ? "income" : "expense"}>{formatPercent(report.incomeChange, locale, { sign: true })}</Badge>}
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="text-fg-3">{t("dashboard.expenses")}</p>
                <p className="num text-fg">{m(report.previous.expense)} → {m(report.expense)}</p>
                {report.expenseChange !== null && <Badge tone={report.expenseChange <= 0 ? "income" : "expense"}>{formatPercent(report.expenseChange, locale, { sign: true })}</Badge>}
              </div>
            </div>
          </section>
          <section>
            <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-3">{t("analytics.budgetPerformance")}</h3>
            {report.budgets.length === 0 ? <p className="text-[13px] text-fg-3">{t("budgets.empty")}</p> : report.budgets.map((b) => (
              <div key={b.budget.id} className="py-1.5">
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className="text-fg">{cat(b.budget.category_id)}</span>
                  <span className="num text-fg-2">{m(b.spent)} / {m(b.limit)}</span>
                </div>
                <Progress value={b.utilization} tone={b.state === "over" ? "expense" : b.state === "warning" ? "warning" : "income"} />
              </div>
            ))}
          </section>
        </div>
      )}
    </Sheet>
  );
}

function ReportStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-[12px] text-fg-3">{label}</p>
      <p className={cn("num mt-0.5 text-[17px] font-semibold", tone ?? "text-fg")}>{value}</p>
    </div>
  );
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
