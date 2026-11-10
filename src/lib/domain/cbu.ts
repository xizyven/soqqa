/**
 * Central Bank of Uzbekistan official daily rates (UZS per unit). Shared by
 * the server proxy route and the static (GitHub Pages) build, which fetches
 * CBU directly from the browser (CBU sends `Access-Control-Allow-Origin: *`).
 */
import { isValidRate } from "../money/money";

export const CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/";
const WANTED = new Set(["USD", "EUR", "RUB"]);

export interface CbuRow {
  Ccy?: string;
  Rate?: string;
  Nominal?: string;
  Date?: string; // dd.mm.yyyy
}

export interface CbuRate {
  currency: "USD" | "EUR" | "RUB";
  rate: string;
  date: string;
}

export function parseCbuRows(rows: CbuRow[]): CbuRate[] {
  return rows
    .filter((r) => r.Ccy && WANTED.has(r.Ccy))
    .map((r) => {
      const nominal = Number(r.Nominal ?? "1") || 1;
      const raw = String(r.Rate ?? "").trim();
      const [d, m, y] = String(r.Date ?? "").split(".");
      return { currency: r.Ccy as CbuRate["currency"], rate: raw, nominal, date: y && m && d ? `${y}-${m}-${d}` : "" };
    })
    .filter((r) => r.nominal === 1 && isValidRate(r.rate) && r.date)
    .map(({ currency, rate, date }) => ({ currency, rate, date }));
}
