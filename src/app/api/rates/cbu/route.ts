/**
 * Proxy for the Central Bank of Uzbekistan official daily rates (UZS per unit).
 * The client stores each result as a NEW immutable snapshot; existing rates
 * and historical transactions are never rewritten.
 */
import { authenticate, errorResponse, rateLimit } from "@/lib/server/guard";
import { CBU_URL, parseCbuRows, type CbuRow } from "@/lib/domain/cbu";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const identity = await authenticate(req).catch(() => "anonymous");
    rateLimit(identity, "rates", 30);
    const res = await fetch(CBU_URL, { headers: { accept: "application/json" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return Response.json({ error: "upstream_error" }, { status: 502 });
    const rates = parseCbuRows((await res.json()) as CbuRow[]);
    return Response.json({ source: "cbu", rates }, { headers: { "cache-control": "public, max-age=1800" } });
  } catch (e) {
    return errorResponse(e);
  }
}
