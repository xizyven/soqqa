"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useFinance } from "@/components/providers/use-finance";
import { Badge, Button, Card, cn, EmptyState, Field, Input, KhatamProgress, Segmented, Select, Skeleton, PageHeader } from "@/components/ui/primitives";
import { goalTone } from "@/components/ui/finance-bits";
import { Khatam } from "@/components/brand/ornaments";
import { Money } from "@/components/ui/money";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { GOAL_ICONS, PALETTE } from "@/lib/domain/defaults";
import { CURRENCIES, type Currency, type Goal, type GoalStatus } from "@/lib/domain/types";
import type { GoalProgress } from "@/lib/domain/planning";
import { formatDay, formatMoney, formatPercent } from "@/lib/i18n";
import { parseAmount } from "@/lib/money/money";
import { ValidationError } from "@/lib/data/repo";
import { errorMessage, fieldError } from "@/lib/i18n/translate";
import { RateBook } from "@/lib/domain/rates";

export default function GoalsPage() {
  const { t, ledger, locale } = useApp();
  const f = useFinance();
  const [form, setForm] = useState<{ open: boolean; goal?: Goal }>({ open: false });
  const [contrib, setContrib] = useState<{ goal: Goal; kind: "contribution" | "withdrawal" } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = f.goals.find((g) => g.goal.id === detailId);

  if (!ledger) return <Skeleton className="h-96" />;
  const active = f.goals;
  const featured = active.find((g) => g.state === "behind" || g.state === "overdue") ?? active.find((g) => g.state !== "completed") ?? active[0];
  const rest = active.filter((g) => g !== featured);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("goals.title")} description={t("goals.walletNote")} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ open: true })}>{t("goals.new")}</Button>} />
      {f.goals.length === 0 ? (
        <Card><EmptyState icon={<Target size={20} />} title={t("goals.empty")} body={t("goals.emptyHint")} action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ open: true })}>{t("goals.new")}</Button>} /></Card>
      ) : (
        <>
          {featured && <FeaturedGoal p={featured} onOpen={() => setDetailId(featured.goal.id)} onContribute={(kind) => setContrib({ goal: featured.goal, kind })} />}
          {rest.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((g) => <GoalCard key={g.goal.id} p={g} onOpen={() => setDetailId(g.goal.id)} onContribute={(kind) => setContrib({ goal: g.goal, kind })} />)}
            </div>
          )}
        </>
      )}

      <GoalForm state={form} onClose={() => setForm({ open: false })} />
      <ContributionForm state={contrib} onClose={() => setContrib(null)} />
      <Sheet open={!!detail && !form.open && !contrib} onClose={() => setDetailId(null)} title={detail?.goal.name} width={520}>
        {detail && (
          <div className="flex flex-col gap-4">
            <GoalSummary p={detail} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="income" icon={<ArrowDownLeft size={14} />} onClick={() => setContrib({ goal: detail.goal, kind: "contribution" })}>{t("goals.contribute")}</Button>
              <Button size="sm" variant="secondary" icon={<ArrowUpRight size={14} />} disabled={detail.saved <= 0n} onClick={() => setContrib({ goal: detail.goal, kind: "withdrawal" })}>{t("goals.withdraw")}</Button>
              <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setForm({ open: true, goal: detail.goal })}>{t("common.edit")}</Button>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-3">{t("goals.history")}</p>
              <ul className="divide-y divide-line">
                {ledger.contributions
                  .filter((c) => c.goal_id === detail.goal.id)
                  .sort((a, b) => b.local_date.localeCompare(a.local_date))
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                      <span className="min-w-0">
                        <span className="block text-fg">{c.kind === "contribution" ? t("goals.contribution") : t("goals.withdrawal")}</span>
                        <span className="block truncate text-[12px] text-fg-3">
                          {formatDay(c.local_date, locale, { year: true })}
                          {c.wallet_id ? ` · ${f.walletsById.get(c.wallet_id)?.name ?? ""}` : ""}
                          {c.note ? ` · ${c.note}` : ""}
                        </span>
                      </span>
                      <Money value={c.kind === "contribution" ? parseAmount(c.amount) : -parseAmount(c.amount)} currency={detail.goal.currency} sign="always" tone={c.kind === "contribution" ? "income" : "expense"} />
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** The goal that most needs attention, on the navy brand panel. */
function FeaturedGoal({ p, onOpen, onContribute }: { p: GoalProgress; onOpen: () => void; onContribute: (k: "contribution" | "withdrawal") => void }) {
  const { t, locale } = useApp();
  const tone = goalTone(p.state);
  const badge = tone === "income" ? "bg-[rgba(60,203,156,0.16)] text-[#5EE0B0]" : tone === "warning" || tone === "gold" ? "bg-[rgba(240,190,90,0.16)] text-[#F2CF7E]" : tone === "expense" ? "bg-[rgba(255,143,160,0.16)] text-[#FF8FA0]" : "bg-white/10 text-[#C3CFE8]";
  const stats: [string, React.ReactNode][] = [
    [t("goals.requiredMonthly"), p.requiredMonthly === null ? "—" : formatMoney(p.requiredMonthly, p.goal.currency, locale)],
    [t("goals.recentMonthly"), formatMoney(p.recentMonthly, p.goal.currency, locale)],
    [t("goals.remaining"), formatMoney(p.remaining, p.goal.currency, locale)],
    [t("goals.targetDate"), p.goal.target_date ? formatDay(p.goal.target_date, locale, { year: true }) : "—"],
  ];
  return (
    <section className="brand-panel girih flex animate-rise flex-col gap-6 overflow-hidden p-6 sm:p-7 lg:flex-row lg:items-center">
      <button onClick={onOpen} className="flex min-w-0 items-center gap-5 text-left lg:flex-1">
        <KhatamProgress value={p.progress} size={124} color="#7AA7F7" track="rgba(160,190,255,0.22)" strokeWidth={1.3} label={formatPercent(p.progress, locale)}>
          <span className="num text-[22px] font-semibold text-white">{formatPercent(p.progress, locale)}</span>
        </KhatamProgress>
        <span className="flex min-w-0 flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A9B7D6]">{t("ishkor.featured")}</span>
          <span className="display truncate text-[24px] font-semibold text-white sm:text-[28px]">{p.goal.name}</span>
          <span className="num text-[14px] text-[#C3CFE8]">
            {formatMoney(p.saved, p.goal.currency, locale)} / {formatMoney(p.target, p.goal.currency, locale)}
          </span>
          <span className={cn("inline-flex h-[22px] w-fit items-center gap-1.5 rounded-[6px] px-2 text-[11.5px] font-semibold", badge)}>
            <Khatam size={9} />
            {t(`goals.states.${p.state}`)}
          </span>
        </span>
      </button>
      <div className="flex flex-col gap-4 lg:w-[44%]">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-[14px] bg-white/[0.06] p-4">
          {stats.map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-col gap-1">
              <dt className="truncate text-[11.5px] text-[#A9B7D6]">{k}</dt>
              <dd className="num truncate text-[14px] font-semibold text-white">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2">
          <button onClick={() => onContribute("contribution")} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] bg-white text-[13.5px] font-semibold text-[#071330] transition-colors hover:bg-[#E9F0FD]">
            <ArrowDownLeft size={15} />
            {t("goals.contribute")}
          </button>
          <button onClick={() => onContribute("withdrawal")} disabled={p.saved <= 0n} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] bg-white/10 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-40">
            <ArrowUpRight size={15} />
            {t("goals.withdraw")}
          </button>
        </div>
      </div>
    </section>
  );
}

function GoalCard({ p, onOpen, onContribute }: { p: GoalProgress; onOpen: () => void; onContribute: (k: "contribution" | "withdrawal") => void }) {
  const { t, locale } = useApp();
  return (
    <div className="card card-hover flex flex-col p-5">
      <button onClick={onOpen} className="flex items-center gap-4 text-left">
        <KhatamProgress value={p.progress} color={p.goal.color} size={72} label={formatPercent(p.progress, locale)}>
          <span className="num text-[13px] font-semibold text-fg">{formatPercent(p.progress, locale)}</span>
        </KhatamProgress>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="flex items-center gap-2 truncate text-[15px] font-semibold text-fg">
            <Icon name={p.goal.icon} size={15} className="shrink-0 text-fg-3" />
            <span className="truncate">{p.goal.name}</span>
          </p>
          <p className="num truncate text-[12.5px] text-fg-2">
            {formatMoney(p.saved, p.goal.currency, locale)} <span className="text-fg-3">/ {formatMoney(p.target, p.goal.currency, locale)}</span>
          </p>
          <Badge tone={goalTone(p.state)} glyph={p.state === "paused" ? "rhomb" : "star"} className="w-fit">{t(`goals.states.${p.state}`)}</Badge>
        </div>
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-3">
        {p.goal.target_date && <span>{formatDay(p.goal.target_date, locale, { year: true })}</span>}
        {p.monthsLeft !== null && p.monthsLeft > 0 && <span>· {t("goals.monthsLeft", { n: p.monthsLeft })}</span>}
      </div>
      {p.requiredMonthly !== null && p.state !== "completed" && (
        <p className="mt-1.5 text-[12.5px] text-fg-2">
          {t("goals.requiredMonthly")}: <Money value={p.requiredMonthly} currency={p.goal.currency} className="font-semibold text-fg" />
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" icon={<ArrowDownLeft size={14} className="text-income" />} onClick={() => onContribute("contribution")}>{t("goals.contribute")}</Button>
        <Button size="sm" variant="ghost" icon={<ArrowUpRight size={14} />} onClick={() => onContribute("withdrawal")} disabled={p.saved <= 0n}>{t("goals.withdraw")}</Button>
      </div>
    </div>
  );
}

function GoalSummary({ p }: { p: GoalProgress }) {
  const { t, locale } = useApp();
  const items: [string, React.ReactNode][] = [
    [t("goals.saved"), <Money key="s" value={p.saved} currency={p.goal.currency} />],
    [t("goals.remaining"), <Money key="r" value={p.remaining} currency={p.goal.currency} />],
    [t("goals.recentMonthly"), <Money key="m" value={p.recentMonthly} currency={p.goal.currency} />],
    [t("goals.requiredMonthly"), p.requiredMonthly === null ? "—" : <Money key="q" value={p.requiredMonthly} currency={p.goal.currency} />],
  ];
  return (
    <div className="flex items-center gap-4">
      <KhatamProgress value={p.progress} color={p.goal.color} size={96} label={formatPercent(p.progress, locale)}>
        <span className="num text-[15px] font-semibold text-fg">{formatPercent(p.progress, locale)}</span>
      </KhatamProgress>
      <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11.5px] text-fg-3">{k}</dt>
            <dd className="font-medium text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function GoalForm({ state, onClose }: { state: { open: boolean; goal?: Goal }; onClose: () => void }) {
  const { t, repo, toast, prefs, today } = useApp();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [currency, setCurrency] = useState<Currency>(prefs.base_currency);
  const [date, setDate] = useState("");
  const [monthly, setMonthly] = useState("");
  const [icon, setIcon] = useState<string>("target");
  const [color, setColor] = useState<string>(PALETTE[2]);
  const [status, setStatus] = useState<GoalStatus>("active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (state.open !== lastOpen) {
    setLastOpen(state.open);
    if (state.open) {
      const g = state.goal;
      setName(g?.name ?? "");
      setTarget(g ? g.target_amount.replace(/\.00$/, "") : "");
      setCurrency(g?.currency ?? prefs.base_currency);
      setDate(g?.target_date ?? "");
      setMonthly(g?.monthly_target ? g.monthly_target.replace(/\.00$/, "") : "");
      setIcon(g?.icon ?? "target");
      setColor(g?.color ?? PALETTE[2]);
      setStatus(g?.status ?? "active");
      setErrors({});
    }
  }
  const clean = (s: string) => s.replace(/[\s ]/g, "").replace(",", ".");
  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      await repo.saveGoal({ name, target_amount: clean(target), currency, target_date: date || null, monthly_target: monthly ? clean(monthly) : null, icon, color, status }, state.goal?.id);
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
    <Sheet open={state.open} onClose={onClose} title={state.goal ? t("goals.edit") : t("goals.new")} width={480}>
      <div className="flex flex-col gap-4">
        <Field label={t("common.name")} error={fieldError(errors.name, t)}>
          <Input data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="MacBook Pro" />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label={t("goals.target")} error={fieldError(errors.target_amount, t)}>
            <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.,\s]/g, ""))} className="num" />
          </Field>
          <Field label={t("common.currency")} error={fieldError(errors.currency, t)}>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="w-24">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t("goals.targetDate")} · ${t("common.optional")}`} error={fieldError(errors.target_date, t)}>
            <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("goals.monthlyTarget")} error={fieldError(errors.monthly_target, t)}>
            <Input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value.replace(/[^\d.,\s]/g, ""))} className="num" />
          </Field>
        </div>
        <Field label={t("common.icon")}>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_ICONS.map((i) => (
              <button key={i} type="button" onClick={() => setIcon(i)} aria-pressed={icon === i} aria-label={i} className={cn("flex size-10 items-center justify-center rounded-xl border", icon === i ? "border-accent bg-accent-soft text-fg" : "border-line bg-surface-2 text-fg-2")}>
                <Icon name={i} size={18} />
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("common.color")}>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface", color === c && "ring-2 ring-fg")} style={{ background: c }} />)}
          </div>
        </Field>
        {state.goal && (
          <Field label={t("common.status")}>
            <Segmented size="sm" value={status} onChange={setStatus} options={(["active", "paused", "completed", "archived"] as const).map((s) => ({ value: s, label: t(`goals.statuses.${s}`) }))} />
          </Field>
        )}
        {errors.currency === "currency_locked" && <p className="text-[12px] text-expense">{t("errors.currency_locked")}</p>}
        <div className="flex gap-2">
          {state.goal && (
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={async () => { await repo.softDelete("goals", state.goal!.id); toast({ message: t("tx.deleted") }); onClose(); }}>{t("common.delete")}</Button>
          )}
          <Button variant="primary" className="flex-1" loading={busy} onClick={() => void save()}>{t("common.save")}</Button>
        </div>
      </div>
    </Sheet>
  );
}

function ContributionForm({ state, onClose }: { state: { goal: Goal; kind: "contribution" | "withdrawal" } | null; onClose: () => void }) {
  const { t, ledger, repo, toast, today, locale } = useApp();
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = state ? `${state.goal.id}:${state.kind}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (state) {
      setAmount("");
      setWalletId(ledger?.wallets.find((w) => !w.archived && w.currency === state.goal.currency)?.id ?? "");
      setWalletAmount("");
      setDate(today);
      setNote("");
      setErrors({});
    }
  }
  const wallet = ledger?.wallets.find((w) => w.id === walletId);
  const cross = !!(state && wallet && wallet.currency !== state.goal.currency);
  const estimate = useMemo(() => {
    if (!cross || !state || !wallet || !ledger) return null;
    try {
      const a = parseAmount(amount.replace(/[\s ]/g, "").replace(",", ".") || "0");
      return a > 0n ? new RateBook(ledger.rates).convert(a, state.goal.currency, wallet.currency, date) : null;
    } catch {
      return null;
    }
  }, [cross, state, wallet, ledger, amount, date]);
  const clean = (s: string) => s.replace(/[\s ]/g, "").replace(",", ".");
  const save = async () => {
    if (!state) return;
    setBusy(true);
    setErrors({});
    try {
      await repo.addContribution({ goal_id: state.goal.id, kind: state.kind, amount: clean(amount), wallet_id: walletId || null, wallet_amount: cross && walletAmount ? clean(walletAmount) : null, local_date: date, note });
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
    <Sheet open={!!state} onClose={onClose} title={state ? `${state.kind === "contribution" ? t("goals.contribute") : t("goals.withdraw")} · ${state.goal.name}` : ""} width={460}>
      {state && (
        <div className="flex flex-col gap-4">
          <Field label={`${t("common.amount")} (${state.goal.currency})`} error={fieldError(errors.amount === "exceeds_saved" ? "exceeds_saved" : errors.amount, t)}>
            <Input data-autofocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ""))} className="num text-lg" />
          </Field>
          <Field label={state.kind === "contribution" ? t("goals.fromWallet") : t("goals.toWallet")} error={fieldError(errors.wallet_id, t)} hint={t("goals.walletNote")}>
            <Select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
              <option value="">{t("goals.noWallet")}</option>
              {(ledger?.wallets ?? []).filter((w) => !w.archived).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}
            </Select>
          </Field>
          {cross && wallet && (
            <Field label={`${t("common.amount")} (${wallet.currency})`} hint={estimate !== null ? `≈ ${formatMoney(estimate, wallet.currency, locale)} · ${t("common.estimate")}` : t("errors.missing_rate", { currency: wallet.currency })}>
              <Input inputMode="decimal" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value.replace(/[^\d.,\s]/g, ""))} className="num" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.date")}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={`${t("common.note")} · ${t("common.optional")}`}>
              <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <Button variant={state.kind === "contribution" ? "income" : "primary"} loading={busy} onClick={() => void save()}>{t("common.save")}</Button>
        </div>
      )}
    </Sheet>
  );
}

