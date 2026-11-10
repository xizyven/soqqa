"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, PiggyBank, Plus, Repeat, Trash2, CircleCheck, SkipForward, Pencil } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useFinance } from "@/components/providers/use-finance";
import { Badge, Button, Card, cn, EmptyState, Field, Input, Progress, Segmented, Select, Skeleton, Switch, PageHeader } from "@/components/ui/primitives";
import { HeroMoney, Money } from "@/components/ui/money";
import { IconTile } from "@/components/ui/icon";
import { ConfirmDialog, Sheet } from "@/components/ui/sheet";
import { budgetStatuses, dailySeries, summarize } from "@/lib/domain/analytics";
import { addDays, daysInMonth, monthEnd, monthKey, monthStart, shiftMonthKey } from "@/lib/domain/dates";
import { formatDay, formatMoney, formatMonth, formatPercent } from "@/lib/i18n";
import { parseAmount, sum, toChartNumber } from "@/lib/money/money";
import { Khatam } from "@/components/brand/ornaments";
import { ValidationError } from "@/lib/data/repo";
import { errorMessage, fieldError } from "@/lib/i18n/translate";
import type { Budget, Recurring, RecurringFrequency } from "@/lib/domain/types";

export default function BudgetsPage() {
  const { t, ledger, today, locale, prefs, repo, toast, categoryName } = useApp();
  const f = useFinance();
  const [month, setMonth] = useState(monthKey(today));
  const [budgetForm, setBudgetForm] = useState<{ open: boolean; budget?: Budget }>({ open: false });
  const [recForm, setRecForm] = useState<{ open: boolean; rec?: Recurring }>({ open: false });
  const [postRec, setPostRec] = useState<Recurring | null>(null);
  const base = prefs.base_currency;

  const statuses = useMemo(() => budgetStatuses(f.ctx, month), [f.ctx, month]);
  const totalLimit = sum(statuses.map((s) => s.limit));
  const totalSpent = sum(statuses.map((s) => s.spent));
  const recurring = useMemo(() => [...(ledger?.recurring ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.next_date.localeCompare(b.next_date)), [ledger]);

  const isCurrent = month === monthKey(today);
  const [yy, mm] = month.split("-").map(Number);
  const dim = daysInMonth(yy, mm);
  const dayNo = isCurrent ? Number(today.slice(8, 10)) : dim;
  const pace = isCurrent ? dayNo / dim : undefined;

  const { unbudgeted, cumulative } = useMemo(() => {
    const ids = statuses.map((s) => s.budget.category_id);
    const from = monthStart(month);
    const to = isCurrent ? today : monthEnd(month);
    const summary = summarize(f.ctx, { from, to: monthEnd(month) });
    const unbudgeted = sum(summary.expenseByCategory.filter((c) => !c.categoryId || !ids.includes(c.categoryId)).map((c) => c.amount));
    const cum: bigint[] = [];
    if (ids.length) for (const d of dailySeries(f.ctx, from, to, { categoryIds: ids })) cum.push((cum.length ? cum[cum.length - 1] : 0n) + d.expense);
    return { unbudgeted, cumulative: cum };
  }, [statuses, month, isCurrent, today, f.ctx]);

  if (!ledger) return <Skeleton className="h-96" />;

  const util = totalLimit > 0n ? Number((totalSpent * 1000n) / totalLimit) / 1000 : 0;
  const stateOf = (s: (typeof statuses)[number]): "over" | "warning" | "fast" | "ok" =>
    s.state === "over" ? "over" : s.state === "warning" ? "warning" : pace !== undefined && pace < 1 && s.utilization >= Math.min(1, pace * 2) && s.utilization > 0.05 ? "fast" : "ok";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={isCurrent ? `${formatMonth(month, locale)} · ${dayNo} / ${dim}` : formatMonth(month, locale)}
        title={t("budgets.title")}
        actions={
          <>
            <div className="flex h-[42px] items-center rounded-[11px] border border-line-strong bg-surface">
              <button className="flex h-full w-10 items-center justify-center text-fg-2 transition-colors hover:text-fg" onClick={() => setMonth(shiftMonthKey(month, -1))} aria-label="Previous month"><ChevronLeft size={17} /></button>
              <span className="min-w-[110px] text-center text-[13.5px] font-semibold text-fg">{formatMonth(month, locale)}</span>
              <button className="flex h-full w-10 items-center justify-center text-fg-2 transition-colors hover:text-fg disabled:opacity-30" disabled={month >= monthKey(today)} onClick={() => setMonth(shiftMonthKey(month, 1))} aria-label="Next month"><ChevronRight size={17} /></button>
            </div>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setBudgetForm({ open: true })}>{t("budgets.new")}</Button>
          </>
        }
      />

      {statuses.length === 0 ? (
        <Card>
          <EmptyState icon={<PiggyBank size={20} />} title={t("budgets.empty")} body={t("budgets.emptyHint")} action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setBudgetForm({ open: true })}>{t("budgets.new")}</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="brand-panel girih flex flex-col justify-between gap-6 overflow-hidden p-6 sm:p-7">
              <div className="flex flex-col gap-2">
                <span className="text-[12.5px] font-semibold text-[#A9B7D6]">{t("ishkor.budgetLeft")}</span>
                {totalSpent > totalLimit ? (
                  <span className="num text-[34px] font-medium leading-none tracking-[-0.05em] text-[#FF8FA0] sm:text-[44px]">{t("ishkor.overPlan", { amount: formatMoney(totalSpent - totalLimit, base, locale) })}</span>
                ) : (
                  <HeroMoney value={totalLimit - totalSpent} currency={base} quiet="text-[#A9B7D6]" className="text-[40px] font-medium leading-none tracking-[-0.05em] text-white sm:text-[52px]" />
                )}
              </div>
              <dl className="flex flex-wrap gap-x-9 gap-y-3">
                <Stat label={t("ishkor.plan")} value={formatMoney(totalLimit, base, locale)} />
                <Stat label={t("ishkor.spent")} value={`${formatMoney(totalSpent, base, locale)} · ${formatPercent(util, locale)}`} />
                <Stat label={t("ishkor.outside")} value={formatMoney(unbudgeted, base, locale)} />
              </dl>
              <div className="flex flex-col gap-2.5">
                <div className="flex h-9 gap-1" role="img" aria-label={statuses.map((s) => `${categoryName(s.category)} ${formatPercent(s.utilization, locale)}`).join(", ")}>
                  {statuses.map((s) => {
                    const st = stateOf(s);
                    const color = st === "over" ? "#FF8FA0" : st === "ok" ? "#5EE0B0" : "#F2CF7E";
                    return (
                      <span
                        key={s.budget.id}
                        title={`${categoryName(s.category)} · ${formatMoney(s.spent, base, locale)} / ${formatMoney(s.limit, base, locale)}`}
                        className={cn("relative overflow-hidden rounded-[7px] bg-white/[0.08]", st === "over" && "shadow-[0_0_0_2px_var(--panel),0_0_0_3.5px_#FF8FA0]")}
                        style={{ flex: `${Math.max(1, Number(s.limit / 100n))} 1 0` }}
                      >
                        <span className="absolute inset-y-0 left-0" style={{ width: `${Math.min(1, s.utilization) * 100}%`, background: color }} />
                      </span>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-medium text-[#C3CFE8]">
                  <Legend color="#5EE0B0" label={t("budgets.states.ok")} />
                  <Legend color="#F2CF7E" label={`${t("budgets.states.warning")} / ${t("ishkor.fastPace")}`} />
                  <Legend color="#FF8FA0" label={t("budgets.states.over")} />
                  <span className="flex-1" />
                  <span className="text-[#A9B7D6]">{t("ishkor.bandHint")}</span>
                </div>
              </div>
            </section>

            <Card title={t("ishkor.pace")} subtitle={t("ishkor.paceHint")}>
              <PaceChart cumulative={cumulative} limit={totalLimit} dim={dim} dayNo={dayNo} isCurrent={isCurrent} month={month} />
            </Card>
          </div>

          <section aria-label={t("budgets.title")} className="card px-4 py-2 sm:px-6">
            <div className="hidden items-center gap-5 border-b border-line py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3 md:flex">
              <span className="flex-[1_1_220px]">{t("ishkor.colCategory")}</span>
              <span className="flex flex-[2_1_260px] items-center gap-2">
                {t("ishkor.colProgress")}
                {pace !== undefined && (
                  <span className="inline-flex items-center gap-1.5 font-medium normal-case tracking-normal">
                    <span className="h-3 w-[2px] rounded-full bg-fg/45" />
                    {t("ishkor.todayMarker", { pct: formatPercent(pace, locale) })}
                  </span>
                )}
              </span>
              <span className="w-[260px] text-right">{t("ishkor.colSpent")}</span>
              <span className="w-[110px] text-right">{t("ishkor.colLeft")}</span>
              <span className="w-[120px] text-right">{t("ishkor.colStatus")}</span>
            </div>
            {statuses.map((s) => {
              const st = stateOf(s);
              const tone = st === "over" ? "expense" : st === "ok" ? "income" : "warning";
              return (
                <button
                  key={s.budget.id}
                  onClick={() => setBudgetForm({ open: true, budget: s.budget })}
                  className="-mx-2 flex w-[calc(100%+16px)] flex-wrap items-center gap-x-5 gap-y-2.5 rounded-xl border-b border-line px-2 py-3.5 text-left transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <span className="flex min-w-0 flex-[1_1_220px] items-center gap-3">
                    <IconTile name={s.category?.icon ?? "circle-dashed"} color={s.category?.color ?? "#64748B"} size={38} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[14px] font-semibold text-fg">{categoryName(s.category)}</span>
                      <span className={cn("truncate text-[12px]", st === "over" ? "font-medium text-expense" : "text-fg-3")}>
                        {formatPercent(s.utilization, locale)} {t("common.used")}
                      </span>
                    </span>
                  </span>
                  <span className="flex-[2_1_260px]">
                    <Progress value={s.utilization} marker={pace} tone={tone} label={categoryName(s.category)} />
                  </span>
                  <span className="num w-full whitespace-nowrap text-[13px] font-semibold text-fg md:w-[260px] md:text-right">
                    {formatMoney(s.spent, base, locale)} <span className="font-normal text-fg-3">/ {formatMoney(s.limit, base, locale)}</span>
                  </span>
                  <span className={cn("num text-[13.5px] md:w-[110px] md:text-right", s.remaining < 0n ? "font-semibold text-expense" : "text-fg-2")}>
                    {formatMoney(s.remaining, base, locale, { sign: s.remaining < 0n ? "always" : undefined })}
                  </span>
                  <span className="flex md:w-[120px] md:justify-end">
                    <Badge tone={tone} glyph={st === "over" ? "up" : "star"}>{st === "fast" ? t("ishkor.fastPace") : t(`budgets.states.${s.state}`)}</Badge>
                  </span>
                </button>
              );
            })}
            {pace !== undefined && <p className="pb-2 pt-3 text-[12px] text-fg-3">{t("ishkor.fastHint")}</p>}
          </section>
        </>
      )}

      <Card
        title={<span className="flex items-center gap-2"><Repeat size={15} className="text-fg-3" />{t("budgets.recurring")}</span>}
        action={<Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setRecForm({ open: true })}>{t("common.add")}</Button>}
      >
        {recurring.length === 0 ? (
          <p className="text-[13px] text-fg-3">{t("budgets.recurringEmpty")}</p>
        ) : (
          <ul className="-mx-2 divide-y divide-line">
            {recurring.map((r) => {
              const cat = r.category_id ? f.categoriesById.get(r.category_id) : undefined;
              const due = r.active && r.next_date <= today;
              return (
                <li key={r.id} className={cn("flex items-center gap-3 px-2 py-3", !r.active && "opacity-50")}>
                  <span className="flex w-11 shrink-0 flex-col items-center leading-tight">
                    <span className="num text-[15px] font-semibold text-fg">{Number(r.next_date.slice(8, 10))}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">{formatMonth(monthKey(r.next_date), locale, true)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[14px] font-semibold text-fg">
                      {r.name}
                      {due && <Badge tone="warning" glyph="star">{t("budgets.due")}</Badge>}
                    </p>
                    <p className="truncate text-[12px] text-fg-3">
                      {t(`budgets.frequency.${r.frequency}`)} · {categoryName(cat)} · {f.walletsById.get(r.wallet_id)?.name}
                    </p>
                  </div>
                  <Money value={r.type === "income" ? parseAmount(r.amount) : -parseAmount(r.amount)} currency={r.currency} sign="always" tone={r.type === "income" ? "income" : "expense"} className="text-[14px] font-semibold" />
                  <div className="flex shrink-0">
                    {r.active && (
                      <button className="rounded-lg p-2 text-income hover:bg-income-soft" onClick={() => setPostRec(r)} title={t("budgets.post")} aria-label={t("budgets.post")}><CircleCheck size={17} /></button>
                    )}
                    {r.active && (
                      <button className="hidden rounded-lg p-2 text-fg-3 hover:bg-surface-2 sm:block" onClick={async () => { await repo.skipRecurring(r.id); toast({ message: t("tx.saved") }); }} title={t("budgets.skip")} aria-label={t("budgets.skip")}><SkipForward size={16} /></button>
                    )}
                    <button className="rounded-lg p-2 text-fg-3 hover:bg-surface-2" onClick={() => setRecForm({ open: true, rec: r })} title={t("common.edit")} aria-label={t("common.edit")}><Pencil size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <BudgetForm state={budgetForm} onClose={() => setBudgetForm({ open: false })} existing={ledger.budgets} />
      <RecurringForm state={recForm} onClose={() => setRecForm({ open: false })} />
      <ConfirmDialog
        open={!!postRec}
        title={t("budgets.post")}
        body={postRec ? t("budgets.postConfirm", { name: postRec.name, amount: formatMoney(parseAmount(postRec.amount), postRec.currency, locale) }) : ""}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        onClose={() => setPostRec(null)}
        onConfirm={async () => {
          try {
            await repo.postRecurring(postRec!.id);
            toast({ message: t("tx.saved"), tone: "success" });
          } catch (e) {
            toast({ message: errorMessage(e, t), tone: "error" });
          }
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11.5px] text-[#A9B7D6]">{label}</dt>
      <dd className="num text-[15px] font-semibold text-white">{value}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden><path d="M5 0L10 5L5 10L0 5Z" fill={color} /></svg>
      {label}
    </span>
  );
}

/**
 * Cumulative spending in budgeted categories against an even pace to the
 * month's limit, with a straight-line forecast from today's average.
 */
function PaceChart({ cumulative, limit, dim, dayNo, isCurrent, month }: { cumulative: bigint[]; limit: bigint; dim: number; dayNo: number; isCurrent: boolean; month: string }) {
  const { t, locale, prefs } = useApp();
  const base = prefs.base_currency;
  const spent = cumulative.length ? cumulative[cumulative.length - 1] : 0n;
  const days = Math.max(1, cumulative.length);
  const projected = isCurrent && dayNo > 0 ? (spent * BigInt(dim)) / BigInt(dayNo) : spent;
  const limitN = toChartNumber(limit);
  const projN = toChartNumber(projected);
  const yMax = Math.max(limitN * 1.25, Math.min(projN, limitN * 1.8), toChartNumber(spent) * 1.1, 1);
  const X = (d: number) => 30 + ((d - 1) * 360) / Math.max(1, dim - 1);
  const Y = (v: number) => 180 - (Math.min(v, yMax) / yMax) * 170;
  const pts = cumulative.map((c, i) => `${X(i + 1).toFixed(1)},${Y(toChartNumber(c)).toFixed(1)}`).join(" ");
  const lastX = X(days);
  const lastY = Y(toChartNumber(spent));
  // Forecast line, clipped where it leaves the plot.
  const rate = days > 0 ? toChartNumber(spent) / days : 0;
  let endDay = dim;
  if (rate > 0 && rate * dim > yMax) endDay = Math.max(days, yMax / rate);
  const crossDay = rate > 0 && toChartNumber(spent) < limitN && projN > limitN ? Math.ceil(limitN / rate) : null;
  const left = limit - spent;
  const daysLeft = dim - dayNo;
  const risk = spent > limit || (isCurrent && projected > limit);
  const axis = (v: number) => formatMoney(parseAmount(v.toFixed(2)), base, locale, { compact: true, symbol: false });

  return (
    <div className="flex flex-col gap-3">
      <svg role="img" aria-label={`${t("ishkor.actual")}: ${formatMoney(spent, base, locale)}. ${t("ishkor.limit")}: ${formatMoney(limit, base, locale)}.`} width="100%" viewBox="0 0 400 200" className="overflow-visible">
        <g className="fill-fg-3" fontSize="10.5" fontFamily="var(--font-sans)">
          <text x="0" y="14">{axis(yMax)}</text>
          <text x="0" y="99">{axis(yMax / 2)}</text>
          <text x="0" y="184">0</text>
        </g>
        <path d="M30 95H390M30 10H390" stroke="var(--viz-grid)" strokeWidth="1" />
        <path d="M30 180H390" stroke="var(--border-strong)" strokeWidth="1" />
        <path d={`M30 ${Y(limitN)}H390`} stroke="var(--expense)" strokeWidth="1" strokeDasharray="4 4" />
        <text x="390" y={Y(limitN) - 6} textAnchor="end" fontSize="10.5" fontWeight="600" className="fill-expense">{t("ishkor.limit")} {formatMoney(limit, base, locale, { compact: true })}</text>
        <path d={`M30 180L390 ${Y(limitN)}`} stroke="var(--text-3)" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" />
        {isCurrent && days < dim && rate > 0 && <path d={`M${lastX} ${lastY}L${X(endDay)} ${Y(rate * endDay)}`} stroke="#C9921F" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />}
        {pts && <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        <circle cx={lastX} cy={lastY} r="4.5" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" />
        {isCurrent && crossDay && crossDay <= dim && (
          <g>
            <path d={`M${X(crossDay)} ${Y(limitN) - 6}L${X(crossDay) + 6} ${Y(limitN)}L${X(crossDay)} ${Y(limitN) + 6}L${X(crossDay) - 6} ${Y(limitN)}Z`} fill="#C9921F" stroke="var(--surface)" strokeWidth="1.5" />
            <text x={X(crossDay)} y={Y(limitN) + 22} textAnchor="middle" fontSize="10.5" fontWeight="600" fontFamily="var(--font-mono)" className="fill-warning">{formatDay(addDays(monthStart(month), crossDay - 1), locale)}</text>
          </g>
        )}
        <g className="fill-fg-3" fontSize="10.5" textAnchor="middle" fontFamily="var(--font-sans)">
          <text x="30" y="197">1</text>
          {isCurrent && dayNo > 1 && dayNo < dim && <text x={X(dayNo)} y="197" fontWeight="600" className="fill-fg">{dayNo} · {t("common.today").toLowerCase()}</text>}
          <text x="384" y="197">{dim}</text>
        </g>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded-full bg-brand" />{t("ishkor.actual")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dotted border-fg-3" />{t("ishkor.ideal")}</span>
        {isCurrent && <span className="inline-flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-[#C9921F]" />{t("ishkor.forecast")}</span>}
      </div>
      <div className={cn("flex gap-3 rounded-[14px] p-3.5", risk ? "bg-warning-soft" : "bg-income-soft")}>
        <span className={cn("flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-surface", risk ? "text-warning" : "text-income")}><Khatam size={13} /></span>
        <p className="text-[13px] leading-relaxed text-fg">
          {spent > limit
            ? t("ishkor.overPlan", { amount: formatMoney(spent - limit, base, locale) })
            : isCurrent && crossDay && crossDay <= dim
              ? t("ishkor.runsOut", { date: formatDay(addDays(monthStart(month), crossDay - 1), locale) })
              : isCurrent
                ? t("ishkor.onPace", { amount: formatMoney(projected, base, locale) })
                : `${t("budgets.remaining")}: ${formatMoney(left, base, locale)}`}{" "}
          {isCurrent && left > 0n && daysLeft > 0 && t("ishkor.perDayToFit", { n: daysLeft, amount: formatMoney(left / BigInt(daysLeft), base, locale) })}
        </p>
      </div>
    </div>
  );
}

function BudgetForm({ state, onClose, existing }: { state: { open: boolean; budget?: Budget }; onClose: () => void; existing: Budget[] }) {
  const { t, ledger, repo, toast, categoryName, prefs } = useApp();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [threshold, setThreshold] = useState(0.8);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (state.open !== lastOpen) {
    setLastOpen(state.open);
    if (state.open) {
      setCategoryId(state.budget?.category_id ?? "");
      setAmount(state.budget ? state.budget.amount.replace(/\.00$/, "") : "");
      setThreshold(state.budget?.alert_threshold ?? 0.8);
      setErrors({});
    }
  }
  const used = new Set(existing.filter((b) => b.id !== state.budget?.id).map((b) => b.category_id));
  const cats = (ledger?.categories ?? []).filter((c) => c.kind === "expense" && !c.archived && !used.has(c.id));
  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      await repo.saveBudget({ category_id: categoryId, amount: amount.replace(/[\s ]/g, "").replace(",", "."), currency: state.budget?.currency ?? prefs.base_currency, alert_threshold: threshold }, state.budget?.id);
      toast({ message: t("tx.saved"), tone: "success" });
      onClose();
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.issues);
      else toast({ message: errorMessage(e, t), tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={state.open} onClose={onClose} title={state.budget ? t("budgets.edit") : t("budgets.new")} width={460}>
      <div className="flex flex-col gap-4">
        <Field label={t("common.category")} error={fieldError(errors.category_id ? "category_required" : undefined, t)}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!!state.budget}>
            <option value="">{t("quick.chooseCategory")}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
          </Select>
        </Field>
        <Field label={`${t("budgets.limit")} (${state.budget?.currency ?? prefs.base_currency})`} error={fieldError(errors.amount, t)}>
          <Input data-autofocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ""))} className="num" placeholder="1 000 000" />
        </Field>
        <Field label={t("budgets.threshold")} hint={t("budgets.thresholdHint", { pct: `${Math.round(threshold * 100)}%` })}>
          <input type="range" min={0.5} max={1} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label={t("budgets.threshold")} />
        </Field>
        <div className="flex gap-2">
          {state.budget && (
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={async () => { await repo.softDelete("budgets", state.budget!.id); toast({ message: t("tx.deleted") }); onClose(); }}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="primary" className="flex-1" loading={busy} onClick={() => void save()}>{t("common.save")}</Button>
        </div>
      </div>
    </Sheet>
  );
}

function RecurringForm({ state, onClose }: { state: { open: boolean; rec?: Recurring }; onClose: () => void }) {
  const { t, ledger, repo, toast, categoryName, today } = useApp();
  const [name, setName] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [startDate, setStartDate] = useState(today);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (state.open !== lastOpen) {
    setLastOpen(state.open);
    if (state.open) {
      const r = state.rec;
      setName(r?.name ?? "");
      setType(r?.type ?? "expense");
      setAmount(r ? r.amount.replace(/\.00$/, "") : "");
      setWalletId(r?.wallet_id ?? ledger?.wallets.find((w) => !w.archived)?.id ?? "");
      setCategoryId(r?.category_id ?? "");
      setFrequency(r?.frequency ?? "monthly");
      setStartDate(r?.start_date ?? today);
      setActive(r?.active ?? true);
      setErrors({});
    }
  }
  const cats = (ledger?.categories ?? []).filter((c) => c.kind === type && !c.archived);
  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      await repo.saveRecurring({ name, type, amount: amount.replace(/[\s ]/g, "").replace(",", "."), wallet_id: walletId, category_id: categoryId || null, frequency, start_date: startDate, active }, state.rec?.id);
      toast({ message: t("tx.saved"), tone: "success" });
      onClose();
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.issues);
      else toast({ message: errorMessage(e, t), tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={state.open} onClose={onClose} title={state.rec ? t("budgets.recurringEdit") : t("budgets.recurringNew")} width={480}>
      <div className="flex flex-col gap-4">
        <Segmented value={type} onChange={(v) => { setType(v); setCategoryId(""); }} options={[{ value: "expense", label: t("tx.types.expense"), tone: "expense" }, { value: "income", label: t("tx.types.income"), tone: "income" }]} />
        <Field label={t("common.name")} error={fieldError(errors.name, t)}>
          <Input data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Internet" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("common.amount")} error={fieldError(errors.amount, t)}>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ""))} className="num" />
          </Field>
          <Field label={t("common.type")}>
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
              {(["weekly", "monthly", "yearly"] as const).map((fq) => <option key={fq} value={fq}>{t(`budgets.frequency.${fq}`)}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("common.wallet")} error={fieldError(errors.wallet_id, t)}>
            <Select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
              {(ledger?.wallets ?? []).filter((w) => !w.archived).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}
            </Select>
          </Field>
          <Field label={t("common.category")}>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={state.rec ? t("budgets.startDate") : t("budgets.nextDate")} error={fieldError(errors.start_date, t)}>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Switch checked={active} onChange={setActive} label={t("budgets.active")} />
        <div className="flex gap-2">
          {state.rec && (
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={async () => { await repo.softDelete("recurring", state.rec!.id); toast({ message: t("tx.deleted") }); onClose(); }}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="primary" className="flex-1" loading={busy} onClick={() => void save()}>{t("common.save")}</Button>
        </div>
      </div>
    </Sheet>
  );
}
