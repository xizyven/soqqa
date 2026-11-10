"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeftRight, Pencil, Plus, Wallet as WalletIcon } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useFinance } from "@/components/providers/use-finance";
import { Button, Card, cn, EmptyState, Skeleton, Switch, PageHeader } from "@/components/ui/primitives";
import { HeroMoney, Money } from "@/components/ui/money";
import { IconTile } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { WalletForm } from "@/components/wallets/wallet-form";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { formatMoney, formatPercent } from "@/lib/i18n";
import { parseAmount } from "@/lib/money/money";
import { contributionWalletEffect, walletEffect } from "@/lib/domain/ledger";
import type { Currency, Wallet } from "@/lib/domain/types";

const CURRENCY_COLOR: Record<Currency, string> = { UZS: "#7AA7F7", USD: "#D9A23A", EUR: "#5EE0B0", RUB: "#FF8FA0" };

export default function WalletsPage() {
  const { t, ledger, repo, toast, openQuickAdd, prefs, locale } = useApp();
  const f = useFinance();
  const [params] = useState(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search));
  const [formOpen, setFormOpen] = useState(() => !!params.get("new"));
  const [editing, setEditing] = useState<Wallet | undefined>();
  const [detailId, setDetailId] = useState<string | null>(() => params.get("id"));
  const [showArchived, setShowArchived] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);

  useEffect(() => {
    if (params.toString()) window.history.replaceState(null, "", "/wallets");
  }, [params]);

  const wallets = useMemo(() => [...(ledger?.wallets ?? [])].sort((a, b) => Number(a.archived) - Number(b.archived) || a.sort - b.sort), [ledger]);
  const visible = wallets.filter((w) => showArchived || !w.archived);
  const detail = wallets.find((w) => w.id === detailId);
  const base = prefs.base_currency;

  const mix = useMemo(() => {
    const m = new Map<Currency, { base: bigint; raw: bigint }>();
    for (const e of f.nw.byWallet) {
      const cur = m.get(e.wallet.currency) ?? { base: 0n, raw: 0n };
      m.set(e.wallet.currency, { base: cur.base + e.balanceBase, raw: cur.raw + e.balance });
    }
    const pos = [...m.entries()].filter(([, v]) => v.base > 0n);
    const total = pos.reduce((s, [, v]) => s + v.base, 0n);
    if (total <= 0n || pos.length < 1) return [];
    return pos.map(([currency, v]) => ({ currency, raw: v.raw, share: Number((v.base * 1000n) / total) / 1000 })).sort((a, b) => b.share - a.share);
  }, [f.nw.byWallet]);

  const history = useMemo(() => {
    if (!detail || !ledger) return [];
    return ledger.transactions
      .filter((x) => x.wallet_id === detail.id || x.to_wallet_id === detail.id)
      .sort((a, b) => b.local_date.localeCompare(a.local_date) || b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, 100);
  }, [detail, ledger]);
  const flows = useMemo(() => {
    if (!detail || !ledger) return { inflow: 0n, outflow: 0n, goals: 0n };
    let inflow = 0n;
    let outflow = 0n;
    let goals = 0n;
    for (const x of ledger.transactions) {
      const e = walletEffect(x, detail.id);
      if (e > 0n) inflow += e;
      else outflow -= e;
    }
    for (const c of ledger.contributions) goals += contributionWalletEffect(c, detail.id);
    return { inflow, outflow, goals };
  }, [detail, ledger]);

  if (!ledger) return <Skeleton className="h-96" />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("wallets.title")} description={t("wallets.virtualNote")} />
      <section className="brand-panel girih flex flex-col gap-5 overflow-hidden p-6 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12.5px] font-semibold text-[#A9B7D6]">{t("wallets.totalIn", { currency: base })} · {t("ishkor.walletCount", { n: wallets.filter((w) => !w.archived).length })}</p>
            <HeroMoney value={f.nw.total} currency={base} quiet="text-[#A9B7D6]" className="mt-2 text-[38px] font-medium leading-none tracking-[-0.05em] text-white sm:text-[48px]" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => openQuickAdd({ type: "transfer" })} disabled={wallets.filter((w) => !w.archived).length < 2} className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-white/10 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-40">
              <ArrowLeftRight size={15} />
              {t("tx.types.transfer")}
            </button>
            <button onClick={() => { setEditing(undefined); setFormOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-white px-4 text-[13.5px] font-semibold text-[#071330] transition-colors hover:bg-[#E9F0FD]">
              <Plus size={16} />
              {t("wallets.new")}
            </button>
          </div>
        </div>
        {mix.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div className="flex h-2.5 gap-[3px]" role="img" aria-label={mix.map((c) => `${c.currency} ${formatPercent(c.share, locale)}`).join(", ")}>
              {mix.map((c) => <span key={c.currency} className="h-full rounded-[3px]" style={{ flex: `${Math.max(c.share, 0.01)} 1 0`, background: CURRENCY_COLOR[c.currency] }} />)}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-[#C3CFE8]">
              {mix.map((c) => (
                <span key={c.currency} className="inline-flex items-center gap-1.5">
                  <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden><path d="M5 0L10 5L5 10L0 5Z" fill={CURRENCY_COLOR[c.currency]} /></svg>
                  {c.currency} <b className="num font-semibold text-white">{formatPercent(c.share, locale)}</b>
                  <Money value={c.raw} currency={c.currency} className="text-[#A9B7D6]" />
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={<WalletIcon size={20} />} title={t("wallets.empty")} body={t("wallets.emptyHint")} action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>{t("wallets.new")}</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((w) => {
            const bal = f.balances.get(w.id) ?? 0n;
            const entry = f.nw.byWallet.find((x) => x.wallet.id === w.id);
            return (
              <button
                key={w.id}
                onClick={() => setDetailId(w.id)}
                className={cn("girih group relative flex min-h-[184px] flex-col overflow-hidden rounded-[20px] p-5 text-left text-white shadow-[0_22px_36px_-24px_rgba(7,19,48,0.7)] transition-transform duration-200 hover:-translate-y-0.5", w.archived && "opacity-55")}
                style={{ background: `color-mix(in oklab, ${w.color} 82%, #040A1C)`, ["--ornament" as string]: "rgba(255,255,255,0.14)" }}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold">{w.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-white/80">
                      <span className="num rounded-[5px] bg-white/[0.18] px-1.5 py-0.5 text-[10.5px] font-semibold">{w.currency}</span>
                      {!w.spendable && <span className="rounded-[5px] bg-white/[0.18] px-1.5 py-0.5 text-[10.5px] font-semibold">{t("analytics.savings")}</span>}
                      {w.archived && <span className="rounded-[5px] bg-white/[0.18] px-1.5 py-0.5 text-[10.5px] font-semibold">{t("common.archived")}</span>}
                    </span>
                  </span>
                  <svg width="40" height="22" viewBox="0 0 40 22" aria-hidden className="shrink-0"><path d="M5.2 12.4L31.6 1.4Q37.4 -0.6 38.2 4.6Q38.6 8.6 33.8 10.6L8.4 21.2Q2.6 23 1.8 17.8Q1.4 13.8 5.2 12.4Z" fill="#DCE8FF" fillOpacity="0.9" /></svg>
                </span>
                <span className="mt-auto flex flex-col gap-1 pt-6">
                  <Money value={bal} currency={w.currency} className={cn("text-[26px] font-medium leading-none tracking-[-0.04em]", bal < 0n && "text-[#FFD0D7]")} />
                  {w.currency !== base && entry ? <span className="num text-[12px] text-white/75">≈ {formatMoney(entry.balanceBase, base, locale)}</span> : <span className="h-[18px]" />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <span />
        {wallets.some((w) => w.archived) && (
          <div className="w-full sm:w-64">
            <Switch checked={showArchived} onChange={setShowArchived} label={t("wallets.showArchived")} />
          </div>
        )}
      </div>

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? t("wallets.edit") : t("wallets.new")} width={480}>
        <WalletForm
          wallet={editing}
          onDone={() => {
            setFormOpen(false);
            toast({ message: t("tx.saved"), tone: "success" });
          }}
        />
      </Sheet>

      <Sheet open={!!detail && !formOpen && !txId} onClose={() => setDetailId(null)} title={detail?.name} width={560}>
        {detail && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <IconTile name={detail.icon} color={detail.color} size={44} />
              <div>
                <Money value={f.balances.get(detail.id) ?? 0n} currency={detail.currency} className="text-[26px] font-semibold tracking-[-0.03em]" />
                <p className="text-[12px] text-fg-3">{t("wallets.openingBalance")}: <Money value={parseAmount(detail.opening_balance)} currency={detail.currency} tone="muted" /></p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label={t("wallets.inflow")} value={<Money value={flows.inflow} currency={detail.currency} tone="income" compact />} />
              <Stat label={t("wallets.outflow")} value={<Money value={flows.outflow} currency={detail.currency} tone="expense" compact />} />
              <Stat label={t("nav.goals")} value={<Money value={flows.goals} currency={detail.currency} tone="muted" compact />} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => openQuickAdd({ type: "expense", walletId: detail.id })}>{t("tx.new")}</Button>
              <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => { setEditing(detail); setFormOpen(true); }}>{t("common.edit")}</Button>
              <Button
                size="sm"
                variant="secondary"
                icon={detail.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                onClick={async () => {
                  await repo.setWalletArchived(detail.id, !detail.archived);
                  toast({ message: t("tx.saved"), tone: "success" });
                }}
              >
                {detail.archived ? t("common.unarchive") : t("common.archive")}
              </Button>
            </div>
            {detail.archived && <p className="text-[12px] text-fg-3">{t("wallets.archivedNote")}</p>}
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-3">{t("wallets.history")}</p>
              {history.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-fg-3">{t("tx.empty")}</p>
              ) : (
                <div className="-mx-2">
                  {history.map((x) => (
                    <TransactionRow key={x.id} tx={x} categories={f.categoriesById} wallets={f.walletsById} showWallet={false} perspectiveWalletId={detail.id} onClick={() => setTxId(x.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>
      <TransactionDetail tx={txId ? ledger.transactions.find((x) => x.id === txId) ?? null : null} onClose={() => setTxId(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2.5">
      <p className="text-[11px] text-fg-3">{label}</p>
      <div className="mt-0.5 text-[13px] font-medium">{value}</div>
    </div>
  );
}
