/** Smart defaults for Quick Add, derived from recent behaviour (last 60 days). */
import { addDays } from "./dates";
import type { Ledger, LocalDate } from "./types";

export function smartDefaults(ledger: Pick<Ledger, "transactions" | "wallets">, type: "income" | "expense", today: LocalDate): { walletId: string | null; categoryIds: string[] } {
  const since = addDays(today, -60);
  const wCount = new Map<string, number>();
  const cCount = new Map<string, number>();
  for (const t of ledger.transactions) {
    if (t.deleted_at || t.type !== type || t.local_date < since) continue;
    wCount.set(t.wallet_id, (wCount.get(t.wallet_id) ?? 0) + 1);
    if (t.category_id) cCount.set(t.category_id, (cCount.get(t.category_id) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const active = ledger.wallets.filter((w) => !w.deleted_at && !w.archived).sort((a, b) => a.sort - b.sort);
  const walletId = top(wCount).find((id) => active.some((w) => w.id === id)) ?? active[0]?.id ?? null;
  return { walletId, categoryIds: top(cCount) };
}
