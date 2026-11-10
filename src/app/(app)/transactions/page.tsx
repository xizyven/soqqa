"use client";

import { useMemo, useState } from "react";
import { Download, Plus, Receipt, Search, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useFinance } from "@/components/providers/use-finance";
import { Button, Card, cn, EmptyState, Input, Segmented, Select, Skeleton, PageHeader } from "@/components/ui/primitives";
import { Money } from "@/components/ui/money";
import { Rhomb } from "@/components/brand/ornaments";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { filterTransactions, summarize, type AnalyticsFilter } from "@/lib/domain/analytics";
import { addDays, monthEnd, monthKey, monthStart, shiftMonthKey } from "@/lib/domain/dates";
import { flowEffect } from "@/lib/domain/ledger";
import { relativeDay } from "@/lib/i18n";
import { download, transactionsCsv } from "@/lib/data/export";
import type { Transaction, TransactionType } from "@/lib/domain/types";

type Period = "month" | "last" | "3m" | "all" | "custom";
type TypeFilter = "all" | "expense" | "income" | "transfer";

export default function TransactionsPage() {
  const { t, ledger, today, locale, openQuickAdd, categoryName, prefs } = useApp();
  const f = useFinance();
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [params] = useState(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search));
  const [walletId, setWalletId] = useState(() => params.get("wallet") ?? "");
  const [categoryId, setCategoryId] = useState(() => params.get("category") ?? "");
  const [period, setPeriod] = useState<Period>(() => (params.get("category") ? "all" : "month"));
  const [from, setFrom] = useState(monthStart(monthKey(today)));
  const [to, setTo] = useState(today);
  const [limit, setLimit] = useState(150);
  const [selected, setSelected] = useState<string | null>(null);

  const range = useMemo((): { from?: string; to?: string } => {
    const m = monthKey(today);
    switch (period) {
      case "month": return { from: monthStart(m), to: monthEnd(m) };
      case "last": return { from: monthStart(shiftMonthKey(m, -1)), to: monthEnd(shiftMonthKey(m, -1)) };
      case "3m": return { from: addDays(today, -90), to: addDays(today, 366) };
      case "custom": return { from, to };
      default: return {};
    }
  }, [period, today, from, to]);

  const filter: AnalyticsFilter = useMemo(() => {
    const types: TransactionType[] | undefined =
      type === "all" ? undefined : type === "expense" ? ["expense", "refund", "reversal"] : type === "income" ? ["income", "reversal"] : ["transfer"];
    return { ...range, walletIds: walletId ? [walletId] : undefined, categoryIds: categoryId ? [categoryId] : undefined, types };
  }, [range, type, walletId, categoryId]);

  const results = useMemo(() => {
    if (!ledger) return [];
    let list = filterTransactions(ledger.transactions, filter);
    if (type === "income") list = list.filter((x) => x.type !== "reversal" || x.direction === "out");
    if (type === "expense") list = list.filter((x) => x.type !== "reversal" || x.direction === "in");
    const s = q.trim().toLowerCase();
    if (s) {
      const digits = s.replace(/[\s ]/g, "");
      list = list.filter((x) => {
        const cat = categoryName(f.categoriesById.get(x.category_id ?? ""));
        return (
          x.note.toLowerCase().includes(s) ||
          x.merchant.toLowerCase().includes(s) ||
          cat.toLowerCase().includes(s) ||
          (/^\d+$/.test(digits) && x.amount.replace(".", "").startsWith(digits) ) ||
          (/^\d+$/.test(digits) && x.amount.split(".")[0].includes(digits))
        );
      });
    }
    return list.sort((a, b) => (b.local_date === a.local_date ? b.occurred_at.localeCompare(a.occurred_at) || b.created_at.localeCompare(a.created_at) : b.local_date.localeCompare(a.local_date)));
  }, [ledger, filter, q, type, categoryName, f.categoriesById]);

  const totals = useMemo(() => {
    if (!ledger) return null;
    const ids = new Set(results.map((r) => r.id));
    return summarize({ ...f.ctx, ledger: { ...ledger, transactions: ledger.transactions.filter((x) => ids.has(x.id)) } });
  }, [results, ledger, f.ctx]);

  const groups = useMemo(() => {
    const out: { date: string; txs: Transaction[]; net: bigint }[] = [];
    for (const tx of results.slice(0, limit)) {
      let g = out[out.length - 1];
      if (!g || g.date !== tx.local_date) {
        g = { date: tx.local_date, txs: [], net: 0n };
        out.push(g);
      }
      g.txs.push(tx);
      const e = flowEffect(tx, f.base, f.ctx.book);
      g.net += e.income - e.expense;
    }
    return out;
  }, [results, limit, f.base, f.ctx.book]);

  const selectedTx = selected ? ledger?.transactions.find((x) => x.id === selected) ?? null : null;
  const hasFilters = !!(q || type !== "all" || walletId || categoryId || period !== "month");
  const categories = (ledger?.categories ?? []).filter((c) => !c.archived).sort((a, b) => (a.kind === b.kind ? a.sort - b.sort : a.kind === "expense" ? -1 : 1));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("tx.title")}
        description={totals && results.length > 0 ? t("tx.count", { n: results.length }) : undefined}
        actions={
          <>
            <Button variant="secondary" icon={<Download size={15} />} onClick={() => ledger && download(`soqqa-transactions-${today}.csv`, transactionsCsv(results, ledger, categoryName), "text/csv;charset=utf-8")} disabled={!results.length}>
              CSV
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => openQuickAdd({ type: "expense" })}>
              {t("tx.new")}
            </Button>
          </>
        }
      />
      <Card padded={false} className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tx.searchPlaceholder")} className="pl-9" aria-label={t("common.search")} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: "all", label: t("common.all") },
                { value: "expense", label: t("tx.types.expense"), tone: "expense" },
                { value: "income", label: t("tx.types.income"), tone: "income" },
                { value: "transfer", label: t("tx.types.transfer"), tone: "accent" },
              ]}
            />
            <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="h-8 w-auto text-[13px]" aria-label={t("tx.period")}>
              <option value="month">{t("analytics.range.month")}</option>
              <option value="last">{t("analytics.previous")}</option>
              <option value="3m">{t("analytics.range.last3")}</option>
              <option value="all">{t("common.all")}</option>
              <option value="custom">{t("analytics.range.custom")}</option>
            </Select>
            {period === "custom" && (
              <span className="flex items-center gap-1">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[13px] text-fg" aria-label={t("common.from")} />
                <span className="text-fg-3">–</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[13px] text-fg" aria-label={t("common.to")} />
              </span>
            )}
            <Select value={walletId} onChange={(e) => setWalletId(e.target.value)} className="h-8 w-auto max-w-[160px] text-[13px]" aria-label={t("tx.filterWallet")}>
              <option value="">{t("tx.filterWallet")}: {t("common.all")}</option>
              {(ledger?.wallets ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-8 w-auto max-w-[180px] text-[13px]" aria-label={t("tx.filterCategory")}>
              <option value="">{t("tx.filterCategory")}: {t("common.all")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
            </Select>
            {hasFilters && (
              <button onClick={() => { setQ(""); setType("all"); setWalletId(""); setCategoryId(""); setPeriod("month"); }} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] text-fg-3 hover:text-fg">
                <X size={13} />
                {t("common.reset")}
              </button>
            )}
          </div>
        </div>
      </Card>

      {totals && results.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[13px] font-medium text-fg-3">
          <span>{t("dashboard.income")}: <Money value={totals.income} currency={prefs.base_currency} tone="income" /></span>
          <span>{t("dashboard.expenses")}: <Money value={totals.expense} currency={prefs.base_currency} tone="expense" /></span>
        </div>
      )}

      {!ledger ? (
        <Skeleton className="h-96" />
      ) : results.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt size={20} />}
            title={hasFilters ? t("tx.emptyFiltered") : t("tx.empty")}
            body={hasFilters ? undefined : t("tx.emptyHint")}
            action={!hasFilters && <Button variant="primary" icon={<Plus size={16} />} onClick={() => openQuickAdd({ type: "expense" })}>{t("tx.new")}</Button>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <Card key={g.date} padded={false} className="px-2 py-2">
              <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1">
                <span className="eyebrow flex items-center gap-1.5"><Rhomb size={5} className="text-brand" />{relativeDay(g.date, today, locale)}</span>
                <Money value={g.net} currency={prefs.base_currency} sign="always" className={cn("text-[12px]", g.net >= 0n ? "text-income" : "text-fg-3")} />
              </div>
              {g.txs.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} categories={f.categoriesById} wallets={f.walletsById} onClick={() => setSelected(tx.id)} perspectiveWalletId={walletId || undefined} />
              ))}
            </Card>
          ))}
          {results.length > limit && (
            <Button variant="secondary" onClick={() => setLimit((l) => l + 150)} className="self-center">
              {t("common.viewAll")} ({results.length - limit})
            </Button>
          )}
        </div>
      )}
      <TransactionDetail tx={selectedTx} onClose={() => setSelected(null)} />
    </div>
  );
}
