/**
 * Calendar helpers. Every transaction stores a `local_date` computed in the
 * user's timezone at entry time, so reports group by the day the user lived
 * through, independent of the device timezone. All arithmetic here operates on
 * "YYYY-MM-DD" strings via UTC dates to avoid DST drift.
 */
import type { LocalDate } from "./types";

export const DEFAULT_TIMEZONE = "Asia/Tashkent";

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dtf(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

function partsOf(date: Date, timeZone: string) {
  const parts = dtf(timeZone).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** Local calendar date of an instant in a timezone. */
export function toLocalDate(instant: Date | string, timeZone = DEFAULT_TIMEZONE): LocalDate {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const p = partsOf(d, safeTz(timeZone));
  return `${p.y}-${p.m}-${p.d}`;
}

export function todayLocal(timeZone = DEFAULT_TIMEZONE, now: Date = new Date()): LocalDate {
  return toLocalDate(now, timeZone);
}

/** Offset (minutes) of a timezone at a given instant. */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const p = partsOf(instant, safeTz(timeZone));
  const asUtc = Date.UTC(+p.y, +p.m - 1, +p.d, +p.h, +p.mi, +p.s);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/**
 * Instant for a local date (at the given local wall-clock time) in a timezone.
 * Used when the user picks a date: we keep the current wall-clock time.
 */
export function localDateToInstant(date: LocalDate, timeZone = DEFAULT_TIMEZONE, time = "12:00"): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = tzOffsetMinutes(guess, safeTz(timeZone));
  return new Date(guess.getTime() - offset * 60000).toISOString();
}

export function isValidLocalDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtc(date: LocalDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): LocalDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Adds months, clamping the day to the target month's length. */
export function addMonths(date: LocalDate, months: number, anchorDay?: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm + 1));
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86400000);
}

/** "YYYY-MM" month key. */
export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

export function monthStart(key: string): LocalDate {
  return `${key}-01`;
}

export function monthEnd(key: string): LocalDate {
  const [y, m] = key.split("-").map(Number);
  return `${key}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
}

export function shiftMonthKey(key: string, delta: number): string {
  return monthKey(addMonths(`${key}-01`, delta));
}

/** Month keys from `from` to `to` inclusive. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let k = from;
  while (k <= to && out.length < 600) {
    out.push(k);
    k = shiftMonthKey(k, 1);
  }
  return out;
}

export function dayOfWeek(date: LocalDate): number {
  return toUtc(date).getUTCDay(); // 0 = Sunday
}

/** Whole months between two dates, counting a partial month as one (min 1). */
export function monthsUntil(from: LocalDate, to: LocalDate): number {
  if (to <= from) return 1;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td > fd) months += 1;
  return Math.max(1, months);
}

function safeTz(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
