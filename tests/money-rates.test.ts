import { describe, expect, it } from "vitest";
import { applyRate, divideRates, divRound, mulBps, parseAmount, ratio, sum, toAmountString } from "@/lib/money/money";
import { MissingRateError, RateBook } from "@/lib/domain/rates";
import { rate } from "./fixtures";

describe("money arithmetic", () => {
  it("parses and formats canonical amounts", () => {
    expect(parseAmount("45000")).toBe(4500000n);
    expect(parseAmount("1 250 000,5")).toBe(125000050n);
    expect(toAmountString(parseAmount("-0.5"))).toBe("-0.50");
    expect(() => parseAmount("12abc")).toThrow();
  });

  it("has no binary floating point drift", () => {
    expect(toAmountString(parseAmount("0.1") + parseAmount("0.2"))).toBe("0.30");
    const many = Array.from({ length: 1000 }, () => parseAmount("0.01"));
    expect(toAmountString(sum(many))).toBe("10.00");
  });

  it("rounds half to even", () => {
    expect(divRound(5n, 2n)).toBe(2n); // 2.5 → 2
    expect(divRound(7n, 2n)).toBe(4n); // 3.5 → 4
    expect(divRound(-5n, 2n)).toBe(-2n);
    expect(parseAmount("1.005")).toBe(100n); // 1.005 → 1.00 (even)
    expect(parseAmount("1.015")).toBe(102n); // 1.015 → 1.02 (even)
  });

  it("applies decimal rates exactly", () => {
    expect(toAmountString(applyRate(parseAmount("200"), "12650.45"))).toBe("2530090.00");
    expect(toAmountString(applyRate(parseAmount("45000"), "0.0000790514"))).toBe("3.56");
    expect(ratio(parseAmount("1265045"), parseAmount("100"))).toBe("12650.45");
    expect(divideRates("13800", "12650")).toBe("1.0909090909");
    expect(toAmountString(mulBps(parseAmount("3000000"), 1500))).toBe("450000.00");
  });
});

describe("historical exchange rates", () => {
  const book = new RateBook([
    rate("USD", "12500", "2026-01-01"),
    rate("USD", "12650", "2026-02-01"),
    rate("EUR", "13800", "2026-01-15"),
  ]);

  it("uses the latest snapshot effective on or before the date", () => {
    expect(book.resolve("USD", "UZS", "2026-01-20").rate).toBe("12500");
    expect(book.resolve("USD", "UZS", "2026-02-01").rate).toBe("12650");
    expect(book.resolve("USD", "UZS", "2026-06-01").rate).toBe("12650");
  });

  it("flags approximate conversions before the first snapshot", () => {
    const r = book.resolve("EUR", "UZS", "2026-01-01");
    expect(r.exact).toBe(false);
    expect(r.rate).toBe("13800");
  });

  it("computes cross rates through UZS", () => {
    expect(book.resolve("UZS", "USD", "2026-02-10").rate).toBe("0.0000790514");
    expect(book.resolve("EUR", "USD", "2026-02-10").rate).toBe("1.0909090909");
    expect(toAmountString(book.convert(parseAmount("100"), "USD", "UZS", "2026-01-05"))).toBe("1250000.00");
  });

  it("same-day corrections: the newest created snapshot wins for that day", () => {
    const b = new RateBook([
      rate("USD", "12600", "2026-03-01", { created_at: "2026-03-01T08:00:00Z" }),
      rate("USD", "12610", "2026-03-01", { created_at: "2026-03-01T09:00:00Z" }),
    ]);
    expect(b.resolve("USD", "UZS", "2026-03-01").rate).toBe("12610");
  });

  it("throws when a currency has no rate at all", () => {
    expect(() => new RateBook([]).resolve("RUB", "UZS", "2026-01-01")).toThrow(MissingRateError);
  });
});

describe("percent formatting", () => {
  it("keeps round tens and hundreds (regression: unescaped '.' ate '20' and '100')", async () => {
    const { formatPercent } = await import("@/lib/i18n");
    expect(formatPercent(0.2, "uz")).toBe("20%");
    expect(formatPercent(1, "en")).toBe("100%");
    expect(formatPercent(0.3, "uz", { sign: true })).toBe("+30%");
    expect(formatPercent(0.05, "uz")).toBe("5%");
    expect(formatPercent(0.055, "en")).toBe("5.5%");
    expect(formatPercent(0.14, "uz")).toBe("14%");
  });
});
