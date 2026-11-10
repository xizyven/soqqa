"use client";

import { useState } from "react";
import { Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { Sheet, ConfirmDialog } from "../ui/sheet";
import { Badge, Button } from "../ui/primitives";
import { Money } from "../ui/money";
import { IconTile } from "../ui/icon";
import { parseAmount } from "@/lib/money/money";
import { refundableAmount } from "@/lib/domain/transactions";
import { formatDay, formatMoney, formatTime } from "@/lib/i18n";
import { errorMessage } from "@/lib/i18n/translate";
import type { Transaction } from "@/lib/domain/types";

export function TransactionDetail({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const { t, ledger, categoryName, locale, prefs, repo, openQuickAdd, toast } = useApp();
  const [confirm, setConfirm] = useState<"delete" | "reverse" | null>(null);
  if (!tx) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const cat = ledger?.categories.find((c) => c.id === tx.category_id);
  const wallet = ledger?.wallets.find((w) => w.id === tx.wallet_id);
  const to = ledger?.wallets.find((w) => w.id === tx.to_wallet_id);
  const related = tx.related_id ? ledger?.transactions.find((x) => x.id === tx.related_id) : undefined;
  const dependents = (ledger?.transactions ?? []).filter((x) => x.related_id === tx.id);
  const left = tx.type === "income" || tx.type === "expense" ? refundableAmount(tx, ledger?.transactions ?? []) : 0n;
  const amount = parseAmount(tx.amount);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[14px]">
      <dt className="text-fg-3">{label}</dt>
      <dd className="min-w-0 text-right text-fg">{value}</dd>
    </div>
  );

  return (
    <>
      <Sheet open={!!tx && !confirm} onClose={onClose} title={t(`tx.types.${tx.type}`)} width={480}>
        <div className="flex items-center gap-3 pb-3">
          {tx.type === "transfer" ? null : <IconTile name={cat?.icon ?? "circle-dashed"} color={cat?.color ?? "#64748B"} size={44} />}
          <div className="min-w-0">
            <Money
              value={tx.type === "transfer" ? amount : tx.direction === "in" ? amount : -amount}
              currency={tx.currency}
              sign={tx.type === "transfer" ? "never" : "always"}
              tone={tx.type === "transfer" ? undefined : tx.direction === "in" ? "income" : "expense"}
              className="text-[26px] font-semibold tracking-[-0.03em]"
            />
            <p className="truncate text-[13px] text-fg-2">{tx.merchant || tx.note || categoryName(cat)}</p>
          </div>
        </div>
        <dl className="divide-y divide-line border-t border-line">
          {tx.type !== "transfer" && row(t("common.category"), categoryName(cat))}
          {row(tx.type === "transfer" ? t("tx.fromWallet") : t("common.wallet"), wallet?.name ?? "—")}
          {tx.type === "transfer" && row(t("tx.toWallet"), <span>{to?.name ?? "—"} · <Money value={parseAmount(tx.to_amount ?? "0")} currency={tx.to_currency ?? tx.currency} /></span>)}
          {tx.type === "transfer" && tx.to_currency && tx.to_currency !== tx.currency && tx.to_amount &&
            row(t("tx.rate"), <span className="num text-[13px]">{t("tx.rateUsed", { from: tx.currency, rate: tx.transfer_rate ?? "", to: tx.to_currency })}</span>)}
          {row(t("common.date"), `${formatDay(tx.local_date, locale, { weekday: true, year: true })} · ${formatTime(tx.occurred_at, locale, prefs.timezone)}`)}
          {tx.merchant && row(t("tx.merchant"), tx.merchant)}
          {tx.note && row(t("common.note"), <span className="whitespace-pre-wrap">{tx.note}</span>)}
          {tx.currency !== tx.base_currency &&
            row(
              tx.base_currency,
              <span className="text-[13px]">
                {t("tx.baseValue", { amount: formatMoney(parseAmount(tx.base_amount), tx.base_currency, locale) })}
                <span className="num block text-fg-3">{t("tx.rateUsed", { from: tx.currency, rate: tx.rate_to_base, to: tx.base_currency })}</span>
              </span>,
            )}
          {related && row(t("tx.original"), `${related.merchant || related.note || categoryName(ledger?.categories.find((c) => c.id === related.category_id))} · ${formatMoney(parseAmount(related.amount), related.currency, locale)}`)}
          {dependents.length > 0 &&
            row(
              t("tx.types.refund"),
              <span className="flex flex-col items-end gap-1">
                {dependents.map((d) => (
                  <Badge key={d.id} tone="income">{t(`tx.types.${d.type}`)} · {formatMoney(parseAmount(d.amount), d.currency, locale)}</Badge>
                ))}
              </span>,
            )}
          {row(t("common.status"), <Badge tone={tx.source === "ai" ? "ai" : "neutral"}>{t(`tx.source.${tx.source}`)}</Badge>)}
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {tx.type !== "reversal" && (
            <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => { onClose(); openQuickAdd({ editId: tx.id }); }}>
              {t("common.edit")}
            </Button>
          )}
          {tx.type === "expense" && left > 0n && (
            <Button variant="secondary" icon={<Undo2 size={15} />} onClick={() => { onClose(); openQuickAdd({ relatedId: tx.id }); }}>
              {t("tx.refund")}
            </Button>
          )}
          {(tx.type === "expense" || tx.type === "income") && left > 0n && (
            <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={() => setConfirm("reverse")}>
              {t("tx.reverse")}
            </Button>
          )}
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirm("delete")}>
            {t("common.delete")}
          </Button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm === "delete"}
        title={t("common.delete")}
        body={t("tx.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            const ids = [tx.id, ...dependents.map((d) => d.id)];
            await repo.deleteTransaction(tx.id);
            onClose();
            toast({
              message: t("tx.deleted"),
              action: { label: t("common.undo"), run: () => void Promise.all(ids.map((id) => repo.restore("transactions", id))) },
            });
          } catch (e) {
            toast({ message: errorMessage(e, t), tone: "error" });
          }
        }}
      />
      <ConfirmDialog
        open={confirm === "reverse"}
        title={t("tx.reverse")}
        body={t("tx.reverseConfirm")}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await repo.reverseTransaction(tx.id);
            onClose();
            toast({ message: t("tx.saved"), tone: "success" });
          } catch (e) {
            toast({ message: errorMessage(e, t), tone: "error" });
          }
        }}
      />
    </>
  );
}
