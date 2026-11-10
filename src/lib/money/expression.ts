/**
 * Calculator-style amount input: evaluates "45000+12500-500" with exact
 * decimal arithmetic. Only + and − are supported (sums of receipts).
 */
import { parseAmount, toAmountString, type Cents } from "./money";

export function evaluateExpression(expr: string): Cents | null {
  const cleaned = expr.replace(/[\s ]/g, "").replace(/,/g, ".").replace(/−/g, "-");
  if (!cleaned) return null;
  if (!/^[\d.+-]+$/.test(cleaned)) return null;
  const tokens = cleaned.match(/[+-]?[^+-]+/g);
  if (!tokens) return null;
  let total = 0n;
  for (const tok of tokens) {
    const neg = tok.startsWith("-");
    const body = tok.replace(/^[+-]/, "");
    if (!body || body === ".") return null;
    if ((body.match(/\./g) ?? []).length > 1) return null;
    try {
      const v = parseAmount(body);
      total += neg ? -v : v;
    } catch {
      return null;
    }
  }
  return total;
}

export function hasOperator(expr: string): boolean {
  return /\d[+\-−]/.test(expr);
}

export function expressionToAmount(expr: string): string | null {
  const v = evaluateExpression(expr);
  return v !== null && v > 0n ? toAmountString(v) : null;
}

/** Appends a keypad key to the expression with sane guards. */
export function pressKey(expr: string, key: string, maxDecimals = 2): string {
  if (key === "back") return expr.slice(0, -1);
  if (key === "clear") return "";
  const last = expr.slice(-1);
  const isOp = (c: string) => c === "+" || c === "−" || c === "-";
  if (isOp(key)) {
    if (!expr) return expr;
    if (isOp(last)) return expr.slice(0, -1) + key;
    if (last === ".") return expr.slice(0, -1) + key;
    return expr + key;
  }
  const segment = expr.split(/[+\-−]/).pop() ?? "";
  if (key === ".") {
    if (segment.includes(".")) return expr;
    return expr + (segment === "" ? "0." : ".");
  }
  // digits / "000"
  if (segment.includes(".")) {
    const decs = segment.split(".")[1].length;
    if (decs >= maxDecimals) return expr;
    if (key === "000") return expr;
  }
  if (segment === "0" && key !== ".") return expr.slice(0, -1) + (key === "000" ? "0" : key);
  if (segment === "" && key === "000") return expr;
  if (segment.replace(".", "").length >= 13) return expr;
  return expr + key;
}
