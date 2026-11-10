"use client";

/**
 * Chart components. Colors come from validated CSS tokens (--viz-*). Every
 * multi-series chart has a legend and a hover tooltip; the income/expense pair
 * additionally keeps a 2px gap between bars (secondary encoding).
 */
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useApp } from "../providers/app-provider";
import { formatDay, formatMoney, formatMonth, formatPercent } from "@/lib/i18n";
import { parseAmount, toChartNumber, type Cents } from "@/lib/money/money";
import type { Currency, LocalDate } from "@/lib/domain/types";
import { cn } from "../ui/primitives";

const toCents = (n: number) => parseAmount(n.toFixed(2));

interface TipEntry {
  dataKey?: unknown;
  name?: unknown;
  value?: unknown;
  color?: string;
}

function ChartTooltip({ active, payload, label, currency, labelFormat }: { active?: boolean; payload?: readonly TipEntry[]; label?: unknown; currency: Currency; labelFormat: (l: string) => string }) {
  const { locale } = useApp();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[12px] border border-line-strong bg-surface px-3 py-2.5 text-[12px] shadow-[var(--shadow-lg)]">
      <div className="mb-1 font-medium text-fg">{labelFormat(String(label))}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-fg-2">
            <span className="size-2 rounded-sm" style={{ background: String(p.color) }} />
            {String(p.name)}
          </span>
          <span className="num text-fg">{formatMoney(toCents(Number(p.value)), currency, locale)}</span>
        </div>
      ))}
    </div>
  );
}

function useAxis(currency: Currency) {
  const { locale } = useApp();
  return (v: number) => (v === 0 ? "0" : formatMoney(toCents(v), currency, locale, { compact: true, symbol: false }));
}

export function Legend({ items }: { items: { label: string; color: string; value?: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-fg-2">
          {i.dashed ? <span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: i.color }} /> : <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />}
          {i.label}
          {i.value && <span className="num text-fg">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

export function CashflowChart({ data, currency, height = 220 }: { data: { month: string; income: Cents; expense: Cents }[]; currency: Currency; height?: number }) {
  const { t, locale } = useApp();
  const axis = useAxis(currency);
  const rows = useMemo(() => data.map((d) => ({ month: d.month, income: toChartNumber(d.income), expense: toChartNumber(d.expense) })), [data]);
  return (
    <div>
      <Legend items={[{ label: t("dashboard.income"), color: "var(--viz-income)" }, { label: t("dashboard.expenses"), color: "var(--viz-expense)" }]} />
      <div style={{ height }} className="mt-2 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--text-3)", fontSize: 11 }} tickFormatter={(m: string) => formatMonth(m, locale, true)} />
            <YAxis width={52} tickLine={false} axisLine={false} tick={{ fill: "var(--text-3)", fontSize: 11 }} tickFormatter={axis} />
            <Tooltip cursor={{ fill: "var(--viz-grid)" }} content={(p) => <ChartTooltip {...p} currency={currency} labelFormat={(m) => formatMonth(m, locale)} />} />
            <Bar dataKey="income" name={t("dashboard.income")} fill="var(--viz-income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expense" name={t("dashboard.expenses")} fill="var(--viz-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export interface DonutItem {
  key: string;
  label: string;
  color: string;
  amount: Cents;
  share: number;
}

/** Top categories + "Other" fold. Legend list doubles as the direct labels / table view. */
export function CategoryDonut({ items, total, currency, maxSlices = 6 }: { items: DonutItem[]; total: Cents; currency: Currency; maxSlices?: number }) {
  const { locale, t } = useApp();
  const [hover, setHover] = useState<string | null>(null);
  const shown = useMemo(() => {
    if (items.length <= maxSlices) return items;
    const head = items.slice(0, maxSlices - 1);
    const rest = items.slice(maxSlices - 1);
    const amount = rest.reduce((s, i) => s + i.amount, 0n);
    return [...head, { key: "__other", label: `${t("category.other_expense")} (${rest.length})`, color: "var(--viz-net)", amount, share: rest.reduce((s, i) => s + i.share, 0) }];
  }, [items, maxSlices, t]);
  const active = shown.find((s) => s.key === hover);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown.map((s) => ({ ...s, value: toChartNumber(s.amount) }))}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={shown.length > 1 ? 1.5 : 0}
              stroke="var(--surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setHover(shown[i]?.key ?? null)}
              onMouseLeave={() => setHover(null)}
            >
              {shown.map((s) => (
                <Cell key={s.key} fill={s.color} opacity={hover && hover !== s.key ? 0.35 : 1} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[110px] truncate text-[11px] text-fg-3">{active ? active.label : t("dashboard.expenses")}</span>
          <span className="num text-[15px] font-semibold text-fg">{formatMoney(active ? active.amount : total, currency, locale, { compact: true })}</span>
          {active && <span className="num text-[11px] text-fg-2">{formatPercent(active.share, locale)}</span>}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {shown.map((s) => (
          <li key={s.key} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)} className={cn("flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px]", hover === s.key && "bg-surface-2")}>
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-fg-2">{s.label}</span>
            <span className="num text-[12px] text-fg-3">{formatPercent(s.share, locale)}</span>
            <span className="num w-[104px] text-right text-fg">{formatMoney(s.amount, currency, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DailyBars({ data, currency, height = 180, highlight }: { data: { date: LocalDate; expense: Cents }[]; currency: Currency; height?: number; highlight?: LocalDate }) {
  const { locale, t } = useApp();
  const axis = useAxis(currency);
  const rows = data.map((d) => ({ date: d.date, expense: toChartNumber(d.expense) }));
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barCategoryGap={2} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} tick={{ fill: "var(--text-3)", fontSize: 11 }} tickFormatter={(d: string) => String(Number(d.slice(8, 10)))} />
          <YAxis width={52} tickLine={false} axisLine={false} tick={{ fill: "var(--text-3)", fontSize: 11 }} tickFormatter={axis} />
          <Tooltip cursor={{ fill: "var(--viz-grid)" }} content={(p) => <ChartTooltip {...p} currency={currency} labelFormat={(d) => formatDay(d, locale, { weekday: true })} />} />
          <Bar dataKey="expense" name={t("dashboard.expenses")} radius={[3, 3, 0, 0]} maxBarSize={18}>
            {rows.map((r) => (
              <Cell key={r.date} fill={r.date === highlight ? "var(--accent)" : "var(--viz-expense)"} fillOpacity={r.date === highlight ? 1 : 0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cumulative month-to-date spending vs the previous month (like-for-like days). */
export function TrendLine({ current, previous, currency, height = 200, labels }: { current: (Cents | null)[]; previous: Cents[]; currency: Currency; height?: number; labels: { current: string; previous: string } }) {
  const axis = useAxis(currency);
  const n = Math.max(current.length, previous.length);
  const rows = Array.from({ length: n }, (_, i) => ({
    day: String(i + 1),
    current: current[i] != null ? toChartNumber(current[i]!) : null,
    previous: previous[i] != null ? toChartNumber(previous[i]) : null,
  }));
  const { t } = useApp();
  return (
    <div>
      <Legend items={[{ label: labels.current, color: "var(--accent)" }, { label: labels.previous, color: "var(--viz-net)", dashed: true }]} />
      <div style={{ height }} className="mt-2 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} tick={{ fill: "var(--text-3)", fontSize: 11 }} />
            <YAxis width={52} tickLine={false} axisLine={false} tick={{ fill: "var(--text-3)", fontSize: 11 }} tickFormatter={axis} />
            <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={(p) => <ChartTooltip {...p} currency={currency} labelFormat={(d) => `${d} ${t("common.days")}`} />} />
            <Line dataKey="previous" name={labels.previous} stroke="var(--viz-net)" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls />
            <Line dataKey="current" name={labels.current} stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Calendar heatmap: weeks as columns, Monday-first rows; single-hue sequential scale. */
export function SpendingHeatmap({ cells, currency }: { cells: { date: LocalDate; expense: Cents; intensity: number }[]; currency: Currency }) {
  const { locale, t } = useApp();
  const dict = t;
  const [hover, setHover] = useState<(typeof cells)[number] | null>(null);
  if (!cells.length) return null;
  const firstDow = (new Date(`${cells[0].date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const padded: ((typeof cells)[number] | null)[] = [...Array(firstDow).fill(null), ...cells];
  const weeks: ((typeof cells)[number] | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  const wd = [1, 2, 3, 4, 5, 6, 0].map((d) => dictWeekday(locale, d));
  return (
    <div>
      <div className="no-scrollbar flex gap-[3px] overflow-x-auto pb-1">
        <div className="mr-1 flex flex-col gap-[3px] pt-0">
          {wd.map((d, i) => (
            <span key={i} className="flex h-[14px] items-center text-[9px] text-fg-3">{i % 2 === 0 ? d : ""}</span>
          ))}
        </div>
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, di) => {
              const c = w[di];
              if (!c) return <span key={di} className="size-[14px]" />;
              return (
                <span
                  key={di}
                  onMouseEnter={() => setHover(c)}
                  onMouseLeave={() => setHover(null)}
                  title={`${formatDay(c.date, locale)} · ${formatMoney(c.expense, currency, locale)}`}
                  className="flex size-[14px] items-center justify-center"
                >
                  <span
                    className={cn("size-[10px] rotate-45 rounded-[1.5px]", c.intensity > 0 ? "" : "ring-1 ring-inset ring-line-strong")}
                    style={{ background: c.intensity > 0 ? `rgba(var(--viz-seq), ${0.2 + c.intensity * 0.8})` : "transparent" }}
                  />
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-fg-3">
        <span className="num min-h-4">{hover ? `${formatDay(hover.date, locale, { weekday: true })} · ${formatMoney(hover.expense, currency, locale)}` : ""}</span>
        <span className="flex items-center gap-1">
          {dict("analytics.less")}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <span key={v} className={cn("mx-[1px] size-[8px] rotate-45 rounded-[1px]", v === 0 && "ring-1 ring-inset ring-line-strong")} style={{ background: v === 0 ? "transparent" : `rgba(var(--viz-seq), ${0.2 + v * 0.8})` }} />
          ))}
          {dict("analytics.more")}
        </span>
      </div>
    </div>
  );
}

function dictWeekday(locale: string, d: number) {
  const map: Record<string, string[]> = {
    uz: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
    ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  };
  return (map[locale] ?? map.en)[d];
}

/** Tiny inline sparkline (single series, no axes) for hero cards. */
export function Sparkline({ values, color = "var(--accent)", height = 36 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${height - 2 - ((v - min) / span) * (height - 4)}`);
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

