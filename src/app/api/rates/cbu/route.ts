/**
 * Proxy for the Central Bank of Uzbekistan official daily rates (UZS per unit).
 * The client stores each result as a NEW immutable snapshot; existing rates
 * and historical transactions are never rewritten.
 */
import { authenticate, errorResponse, rateLimit } from "@/lib/server/guard";
import { isValidRate } from "@/lib/money/money";

export const runtime = "nodejs";

const CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/";
const WANTED = new Set(["USD", "EUR", "RUB"]);

interface CbuRow {
  Ccy?: string;
  Rate?: string;
  Nominal?: string;
  Date?: string; // dd.mm.yyyy
}

export async function GET(req: Request) {
  try {
    const identity = await authenticate(req).catch(() => "anonymous");
    rateLimit(identity, "rates", 30);
    const res = await fetch(CBU_URL, { headers: { accept: "application/json" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return Response.json({ error: "upstream_error" }, { status: 502 });
    const rows = (await res.json()) as CbuRow[];
    const rates = rows
      .filter((r) => r.Ccy && WANTED.has(r.Ccy))
      .map((r) => {
        const nominal = Number(r.Nominal ?? "1") || 1;
        const raw = String(r.Rate ?? "").trim();
        const [d, m, y] = String(r.Date ?? "").split(".");
        return { currency: r.Ccy!, rate: raw, nominal, date: y && m && d ? `${y}-${m}-${d}` : null };
      })
      .filter((r) => r.nominal === 1 && isValidRate(r.rate) && r.date);
    return Response.json({ source: "cbu", rates }, { headers: { "cache-control": "public, max-age=1800" } });
  } catch (e) {
    return errorResponse(e);
  }
}
