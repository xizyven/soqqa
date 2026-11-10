/**
 * Recording-activity engine: tracking streaks and forgotten-expense detection.
 *
 * Design rules
 *  - A day with no records is NOT assumed to be a day with missing records.
 *    We only ask, and only when the user's own history makes a gap unusual.
 *  - A day counts as "accounted" when it has at least one record, or when the
 *    user confirmed it ("no spending" / "already recorded everything").
 *  - Thresholds adapt to each user's baseline (last 28 days before today).
 */
import { addDays, daysBetween } from "./dates";
import type { DayReview, LocalDate, Transaction } from "./types";

export const BASELINE_DAYS = 28;
/** Minimum days of history before gaps are judged against a baseline. */
export const MIN_HISTORY_DAYS = 10;

export interface Baseline {
  /** Days in the baseline window that the user has had the app for. */
  days: number;
  /** Share of baseline days with at least one record (0–1). */
  activeRate: number;
  /** Median record count on active days. */
  medianActive: number;
  /** Mean records per baseline day. */
  meanPerDay: number;
}

export interface ActivityIndex {
  counts: Map<LocalDate, number>;
  reviews: Map<LocalDate, DayReview["status"]>;
  first: LocalDate | null;
}

export function indexActivity(transactions: readonly Transaction[], reviews: readonly DayReview[]): ActivityIndex {
  const counts = new Map<LocalDate, number>();
  let first: LocalDate | null = null;
  for (const t of transactions) {
    if (t.deleted_at) continue;
    counts.set(t.local_date, (counts.get(t.local_date) ?? 0) + 1);
    if (!first || t.local_date < first) first = t.local_date;
  }
  const rv = new Map<LocalDate, DayReview["status"]>();
  for (const r of reviews) if (!r.deleted_at) rv.set(r.local_date, r.status);
  return { counts, reviews: rv, first };
}

export function isAccounted(ix: ActivityIndex, date: LocalDate): boolean {
  if ((ix.counts.get(date) ?? 0) > 0) return true;
  const r = ix.reviews.get(date);
  return r === "no_spending" || r === "complete";
}

export function baseline(ix: ActivityIndex, today: LocalDate): Baseline {
  if (!ix.first) return { days: 0, activeRate: 0, medianActive: 0, meanPerDay: 0 };
  const start = maxDate(ix.first, addDays(today, -BASELINE_DAYS));
  const days = Math.max(0, daysBetween(start, today)); // excludes today
  if (days === 0) return { days: 0, activeRate: 0, medianActive: 0, meanPerDay: 0 };
  const active: number[] = [];
  let total = 0;
  for (let i = 0; i < days; i++) {
    const c = ix.counts.get(addDays(start, i)) ?? 0;
    total += c;
    if (c > 0) active.push(c);
  }
  return { days, activeRate: active.length / days, medianActive: median(active), meanPerDay: total / days };
}

export interface Streaks {
  /** Consecutive accounted days ending today (or yesterday while today is still open). */
  current: number;
  longest: number;
  /** Accounted days in the last 30 days (bounded by history). */
  accounted30: number;
  window30: number;
}

export function streaks(ix: ActivityIndex, today: LocalDate): Streaks {
  if (!ix.first) return { current: 0, longest: 0, accounted30: 0, window30: 0 };
  let longest = 0;
  let run = 0;
  const span = daysBetween(ix.first, today);
  for (let i = 0; i <= span; i++) {
    if (isAccounted(ix, addDays(ix.first, i))) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  // Current streak: today counts if accounted; an open (not yet accounted) today doesn't break it.
  let current = 0;
  let d = isAccounted(ix, today) ? today : addDays(today, -1);
  while (d >= ix.first && isAccounted(ix, d)) {
    current += 1;
    d = addDays(d, -1);
  }
  const winStart = maxDate(ix.first, addDays(today, -29));
  const window30 = daysBetween(winStart, today) + 1;
  let accounted30 = 0;
  for (let i = 0; i < window30; i++) if (isAccounted(ix, addDays(winStart, i))) accounted30 += 1;
  return { current, longest, accounted30, window30 };
}

export type GapReason = "none_today" | "missed_day" | "low_day";

export interface GapPrompt {
  date: LocalDate;
  reason: GapReason;
  recorded: number;
  /** The user's typical number of records on an active day (for the explanation). */
  typical: number;
}

export interface GapOptions {
  /** Current local hour (0–23). */
  hour: number;
  /** Earliest hour for the "nothing today" check. */
  reminderHour: number;
  /** How many past days to look back (default 3). */
  lookback?: number;
}

/**
 * Days that look like they may have unrecorded transactions. Conservative by
 * design: requires a habitual baseline and skips any day the user answered.
 */
export function detectGaps(ix: ActivityIndex, today: LocalDate, opts: GapOptions): GapPrompt[] {
  if (!ix.first) return [];
  const b = baseline(ix, today);
  const established = b.days >= MIN_HISTORY_DAYS;
  const typical = Math.max(1, Math.round(b.medianActive));
  const out: GapPrompt[] = [];
  const answered = (d: LocalDate) => ix.reviews.has(d);

  // Today, after the reminder hour, when nothing has been recorded.
  if (opts.hour >= opts.reminderHour && (ix.counts.get(today) ?? 0) === 0 && !answered(today)) {
    // New users get the gentle daily reminder; established users only if they usually record daily.
    if (!established || b.activeRate >= 0.5) out.push({ date: today, reason: "none_today", recorded: 0, typical });
  }

  if (!established) return out;

  const lookback = opts.lookback ?? 3;
  for (let i = 1; i <= lookback; i++) {
    const d = addDays(today, -i);
    if (d < ix.first || answered(d)) continue;
    const c = ix.counts.get(d) ?? 0;
    if (c === 0 && b.activeRate >= 0.6) out.push({ date: d, reason: "missed_day", recorded: 0, typical });
    else if (c > 0 && b.medianActive >= 3 && c <= Math.max(1, Math.floor(b.medianActive / 3))) out.push({ date: d, reason: "low_day", recorded: c, typical });
  }
  return out;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}
