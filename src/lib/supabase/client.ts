/**
 * Browser Supabase client. Only the public URL and anon key are used here;
 * all data access is protected by Row Level Security. The service-role key is
 * never referenced in client code.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const cloudConfigured = url.length > 0 && anonKey.length > 0;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "soqqa-auth" },
    });
  }
  return client;
}
