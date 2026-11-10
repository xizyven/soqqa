"use client";

import { ArrowLeftRight, RotateCcw, Sparkles, Undo2, Repeat } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { IconTile } from "../ui/icon";
import { Money } from "../ui/money";
import { cn } from "../ui/primitives";
import { parseAmount } from "@/lib/money/money";
import type { Category, Transaction, Wallet } from "@/lib/domain/types";

export function TransactionRow({
  tx,
  categories,
  wallets,
  onClick,
  showWallet = true,
  perspectiveWalletId,
}: {
  tx: Transaction;
  categories: Map<string, Category>;
  wallets: Map<string, Wallet>;
  onClick?: () => void;
  showWallet?: boolean;
  /** When viewing one wallet, a transfer into it is shown as an inflow. */
  perspectiveWalletId?: string;
}) {
  const { t, categoryName } = useApp();
  const cat = tx.category_id ? categories.get(tx.category_id) : undefined;
  const wallet = wallets.get(tx.wallet_id);
  const to = tx.to_wallet_id ? wallets.get(tx.to_wallet_id) : undefined;
  const isTransfer = tx.type === "transfer";

  const title = isTransfer
    ? t("tx.transferTo", { from: wallet?.name ?? "—", to: to?.name ?? "—" })
    : tx.merchant || tx.note || categoryName(cat);
  const subtitleParts = [
    isTransfer ? t("tx.types.transfer") : categoryName(cat),
    tx.type === "refund" || tx.type === "reversal" ? t(`tx.types.${tx.type}`) : null,
    showWallet && !isTransfer ? wallet?.name : null,
    tx.merchant && tx.note && !isTransfer ? tx.note : null,
  ].filter(Boolean);

  let amount = parseAmount(tx.amount);
  let currency = tx.currency;
  let tone: "income" | "expense" | "muted" = tx.direction === "in" ? "income" : "expense";
  let sign: "always" | "never" = "always";
  if (isTransfer) {
    tone = "muted";
    if (perspectiveWalletId && perspectiveWalletId === tx.to_wallet_id && tx.to_amount && tx.to_currency) {
      amount = parseAmount(tx.to_amount);
      currency = tx.to_currency;
    } else if (perspectiveWalletId) amount = -amount;
    else sign = "never";
  } else if (tx.direction === "out") amount = -amount;

  const Badge = tx.type === "refund" ? Undo2 : tx.type === "reversal" ? RotateCcw : tx.source === "ai" ? Sparkles : tx.source === "recurring" ? Repeat : null;

  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2">
      {isTransfer ? (
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
          <ArrowLeftRight size={16} />
        </span>
      ) : (
        <IconTile name={cat?.icon ?? "circle-dashed"} color={cat?.color ?? "#64748B"} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium text-fg">{title}</span>
          {Badge && <Badge size={12} className={cn("shrink-0", tx.source === "ai" ? "text-ai" : "text-fg-3")} />}
        </span>
        <span className="block truncate text-[12px] text-fg-3">{subtitleParts.join(" · ")}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <Money value={amount} currency={currency} sign={sign} tone={tone === "muted" ? "muted" : tone} className="text-[14px] font-medium" />
        {isTransfer && tx.to_currency && tx.to_currency !== tx.currency && !perspectiveWalletId && (
          <Money value={parseAmount(tx.to_amount ?? "0")} currency={tx.to_currency} className="text-[11px] text-fg-3" />
        )}
      </span>
    </button>
  );
}
