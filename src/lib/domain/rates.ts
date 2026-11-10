/**
 * Historical exchange-rate resolution.
 *
 * Rates are stored as immutable snapshots pivoted on UZS. A conversion for a
 * given date uses the latest snapshot effective on or before that date. New
 * snapshots never rewrite history: transactions keep their own stored rate.
 */
import { applyRate, divideRates, type Cents } from "../money/money";
import type { Currency, ExchangeRate, LocalDate, RateString } from "./types";

export interface ResolvedRate {
  rate: RateString;
  /** Snapshot ids used (one for X→UZS, up to two for cross rates). */
  snapshotIds: string[];
  /** False when no snapshot existed on/before the date and a later one was used. */
  exact: boolean;
  /** Effective date of the oldest snapshot used. */
  effectiveDate: LocalDate | null;
}

export class MissingRateError extends Error {
  constructor(public currency: Currency) {
    super(`No exchange rate available for ${currency}`);
  }
}

/** Index of rate snapshots per currency, sorted by (effective_date, created_at). */
export class RateBook {
  private byCurrency = new Map<Currency, ExchangeRate[]>();

  constructor(rates: readonly ExchangeRate[]) {
    for (const r of rates) {
      if (r.deleted_at) continue;
      const list = this.byCurrency.get(r.currency) ?? [];
      list.push(r);
      this.byCurrency.set(r.currency, list);
    }
    for (const list of this.byCurrency.values()) {
      list.sort((a, b) =>
        a.effective_date === b.effective_date
          ? a.created_at.localeCompare(b.created_at)
          : a.effective_date.localeCompare(b.effective_date),
      );
    }
  }

  has(currency: Currency): boolean {
    return currency === "UZS" || (this.byCurrency.get(currency)?.length ?? 0) > 0;
  }

  /** Snapshot for 1 `currency` in UZS on `date`. */
  snapshot(currency: Currency, date: LocalDate): { row: ExchangeRate | null; exact: boolean } {
    if (currency === "UZS") return { row: null, exact: true };
    const list = this.byCurrency.get(currency);
    if (!list || list.length === 0) throw new MissingRateError(currency);
    // Binary search for last effective_date <= date.
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].effective_date <= date) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (found === -1) return { row: list[0], exact: false };
    return { row: list[found], exact: true };
  }

  latest(currency: Currency): ExchangeRate | null {
    if (currency === "UZS") return null;
    const list = this.byCurrency.get(currency);
    return list && list.length ? list[list.length - 1] : null;
  }

  history(currency: Currency): ExchangeRate[] {
    return [...(this.byCurrency.get(currency) ?? [])];
  }

  /** Rate such that `amount(from) * rate = amount(to)` on `date`. */
  resolve(from: Currency, to: Currency, date: LocalDate): ResolvedRate {
    if (from === to) return { rate: "1", snapshotIds: [], exact: true, effectiveDate: null };
    const a = this.snapshot(from, date);
    const b = this.snapshot(to, date);
    const fromUzs = a.row ? a.row.uzs_per_unit : "1";
    const toUzs = b.row ? b.row.uzs_per_unit : "1";
    const rate = to === "UZS" ? fromUzs : divideRates(fromUzs, toUzs);
    const ids = [a.row?.id, b.row?.id].filter((x): x is string => !!x);
    const dates = [a.row?.effective_date, b.row?.effective_date].filter((x): x is string => !!x).sort();
    return { rate, snapshotIds: ids, exact: a.exact && b.exact, effectiveDate: dates[0] ?? null };
  }

  convert(amount: Cents, from: Currency, to: Currency, date: LocalDate): Cents {
    if (from === to) return amount;
    return applyRate(amount, this.resolve(from, to, date).rate);
  }
}
