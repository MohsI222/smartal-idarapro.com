import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
const supabaseAnonKey = typeof rawKey === "string" ? rawKey.trim() : "";

const isValidUrl = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(supabaseUrl);
const isJwtKey = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(supabaseAnonKey);
const isPublishableKey = /^sb_publishable_[A-Za-z0-9_-]{20,80}$/.test(supabaseAnonKey);
const isValidKey = isJwtKey || isPublishableKey;

if (import.meta.env.DEV && supabaseAnonKey.startsWith("sb_publishable_") && supabaseAnonKey.includes(".")) {
  console.error(
    "[supabase] Your sb_publishable_* key contains a '.' — real publishable keys use only underscores/alphanumerics.",
    "This key will fail with 'Invalid API key'. Copy the exact key from Supabase Dashboard → Project Settings → API."
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl) && Boolean(supabaseAnonKey) && isValidUrl && isValidKey;

if (import.meta.env.DEV) {
  if (!supabaseUrl) {
    console.error("[supabase] VITE_SUPABASE_URL is missing — set it in .env (and on Vercel).");
  } else if (!isValidUrl) {
    console.error(
      "[supabase] VITE_SUPABASE_URL looks malformed:",
      supabaseUrl,
      "— expected https://<project-ref>.supabase.co"
    );
  }
  if (!supabaseAnonKey) {
    console.error("[supabase] VITE_SUPABASE_ANON_KEY is missing — set it in .env (and on Vercel).");
  } else if (!isValidKey) {
    console.error(
      "[supabase] VITE_SUPABASE_ANON_KEY does not look like a valid Supabase key.",
      "Expected either a JWT (eyJ...xxx.yyy.zzz) or a publishable key (sb_publishable_...).",
      "Got prefix:",
      supabaseAnonKey.slice(0, 12) + (supabaseAnonKey.length > 12 ? "…" : "")
    );
  }
}

/**
 * Browser Supabase client — reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
 *
 * Returns `null` when either env var is missing or obviously malformed so the rest
 * of the app can fall back gracefully (e.g. show a clear "Supabase not configured"
 * message instead of triggering the cryptic "Invalid API key" runtime error).
 *
 * OAuth redirect: add `…/auth/callback` under Supabase → Authentication → URL configuration.
 */
export const supabaseClient: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabase = supabaseClient;
