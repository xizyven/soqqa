/**
 * Decimal-safe money arithmetic.
 *
 * All monetary amounts are represented as `bigint` minor units ("cents") with a
 * fixed scale of 2 decimal places. Amounts travel between layers (IndexedDB,
 * network, Postgres `numeric(20,2)`) as canonical decimal strings ("45000.00").
 *
 * Exchange rates are decimal strings with up to RATE_SCALE fractional digits and
 * are applied with banker's rounding (round half to even). No binary floating
 * point is ever used to produce a monetary value.
 */

export const AMOUNT_SCALE = 2;
export const RATE_SCALE = 10;
const AMOUNT_FACTOR = 10n ** BigInt(AMOUNT_SCALE);

export type Cents = bigint;

const AMOUNT_RE = /^-?\d+(\.\d+)?$/;

/** Parses a decimal string into minor units. Extra precision is rounded half-even. */
export function parseAmount(input: string | number): Cents {
  const s = typeof input === "number" ? numberToPlainString(input) : input.trim().replace(/[\s  _]/g, "").replace(",", ".");
  if (!AMOUNT_RE.test(s)) throw new Error(`Invalid amount: "${input}"`);
  const { units, scale } = parseDecimal(s);
  return rescale(units, scale, AMOUNT_SCALE);
}

export function tryParseAmount(input: string | null | undefined): Cents | null {
  if (input == null || input === "") return null;
  try {
    return parseAmount(input);
  } catch {
    return null;
  }
}

/** Canonical decimal string with exactly two fractional digits. */
export function toAmountString(c: Cents): string {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  const int = abs / AMOUNT_FACTOR;
  const frac = (abs % AMOUNT_FACTOR).toString().padStart(AMOUNT_SCALE, "0");
  return `${neg ? "-" : ""}${int.toString()}.${frac}`;
}

export function sum(values: Iterable<Cents>): Cents {
  let total = 0n;
  for (const v of values) total += v;
  return total;
}

export function abs(c: Cents): Cents {
  return c < 0n ? -c : c;
}

export function max(a: Cents, b: Cents): Cents {
  return a > b ? a : b;
}

export function min(a: Cents, b: Cents): Cents {
  return a < b ? a : b;
}

/** Integer division with round-half-even. */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("Division by zero");
  const neg = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let q = n / d;
  const r = n % d;
  const twice = r * 2n;
  if (twice > d || (twice === d && q % 2n === 1n)) q += 1n;
  return neg ? -q : q;
}

/** Multiplies an amount by a decimal rate string, rounding half-even to cents. */
export function applyRate(amount: Cents, rate: string): Cents {
  const { units, scale } = parseDecimal(normalizeRate(rate));
  return divRound(amount * units, 10n ** BigInt(scale));
}

/** Divides two amounts into a decimal ratio string (e.g. a transfer's effective rate). */
export function ratio(numerator: Cents, denominator: Cents, scale = RATE_SCALE): string {
  if (denominator === 0n) throw new Error("Division by zero");
  const scaled = divRound(numerator * 10n ** BigInt(scale), denominator);
  return trimDecimal(unitsToString(scaled, scale));
}

/** Divides a decimal rate by another decimal rate, returning a decimal string. */
export function divideRates(a: string, b: string, scale = RATE_SCALE): string {
  const pa = parseDecimal(normalizeRate(a));
  const pb = parseDecimal(normalizeRate(b));
  if (pb.units === 0n) throw new Error("Division by zero rate");
  // a/b = (ua/10^sa) / (ub/10^sb) = ua*10^sb / (ub*10^sa)
  const num = pa.units * 10n ** BigInt(pb.scale) * 10n ** BigInt(scale);
  const den = pb.units * 10n ** BigInt(pa.scale);
  return trimDecimal(unitsToString(divRound(num, den), scale));
}

/** Multiplies two decimal rate strings. */
export function multiplyRates(a: string, b: string, scale = RATE_SCALE): string {
  const pa = parseDecimal(normalizeRate(a));
  const pb = parseDecimal(normalizeRate(b));
  const units = rescale(pa.units * pb.units, pa.scale + pb.scale, scale);
  return trimDecimal(unitsToString(units, scale));
}

/** Multiplies an amount by basis points (1/100 of a percent), half-even. */
export function mulBps(amount: Cents, bps: number): Cents {
  if (!Number.isInteger(bps)) throw new Error("bps must be an integer");
  return divRound(amount * BigInt(bps), 10000n);
}

/** Divides an amount into `parts` equal pieces, half-even. */
export function divideAmount(amount: Cents, parts: number): Cents {
  if (!Number.isInteger(parts) || parts <= 0) throw new Error("parts must be a positive integer");
  return divRound(amount, BigInt(parts));
}

/**
 * Ratio of two amounts as a plain number, for display (percentages, chart
 * scales). Never use the result to derive a monetary value.
 */
export function fraction(part: Cents, whole: Cents): number {
  if (whole === 0n) return 0;
  // Keep 6 significant fractional digits through integer math before converting.
  return Number(divRound(part * 1_000_000n, whole)) / 1_000_000;
}

/** Lossy conversion for charting only. */
export function toChartNumber(c: Cents): number {
  return Number(c) / Number(AMOUNT_FACTOR);
}

export function isValidRate(rate: string): boolean {
  try {
    const { units } = parseDecimal(normalizeRate(rate));
    return units > 0n;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// internals

function normalizeRate(rate: string): string {
  const s = rate.trim().replace(/[\s  _]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid rate: "${rate}"`);
  return s;
}

function parseDecimal(s: string): { units: bigint; scale: number } {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const [int, frac = ""] = body.split(".");
  const units = BigInt(int + frac || "0");
  return { units: neg ? -units : units, scale: frac.length };
}

function rescale(units: bigint, fromScale: number, toScale: number): bigint {
  if (fromScale === toScale) return units;
  if (fromScale < toScale) return units * 10n ** BigInt(toScale - fromScale);
  return divRound(units, 10n ** BigInt(fromScale - toScale));
}

function unitsToString(units: bigint, scale: number): string {
  const neg = units < 0n;
  const a = neg ? -units : units;
  const f = 10n ** BigInt(scale);
  const int = a / f;
  const frac = (a % f).toString().padStart(scale, "0");
  return `${neg ? "-" : ""}${int}${scale > 0 ? "." + frac : ""}`;
}

function trimDecimal(s: string): string {
  if (!s.includes(".")) return s;
  const t = s.replace(/0+$/, "").replace(/\.$/, "");
  return t === "-0" ? "0" : t;
}

function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  // toFixed(6) avoids exponent notation; precision beyond cents is rounded anyway.
  return n.toFixed(6);
}
