"use client";

import type { Cents } from "@/lib/money/money";
import type { Currency } from "@/lib/domain/types";
import { formatMoney } from "@/lib/i18n";
import { useApp } from "../providers/app-provider";
import { cn } from "./primitives";

/** Monetary figure in JetBrains Mono with tabular numerals. */
export function Money({
  value,
  currency,
  sign,
  compact,
  tone,
  className,
}: {
  value: Cents;
  currency: Currency;
  sign?: "auto" | "always" | "never";
  compact?: boolean;
  tone?: "auto" | "income" | "expense" | "muted";
  className?: string;
}) {
  const { locale } = useApp();
  const toneClass =
    tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : tone === "muted" ? "text-fg-2" : tone === "auto" ? (value > 0n ? "text-income" : value < 0n ? "text-expense" : "") : "";
  return <span className={cn("num whitespace-nowrap", toneClass, className)}>{formatMoney(value, currency, locale, { sign, compact })}</span>;
}

/** Hero figure: large integer part, quieter currency and decimals. */
export function HeroMoney({ value, currency, className, quiet = "text-fg-3" }: { value: Cents; currency: Currency; className?: string; /** Colour for sign, decimals and currency. */ quiet?: string }) {
  const { locale } = useApp();
  const full = formatMoney(value, currency, locale);
  const m = full.match(/^([−+]?[^\d]*)([\d\s ,.]+?)([.,]\d{2})?(\s?\S*)$/u);
  if (!m) return <span className={cn("num", className)}>{full}</span>;
  const [, pre, int, dec, suffix] = m;
  return (
    <span className={cn("num inline-flex items-baseline whitespace-nowrap", className)}>
      {pre && <span className={cn("mr-0.5 text-[0.6em] font-medium", quiet)}>{pre}</span>}
      <span>{int.trim()}</span>
      {dec && <span className={cn("text-[0.55em]", quiet)}>{dec}</span>}
      {suffix && <span className={cn("ml-2.5 text-[0.36em] font-medium tracking-normal", quiet)}>{suffix.trim()}</span>}
    </span>
  );
}
