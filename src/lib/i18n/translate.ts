import { MissingRateError } from "../domain/rates";
import { TransactionError } from "../domain/transactions";
import { ValidationError } from "../data/repo";
import { DICTIONARIES, interpolate, type Dictionary } from "./index";
import type { Locale } from "../domain/types";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends string[] ? never : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dictionary>;
export type TFunction = (key: TKey, params?: Record<string, string | number>) => string;

function lookup(dict: Dictionary, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

export function makeT(locale: Locale): TFunction {
  const dict = DICTIONARIES[locale];
  return (key, params) => interpolate(lookup(dict, key) ?? lookup(DICTIONARIES.uz, key) ?? key, params);
}

/** Loose lookup for dynamic keys (e.g. "category." + systemKey). */
export function tDynamic(locale: Locale, key: string, fallback = ""): string {
  return lookup(DICTIONARIES[locale], key) ?? fallback;
}

/** Maps any thrown error to a localized, user-facing message. */
export function errorMessage(e: unknown, t: TFunction): string {
  if (e instanceof MissingRateError) return t("errors.missing_rate", { currency: e.currency });
  if (e instanceof TransactionError) return tryKey(`errors.${e.code}`, t) ?? t("errors.generic");
  if (e instanceof ValidationError) {
    const first = Object.values(e.issues)[0];
    return (first && tryKey(`errors.${first}`, t)) ?? t("errors.generic");
  }
  if (e instanceof Error && /QuotaExceeded|DatabaseClosed|InvalidState/i.test(e.name + e.message)) return t("errors.storage");
  return t("errors.generic");
}

export function fieldError(code: string | undefined, t: TFunction): string | undefined {
  if (!code) return undefined;
  return tryKey(`errors.${code}`, t) ?? code;
}

function tryKey(key: string, t: TFunction): string | null {
  const v = t(key as TKey);
  return v === key ? null : v;
}
