/**
 * Server-side protection for API routes: authentication (Supabase JWT when
 * cloud is configured), per-identity rate limiting and body size limits.
 * Server-only: import exclusively from route handlers (never from client components).
 */
import { createClient } from "@supabase/supabase-js";

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Returns a stable identity for rate limiting; throws 401 when auth is required and missing. */
export async function authenticate(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (SUPABASE_URL && SUPABASE_ANON) {
    if (token) {
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await sb.auth.getUser(token);
      if (!error && data.user) return `user:${data.user.id}`;
      throw new HttpError(401, "invalid_session");
    }
    if (process.env.AI_ALLOW_ANONYMOUS !== "true") throw new HttpError(401, "auth_required");
  } else if (process.env.AI_ALLOW_ANONYMOUS !== "true" && process.env.NODE_ENV === "production") {
    // Without cloud auth, AI endpoints stay closed in production unless explicitly opened.
    throw new HttpError(401, "auth_required");
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  return `ip:${ip}`;
}

// Fixed-window limiter (per server instance). For multi-instance deployments,
// back this with a shared store (e.g. Upstash/Redis) — see README.
const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(identity: string, bucket: string, limit: number, windowMs = 60_000): void {
  const key = `${bucket}:${identity}`;
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 5000) for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    return;
  }
  w.count += 1;
  if (w.count > limit) throw new HttpError(429, "rate_limited");
}

export async function readJson(req: Request, maxBytes = 32_000): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new HttpError(413, "payload_too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "payload_too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.code }, { status: e.status });
  console.error("[soqqa api]", e);
  return Response.json({ error: "internal_error" }, { status: 500 });
}
