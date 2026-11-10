/**
 * Client for the optional server-side AI endpoints. The API key lives only on
 * the server. Every call degrades gracefully to the offline engines.
 */
import { getSupabase } from "../supabase/client";
import type { ParsedTransaction, ParserWallet } from "./parser";
import type { Locale, LocalDate } from "../domain/types";

export class CloudUnavailableError extends Error {}

async function authHeader(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function post<T>(path: string, body: unknown, timeoutMs = 20000): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new CloudUnavailableError("offline");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 503 || res.status === 401 || res.status === 404) throw new CloudUnavailableError(String(res.status));
    if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof CloudUnavailableError) throw e;
    throw new CloudUnavailableError(e instanceof Error ? e.message : "failed");
  } finally {
    clearTimeout(timer);
  }
}

export interface CloudParseInput {
  text: string;
  locale: Locale;
  today: LocalDate;
  categories: { key: string; name: string; kind: "income" | "expense" }[];
  wallets: ParserWallet[];
}

export type CloudParseResult = Partial<Pick<ParsedTransaction, "amount" | "currency" | "type" | "categoryKey" | "walletId" | "date" | "merchant" | "note">>;

export function cloudParse(input: CloudParseInput): Promise<{ draft: CloudParseResult }> {
  return post("/api/ai/parse", input);
}

export interface AdvisorPayload {
  question: string;
  locale: Locale;
  /** Aggregated, privacy-preserving summary — no notes or merchant names. */
  summary: unknown;
  history: { role: "user" | "assistant"; content: string }[];
}

export function cloudAdvisor(payload: AdvisorPayload): Promise<{ answer: string }> {
  return post("/api/ai/advisor", payload, 45000);
}

export interface CloudReceiptInput {
  image: string;
  mediaType: "image/jpeg";
  locale: Locale;
  today: LocalDate;
  categories: { key: string; name: string }[];
}

export function cloudReceipt(input: CloudReceiptInput): Promise<{ receipt: import("./receipt").ReceiptDraft }> {
  return post("/api/ai/receipt", input, 60000);
}
