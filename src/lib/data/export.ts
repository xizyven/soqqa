/** Data export helpers (JSON backup, CSV of transactions, monthly report). */
import type { Category, Ledger, Transaction, Wallet } from "../domain/types";
import type { SoqqaDB } from "./db";

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportJson(db: SoqqaDB): Promise<string> {
  const out: Record<string, unknown> = { app: "soqqa", version: 1, exported_at: new Date().toISOString(), kind: db.kind };
  for (const name of ["wallets", "categories", "transactions", "budgets", "goals", "goal_contributions", "exchange_rates", "recurring", "preferences"] as const) {
    out[name] = await db.table(name).toArray();
  }
  return JSON.stringify(out, null, 2);
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function transactionsCsv(txs: Transaction[], ledger: Pick<Ledger, "wallets" | "categories">, categoryName: (c: Category | undefined) => string): string {
  const w = new Map<string, Wallet>(ledger.wallets.map((x) => [x.id, x]));
  const c = new Map<string, Category>(ledger.categories.map((x) => [x.id, x]));
  const header = ["date", "type", "direction", "amount", "currency", "wallet", "to_wallet", "to_amount", "to_currency", "category", "merchant", "note", "base_currency", "rate_to_base", "base_amount", "id"];
  const rows = txs
    .filter((t) => !t.deleted_at)
    .sort((a, b) => a.local_date.localeCompare(b.local_date))
    .map((t) =>
      [
        t.local_date, t.type, t.direction, t.amount, t.currency, w.get(t.wallet_id)?.name, t.to_wallet_id ? w.get(t.to_wallet_id)?.name : "", t.to_amount ?? "", t.to_currency ?? "",
        t.category_id ? categoryName(c.get(t.category_id)) : "", t.merchant, t.note, t.base_currency, t.rate_to_base, t.base_amount, t.id,
      ].map(csvCell).join(","),
    );
  return "﻿" + [header.join(","), ...rows].join("\n");
}
