/**
 * Localization runtime and locale-aware formatting. Monetary values are
 * formatted from bigint minor units with string arithmetic (no floats).
 */
import type { Currency, Locale, LocalDate } from "../domain/types";
import { divRound, type Cents } from "../money/money";
import { en } from "./en";
import { ru } from "./ru";
import { uz, type Dictionary } from "./uz";

export type { Dictionary };
export const DICTIONARIES: Record<Locale, Dictionary> = { uz, en, ru };
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "uz", label: "O'zbekcha" },
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
];

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

const NBSP = " ";

const SEPARATORS: Record<Locale, { group: string; decimal: string }> = {
  uz: { group: NBSP, decimal: "," },
  ru: { group: NBSP, decimal: "," },
  en: { group: ",", decimal: "." },
};

const CURRENCY_LABEL: Record<Currency, Record<Locale, { text: string; prefix: boolean }>> = {
  UZS: { uz: { text: "so'm", prefix: false }, ru: { text: "сум", prefix: false }, en: { text: "UZS", prefix: false } },
  USD: { uz: { text: "$", prefix: true }, ru: { text: "$", prefix: false }, en: { text: "$", prefix: true } },
  EUR: { uz: { text: "€", prefix: true }, ru: { text: "€", prefix: false }, en: { text: "€", prefix: true } },
  RUB: { uz: { text: "₽", prefix: false }, ru: { text: "₽", prefix: false }, en: { text: "₽", prefix: false } },
};

export function currencySymbol(currency: Currency, locale: Locale): string {
  return CURRENCY_LABEL[currency][locale].text;
}

/** Display decimals: UZS amounts are shown in whole so'm. */
export function displayDecimals(currency: Currency): number {
  return currency === "UZS" ? 0 : 2;
}

function groupDigits(int: string, sep: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export interface MoneyFormatOptions {
  sign?: "auto" | "always" | "never";
  compact?: boolean;
  symbol?: boolean;
  decimals?: number;
}

export function formatNumber(c: Cents, locale: Locale, decimals: number): string {
  const { group, decimal } = SEPARATORS[locale];
  const neg = c < 0n;
  const a = neg ? -c : c;
  // c is in cents (scale 2); round to requested decimals.
  const factor = 10n ** BigInt(2 - Math.min(2, decimals));
  const rounded = divRound(a, factor);
  const unit = 10n ** BigInt(Math.min(2, decimals));
  const int = (rounded / unit).toString();
  const frac = decimals > 0 ? (rounded % unit).toString().padStart(Math.min(2, decimals), "0") : "";
  return `${neg ? "-" : ""}${groupDigits(int, group)}${frac ? decimal + frac : ""}`;
}

const COMPACT: Record<Locale, { k: string; m: string; b: string }> = {
  uz: { k: "ming", m: "mln", b: "mlrd" },
  ru: { k: "тыс.", m: "млн", b: "млрд" },
  en: { k: "K", m: "M", b: "B" },
};

function compactNumber(c: Cents, locale: Locale): string {
  const neg = c < 0n;
  const a = neg ? -c : c;
  const whole = a / 100n;
  const { decimal } = SEPARATORS[locale];
  const tiers: [bigint, string][] = [
    [1_000_000_000n, COMPACT[locale].b],
    [1_000_000n, COMPACT[locale].m],
    [1_000n, COMPACT[locale].k],
  ];
  for (const [size, label] of tiers) {
    if (whole >= size) {
      const tenths = divRound(whole * 10n, size);
      const int = tenths / 10n;
      const frac = tenths % 10n;
      const num = int >= 100n || frac === 0n ? groupDigits(String(divRound(whole, size)), SEPARATORS[locale].group) : `${int}${decimal}${frac}`;
      const space = locale === "en" ? "" : NBSP;
      return `${neg ? "-" : ""}${num}${space}${label}`;
    }
  }
  return `${neg ? "-" : ""}${whole}`;
}

export function formatMoney(c: Cents, currency: Currency, locale: Locale, opts: MoneyFormatOptions = {}): string {
  const decimals = opts.decimals ?? displayDecimals(currency);
  const abs = c < 0n ? -c : c;
  const body = opts.compact && abs >= 100_000n * 100n ? compactNumber(abs, locale) : formatNumber(abs, locale, decimals);
  const label = CURRENCY_LABEL[currency][locale];
  const withSymbol = opts.symbol === false ? body : label.prefix ? `${label.text}${body}` : `${body}${NBSP}${label.text}`;
  const sign = opts.sign ?? "auto";
  if (sign === "never" || c === 0n) return withSymbol;
  if (c < 0n) return `−${withSymbol}`;
  return sign === "always" ? `+${withSymbol}` : withSymbol;
}

export function formatPercent(value: number, locale: Locale, opts: { sign?: boolean; digits?: number } = {}): string {
  const digits = opts.digits ?? (Math.abs(value) < 0.1 && value !== 0 ? 1 : 0);
  const pct = Math.abs(value) * 100;
  const fixed = pct.toFixed(digits).replace(/\.0+$/, "");
  const [int, frac] = fixed.split(".");
  const body = groupDigits(int, SEPARATORS[locale].group) + (frac ? SEPARATORS[locale].decimal + frac : "");
  const sign = value < 0 ? "−" : opts.sign && value > 0 ? "+" : "";
  return `${sign}${body}${locale === "ru" ? NBSP : ""}%`;
}

function partsOf(date: LocalDate) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

const RU_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function formatDay(date: LocalDate, locale: Locale, opts: { year?: boolean; weekday?: boolean } = {}): string {
  const { y, m, d } = partsOf(date);
  const dict = DICTIONARIES[locale];
  const wd = opts.weekday ? dict.weekdaysShort[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] : "";
  let s: string;
  if (locale === "uz") s = `${d}-${dict.months[m - 1].toLowerCase()}${opts.year ? `, ${y}` : ""}`;
  else if (locale === "ru") s = `${d} ${RU_GENITIVE[m - 1]}${opts.year ? ` ${y}` : ""}`;
  else s = `${dict.monthsShort[m - 1]} ${d}${opts.year ? `, ${y}` : ""}`;
  return wd ? `${wd}, ${s}` : s;
}

export function formatMonth(key: string, locale: Locale, short = false): string {
  const [y, m] = key.split("-").map(Number);
  const dict = DICTIONARIES[locale];
  return short ? dict.monthsShort[m - 1] : `${dict.months[m - 1]} ${y}`;
}

export function formatTime(iso: string, locale: Locale, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "uz" ? "uz-Latn-UZ" : locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

export function relativeDay(date: LocalDate, today: LocalDate, locale: Locale): string {
  const dict = DICTIONARIES[locale];
  if (date === today) return dict.common.today;
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const d = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  if (t - d === 86400000) return dict.common.yesterday;
  return formatDay(date, locale, { weekday: true, year: date.slice(0, 4) !== today.slice(0, 4) });
}
