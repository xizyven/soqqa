/**
 * Transaction construction. Turns a user draft into a fully-specified,
 * immutable-snapshot transaction record, enforcing financial invariants.
 */
import { applyRate, parseAmount, ratio, toAmountString } from "../money/money";
import { localDateToInstant } from "./dates";
import { RateBook } from "./rates";
import type { Currency, Direction, Transaction, TransactionType, Wallet } from "./types";

export interface TransactionDraft {
  type: TransactionType;
  wallet_id: string;
  amount: string;
  category_id?: string | null;
  local_date: string;
  /** Wall-clock time "HH:MM"; defaults to noon. */
  time?: string;
  note?: string;
  merchant?: string;
  to_wallet_id?: string | null;
  /** Destination amount for cross-currency transfers (optional: computed from rates when absent). */
  to_amount?: string | null;
  related_id?: string | null;
  source?: Transaction["source"];
}

export interface BuildContext {
  wallets: readonly Wallet[];
  transactions: readonly Transaction[];
  base: Currency;
  book: RateBook;
  timezone: string;
  now: Date;
  newId: () => string;
}

export class TransactionError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

function findWallet(ctx: BuildContext, id: string | null | undefined): Wallet {
  const w = ctx.wallets.find((x) => x.id === id && !x.deleted_at);
  if (!w) throw new TransactionError("wallet_not_found");
  return w;
}

/** Remaining refundable amount of an expense (original − existing refunds/reversals). */
export function refundableAmount(original: Transaction, transactions: readonly Transaction[], excludeId?: string): bigint {
  let left = parseAmount(original.amount);
  for (const t of transactions) {
    if (t.deleted_at || t.id === excludeId || t.related_id !== original.id) continue;
    if (t.type === "refund" || t.type === "reversal") left -= parseAmount(t.amount);
  }
  return left;
}

export function buildTransaction(draft: TransactionDraft, ctx: BuildContext, existing?: Transaction): Transaction {
  const wallet = findWallet(ctx, draft.wallet_id);
  const amount = parseAmount(draft.amount);
  if (amount <= 0n) throw new TransactionError("amount_positive");

  let direction: Direction;
  let category_id = draft.category_id ?? null;
  let related_id: string | null = null;

  switch (draft.type) {
    case "income":
      direction = "in";
      break;
    case "expense":
    case "transfer":
      direction = "out";
      break;
    case "refund":
    case "reversal": {
      const original = ctx.transactions.find((t) => t.id === draft.related_id && !t.deleted_at);
      if (!original) {
        if (draft.type === "reversal") throw new TransactionError("original_required");
        // A standalone refund (e.g. merchant credit) is allowed without a link.
        direction = "in";
        break;
      }
      if (original.type === "transfer" || original.type === "refund" || original.type === "reversal")
        throw new TransactionError("invalid_original");
      if (draft.type === "refund" && original.type !== "expense") throw new TransactionError("refund_requires_expense");
      if (original.currency !== wallet.currency) throw new TransactionError("currency_mismatch");
      related_id = original.id;
      category_id = original.category_id;
      const left = refundableAmount(original, ctx.transactions, existing?.id);
      if (amount > left) throw new TransactionError("exceeds_original");
      // A reversal cancels whatever is still outstanding on the original.
      if (draft.type === "reversal" && amount !== left) throw new TransactionError("reversal_full_amount");
      direction = original.direction === "in" ? "out" : "in";
      break;
    }
  }

  let to_wallet_id: string | null = null;
  let to_amount: string | null = null;
  let to_currency: Currency | null = null;
  let transfer_rate: string | null = null;
  if (draft.type === "transfer") {
    const to = findWallet(ctx, draft.to_wallet_id);
    if (to.id === wallet.id) throw new TransactionError("same_wallet");
    to_wallet_id = to.id;
    to_currency = to.currency;
    let dest: bigint;
    if (to.currency === wallet.currency) dest = amount;
    else if (draft.to_amount) dest = parseAmount(draft.to_amount);
    else dest = ctx.book.convert(amount, wallet.currency, to.currency, draft.local_date);
    if (dest <= 0n) throw new TransactionError("amount_positive");
    to_amount = toAmountString(dest);
    transfer_rate = ratio(dest, amount);
    category_id = null;
  }

  // Exchange-rate snapshot. On edit we keep the original snapshot unless the
  // date or currency changed, so editing a note never rewrites history.
  let rate_to_base: string;
  let rate_snapshot_id: string | null;
  let base_currency = ctx.base;
  const keepSnapshot =
    existing && existing.local_date === draft.local_date && existing.currency === wallet.currency;
  if (keepSnapshot) {
    rate_to_base = existing.rate_to_base;
    rate_snapshot_id = existing.rate_snapshot_id;
    base_currency = existing.base_currency;
  } else if (wallet.currency === ctx.base) {
    rate_to_base = "1";
    rate_snapshot_id = null;
  } else {
    const r = ctx.book.resolve(wallet.currency, ctx.base, draft.local_date);
    rate_to_base = r.rate;
    rate_snapshot_id = r.snapshotIds[0] ?? null;
  }
  const base_amount = toAmountString(applyRate(amount, rate_to_base));

  const nowIso = ctx.now.toISOString();
  return {
    id: existing?.id ?? ctx.newId(),
    created_at: existing?.created_at ?? nowIso,
    updated_at: nowIso,
    deleted_at: null,
    version: existing?.version ?? 0,
    type: draft.type,
    direction,
    wallet_id: wallet.id,
    amount: toAmountString(amount),
    currency: wallet.currency,
    category_id,
    occurred_at: localDateToInstant(draft.local_date, ctx.timezone, draft.time ?? "12:00"),
    local_date: draft.local_date,
    note: (draft.note ?? "").trim().slice(0, 500),
    merchant: (draft.merchant ?? "").trim().slice(0, 120),
    base_currency,
    rate_to_base,
    base_amount,
    rate_snapshot_id,
    to_wallet_id,
    to_amount,
    to_currency,
    transfer_rate,
    related_id,
    source: draft.source ?? existing?.source ?? "manual",
  };
}
