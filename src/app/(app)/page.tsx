"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, FlaskConical, Info, Plus, ShieldCheck, Sparkles, Wallet as WalletIcon } from "lucide-react";
import { Rhomb } from "@/components/brand/ornaments";
import { WalletChip, goalTone } from "@/components/ui/finance-bits";
import { useIntelligence } from "@/components/providers/use-intelligence";
import { GapPromptCard, HealthTile, QuickRecord } from "@/components/intelligence/parts";
import { useApp } from "@/components/providers/app-provider";
import { useFinance } from "@/components/providers/use-finance";
import { Badge, Button, Card, cn, Delta, EmptyState, KhatamProgress, PageHeader, Progress, Skeleton } from "@/components/ui/primitives";
import { HeroMoney, Money } from "@/components/ui/money";
import { Sheet } from "@/components/ui/sheet";
import { CashflowChart } from "@/components/charts/charts";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { InsightItem } from "@/components/insights/insight-item";
import { daysInMonth } from "@/lib/domain/dates";
import type { GoalProgress } from "@/lib/domain/planning";
import type { Transaction } from "@/lib/domain/types";
import { formatDay, formatMoney, formatPercent, relativeDay } from "@/lib/i18n";

export default function OverviewPage() {
  const { t, ledger, openQuickAdd, prefs, locale, today, mode, setMode, categoryName } = useApp();
  const f = useFinance();
  const intel = useIntelligence();
  const [safeOpen, setSafeOpen] = useState(false);
  const base = prefs.base_currency;

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const add = p.get("add");
    if (add === "expense" || add === "income") {
      openQuickAdd({ type: add });
      window.history.replaceState(null, "", "/");
    }
  }, [openQuickAdd]);

  const recentGroups = useMemo(() => {
    const recent = [...(ledger?.transactions ?? [])]
      .sort((a, b) => (b.local_date === a.local_date ? b.occurred_at.localeCompare(a.occurred_at) || b.created_at.localeCompare(a.created_at) : b.local_date.localeCompare(a.local_date)))
      .slice(0, 8);
    const out: { date: string; txs: Transaction[] }[] = [];
    for (const tx of recent) {
      const last = out[out.length - 1];
      if (last && last.date === tx.local_date) last.txs.push(tx);
      else out.push({ date: tx.local_date, txs: [tx] });
    }
    return out;
  }, [ledger]);

  if (!f.loaded) return <DashboardSkeleton />;

  const hour = new Date().getHours();
  const greeting = hour < 11 ? t("greeting.morning") : hour < 18 ? t("greeting.day") : t("greeting.evening");
  const wallets = [...f.nw.byWallet].sort((a, b) => a.wallet.sort - b.wallet.sort);
  const cur = f.comparison.current;
  const [y, m] = today.split("-").map(Number);
  const monthPace = Number(today.slice(8, 10)) / daysInMonth(y, m);

  if (wallets.length === 0) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <Card>
          <EmptyState
            icon={<WalletIcon size={20} />}
            title={t("dashboard.emptyTitle")}
            body={t("dashboard.emptyBody")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/wallets?new=1" className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-brand-fill px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hi">
                  <Plus size={16} />
                  {t("wallets.new")}
                </Link>
                {mode === "personal" && (
                  <Button variant="secondary" icon={<FlaskConical size={16} className="text-ai" />} onClick={() => void setMode("demo")}>
                    {t("demo.load")}
                  </Button>
                )}
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <PageHeader
        eyebrow={`${greeting} · ${formatDay(today, locale, { weekday: true })}`}
        title={t("nav.overview")}
        actions={
          <>
            <Button variant="secondary" icon={<Sparkles size={15} className="text-ai" />} onClick={() => openQuickAdd({ ai: true })} className="hidden sm:inline-flex">
              {t("palette.aiEntry")}
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => openQuickAdd({ type: "expense" })}>
              {t("tx.new")}
            </Button>
          </>
        }
      />

      {intel.settings.reminders && intel.gaps[0] && <GapPromptCard gap={intel.gaps[0]} />}

      {/* Statement row: the figure sits on the ground, the plan sits on navy */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-7">
        <section className="flex min-w-0 animate-rise flex-col gap-4 pt-1">
          <span className="text-[13px] font-semibold text-fg-2">
            {t("dashboard.netWorth")} · {t("dashboard.netWorthHint", { currency: base })}
          </span>
          <HeroMoney value={f.nw.total} currency={base} className="text-[42px] font-medium leading-[0.95] tracking-[-0.05em] text-fg sm:text-[58px] xl:text-[68px]" />
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
            <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5", cur.net >= 0n ? "bg-income-soft text-income" : "bg-expense-soft text-expense")}>
              {t("dashboard.thisMonth")}
              <Money value={cur.net} currency={base} sign="always" />
            </span>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-[8px] bg-surface-3 px-2.5 text-fg-2">
              {t("dashboard.spendable")}
              <Money value={f.nw.spendable} currency={base} className="text-fg" />
            </span>
          </div>
          {f.nw.missingRates.length > 0 && (
            <Link href="/settings#rates" className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-warning hover:underline">
              <Info size={12} />
              {t("dashboard.missingRate", { currency: f.nw.missingRates.join(", ") })}
            </Link>
          )}
          <WalletMix items={wallets.map((w) => ({ id: w.wallet.id, name: w.wallet.name, color: w.wallet.color, value: w.balanceBase }))} total={f.nw.total} />
        </section>

        <section className="brand-panel girih flex animate-rise flex-col gap-4 overflow-hidden p-6 sm:p-7">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
              <span className="flex size-7 items-center justify-center rounded-[8px] bg-white/10 text-[#5EE0B0]"><ShieldCheck size={15} /></span>
              {t("dashboard.safeToSpend")}
            </span>
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded-[6px] bg-white/10 px-2 text-[11.5px] font-semibold text-[#C3CFE8]">
              <Rhomb size={5} />
              {t("dashboard.safeUntil", { date: formatDay(f.safe.periodEnd, locale) })}
            </span>
          </div>
          <HeroMoney value={f.safe.safe} currency={base} quiet="text-[#A9B7D6]" className="text-[38px] font-medium leading-none tracking-[-0.05em] text-white sm:text-[46px]" />
          <div className="flex items-center gap-2 text-[13px] text-[#C3CFE8]">
            <Money value={f.safe.perDay} currency={base} className="font-semibold text-white" />
            <span>{t("common.perDay")}</span>
            <span className="text-[#A9B7D6]">· {f.safe.daysLeft} {t("common.days")}</span>
          </div>
          <div className="flex-1" />
          <div className="border-t border-white/10 pt-4">
            <SafeBar safe={f.safe.safe} bills={f.safe.upcomingBills} goals={f.safe.goalCommitments} />
            <button onClick={() => setSafeOpen(true)} className="group mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#A9C6FB] hover:text-white">
              {t("dashboard.howCalculated")}
              <ChevronRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
        </section>
      </div>

      {/* KPI strip — one ruled card */}
      <section aria-label={t("dashboard.thisMonth")} className="grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line shadow-[var(--shadow)] lg:grid-cols-4">
        <Kpi label={t("dashboard.income")} value={<Fig value={cur.income} currency={base} />} delta={f.comparison.incomeChange} goodWhenUp />
        <Kpi label={t("dashboard.expenses")} value={<Fig value={cur.expense} currency={base} />} delta={f.comparison.expenseChange} />
        <Kpi label={t("dashboard.netSavings")} value={<Fig value={cur.net} currency={base} signed />} valueClass={cur.net >= 0n ? "text-income" : "text-expense"} />
        <Kpi
          label={t("dashboard.savingsRate")}
          value={<span className="num">{cur.savingsRate === null ? "—" : formatPercent(cur.savingsRate, locale)}</span>}
          footer={cur.savingsRate !== null ? <Progress value={Math.max(0, cur.savingsRate)} tone="accent" label={t("dashboard.savingsRate")} className="h-1.5" /> : undefined}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8"><QuickRecord /></div>
        <div className="lg:col-span-4"><HealthTile health={intel.health} streak={intel.streak.current} /></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8" title={t("dashboard.cashflow")} subtitle={t("dashboard.cashflowHint")} action={<Link href="/analytics" className="text-[12.5px] font-semibold text-brand transition-colors hover:text-brand-hi">{t("nav.analytics")}</Link>}>
          <CashflowChart data={f.series} currency={base} />
        </Card>
        <Card className="lg:col-span-4" title={t("dashboard.wallets")} action={<Link href="/wallets" className="text-[12.5px] font-semibold text-brand transition-colors hover:text-brand-hi">{t("common.viewAll")}</Link>}>
          <ul className="-mx-2 flex flex-col">
            {wallets.slice(0, 5).map(({ wallet, balance, balanceBase, approximate }) => (
              <li key={wallet.id}>
                <Link href={`/wallets?id=${wallet.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                  <WalletChip color={wallet.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-fg">{wallet.name}</span>
                    <span className="block text-[12px] text-fg-3">
                      {wallet.currency}
                      {wallet.currency !== base ? <span className={cn("num", approximate && "italic")}> · ≈ {formatMoney(balanceBase, base, locale, { compact: true })}</span> : !wallet.spendable ? ` · ${t("analytics.savings")}` : ""}
                    </span>
                  </span>
                  <Money value={balance} currency={wallet.currency} className="text-[14px] font-semibold text-fg" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7" title={t("dashboard.recent")} action={<Link href="/transactions" className="text-[12.5px] font-semibold text-brand transition-colors hover:text-brand-hi">{t("common.viewAll")}</Link>}>
          {recentGroups.length === 0 ? (
            <EmptyState title={t("tx.empty")} body={t("tx.emptyHint")} action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => openQuickAdd({ type: "expense" })}>{t("tx.new")}</Button>} />
          ) : (
            <div className="-mx-2 -mt-1">
              {recentGroups.map((g) => (
                <div key={g.date}>
                  <p className="eyebrow flex items-center gap-2 px-2 pb-1 pt-3 first:pt-1">
                    <Rhomb size={7} className="text-brand" />
                    {relativeDay(g.date, today, locale)}
                  </p>
                  {g.txs.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} categories={f.categoriesById} wallets={f.walletsById} onClick={() => openQuickAdd({ editId: tx.id })} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-5 lg:col-span-5">
          <Card title={t("dashboard.insights")}>
            {f.insights.length === 0 ? (
              <p className="text-[13px] text-fg-3">{t("dashboard.noInsights")}</p>
            ) : (
              <div className="-my-1 divide-y divide-line">
                {f.insights.slice(0, 4).map((i) => (
                  <InsightItem key={i.id} insight={i} />
                ))}
              </div>
            )}
          </Card>
          <Card title={t("dashboard.budgets")} action={<Link href="/budgets" className="text-[12.5px] font-semibold text-brand transition-colors hover:text-brand-hi">{t("common.viewAll")}</Link>}>
            {f.budgets.length === 0 ? (
              <p className="text-[13px] text-fg-3">{t("budgets.emptyHint")}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {f.budgets.slice(0, 4).map((b) => (
                  <li key={b.budget.id}>
                    <div className="mb-2 flex items-center justify-between gap-2 text-[13px]">
                      <span className="truncate font-semibold text-fg">{categoryName(b.category)}</span>
                      <span className="num shrink-0 text-[12.5px] text-fg-2">
                        <span className={b.state === "over" ? "text-expense" : ""}>{formatMoney(b.spent, base, locale, { compact: true })}</span> / {formatMoney(b.limit, base, locale, { compact: true })}
                      </span>
                    </div>
                    <Progress value={b.utilization} marker={monthPace} tone={b.state === "over" ? "expense" : b.state === "warning" ? "warning" : "income"} label={categoryName(b.category)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {f.goals.length > 0 && (
        <section className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <h2 className="display text-[18px] font-semibold text-fg">{t("dashboard.goals")}</h2>
            <Link href="/goals" className="text-[12.5px] font-semibold text-brand transition-colors hover:text-brand-hi">{t("common.viewAll")}</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {f.goals.slice(0, 3).map((g) => (
              <GoalTile key={g.goal.id} g={g} />
            ))}
          </div>
        </section>
      )}

      <Sheet open={safeOpen} onClose={() => setSafeOpen(false)} title={t("safe.title")} width={480}>
        <dl className="divide-y divide-line text-[14px]">
          <Row label={t("safe.available")} value={<Money value={f.safe.available} currency={base} />} />
          <Row label={`− ${t("safe.bills")}`} value={<Money value={-f.safe.upcomingBills} currency={base} tone="expense" />} />
          {f.safe.items.filter((i) => i.kind === "bill").map((i) => (
            <Row key={`${i.refId}${i.date}`} sub label={`${i.label} · ${i.date ? formatDay(i.date, locale) : ""}`} value={<Money value={i.amount} currency={base} tone="muted" />} />
          ))}
          <Row label={`− ${t("safe.goals")}`} value={<Money value={-f.safe.goalCommitments} currency={base} tone="expense" />} />
          {f.safe.items.filter((i) => i.kind === "goal").map((i) => (
            <Row key={i.refId} sub label={i.label} value={<Money value={i.amount} currency={base} tone="muted" />} />
          ))}
          <Row strong label={`= ${t("safe.result")}`} value={<Money value={f.safe.safe} currency={base} className="text-income" />} />
          <Row label={t("safe.perDay", { n: f.safe.daysLeft })} value={<Money value={f.safe.perDay} currency={base} />} />
          {f.safe.budgetRemaining !== null && <Row label={t("safe.budgetRemaining")} value={<Money value={f.safe.budgetRemaining} currency={base} tone="muted" />} />}
          {f.safe.expectedIncome > 0n && <Row label={t("safe.expectedIncome")} value={<Money value={f.safe.expectedIncome} currency={base} tone="muted" />} />}
        </dl>
        <p className="mt-4 rounded-xl bg-surface-2 p-3 text-[12.5px] leading-relaxed text-fg-2">{t("safe.explain")}</p>
        <Link href="/budgets" onClick={() => setSafeOpen(false)} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
          {t("budgets.recurring")} <ArrowRight size={14} />
        </Link>
      </Sheet>
    </div>
  );
}

/** Ikat band: one segment per wallet, width = share of net worth. */
function WalletMix({ items, total }: { items: { id: string; name: string; color: string; value: bigint }[]; total: bigint }) {
  const { t, locale } = useApp();
  const positive = items.filter((i) => i.value > 0n);
  const sum = positive.reduce((s, i) => s + i.value, 0n);
  if (positive.length < 2 || sum <= 0n || total <= 0n) return null;
  const share = (v: bigint) => Number((v * 1000n) / sum) / 1000;
  return (
    <div className="mt-2 flex flex-col gap-2.5">
      <span className="eyebrow">{t("ishkor.composition")}</span>
      <div className="flex h-2.5 gap-[3px]" role="img" aria-label={positive.map((i) => `${i.name} ${formatPercent(share(i.value), locale)}`).join(", ")}>
        {positive.map((i) => (
          <span key={i.id} className="h-full rounded-[3px]" style={{ flex: `${Math.max(share(i.value), 0.01)} 1 0`, background: i.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-2">
        {positive.map((i) => (
          <span key={i.id} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ background: i.color }} aria-hidden />
            {i.name}
            <b className="num font-semibold text-fg">{formatPercent(share(i.value), locale)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Composition of spendable money: safe / bills / goal commitments (labelled, not colour alone). */
function SafeBar({ safe, bills, goals }: { safe: bigint; bills: bigint; goals: bigint }) {
  const { t } = useApp();
  const total = safe + bills + goals;
  if (total <= 0n) return null;
  const w = (v: bigint) => `${Math.max(0, Number((v * 1000n) / total) / 10)}%`;
  return (
    <div>
      <div className="flex h-2 gap-[3px] overflow-hidden rounded-full">
        <span className="h-full rounded-full bg-[#5EE0B0]" style={{ width: w(safe) }} />
        <span className="h-full rounded-full bg-[#F2CF7E]" style={{ width: w(bills) }} />
        <span className="h-full rounded-full bg-[#7AA7F7]" style={{ width: w(goals) }} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] font-medium text-[#C3CFE8]">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-[#5EE0B0]" />{t("safe.result")}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-[#F2CF7E]" />{t("budgets.recurring")}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-[#7AA7F7]" />{t("nav.goals")}</span>
      </div>
    </div>
  );
}

function GoalTile({ g }: { g: GoalProgress }) {
  const { t, locale } = useApp();
  return (
    <Link href="/goals" className="card card-hover flex items-center gap-4 p-5">
      <KhatamProgress value={g.progress} size={68} color={g.goal.color} label={formatPercent(g.progress, locale)}>
        <span className="num text-[13px] font-semibold text-fg">{formatPercent(g.progress, locale)}</span>
      </KhatamProgress>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[15px] font-semibold text-fg">{g.goal.name}</span>
        <span className="num truncate text-[12.5px] text-fg-2">
          {formatMoney(g.saved, g.goal.currency, locale, { compact: true })} / {formatMoney(g.target, g.goal.currency, locale, { compact: true })}
        </span>
        <Badge tone={goalTone(g.state)} glyph={g.state === "paused" ? "rhomb" : "star"} className="w-fit">{t(`goals.states.${g.state}`)}</Badge>
      </span>
    </Link>
  );
}

function Row({ label, value, sub, strong }: { label: string; value: React.ReactNode; sub?: boolean; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2.5", sub && "py-1.5 pl-4 text-[12.5px] text-fg-3", strong && "font-semibold")}>
      <dt className={cn(!sub && "text-fg-2", strong && "text-fg")}>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

/** Full figure on tablet/desktop, compact on phones (no truncation at 360px). */
function Fig({ value, currency, signed }: { value: bigint; currency: import("@/lib/domain/types").Currency; signed?: boolean }) {
  return (
    <>
      <Money value={value} currency={currency} compact sign={signed ? "always" : undefined} className="sm:hidden" />
      <Money value={value} currency={currency} sign={signed ? "always" : undefined} className="hidden sm:inline" />
    </>
  );
}

function Kpi({ label, value, delta, goodWhenUp, valueClass, footer }: { label: string; value: React.ReactNode; delta?: number | null; goodWhenUp?: boolean; valueClass?: string; footer?: React.ReactNode }) {
  const { t, locale } = useApp();
  return (
    <div className="flex min-w-0 flex-col gap-2.5 bg-surface p-4 sm:p-6">
      <span className="truncate text-[12.5px] font-semibold text-fg-2">{label}</span>
      <div className={cn("truncate text-[19px] font-medium tracking-[-0.035em] text-fg sm:text-[24px]", valueClass)}>{value}</div>
      {delta != null ? (
        <div className="flex items-center gap-2 text-[12px]">
          <Delta value={delta} goodWhenUp={goodWhenUp} label={formatPercent(delta, locale, { sign: true })} />
          <span className="truncate text-fg-3">{t("dashboard.vsLastMonth")}</span>
        </div>
      ) : footer ? (
        <div className="flex h-[22px] items-center">{footer}</div>
      ) : (
        <div className="h-[22px]" />
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
      <Skeleton className="h-28" />
      <Skeleton className="h-72" />
    </div>
  );
}
