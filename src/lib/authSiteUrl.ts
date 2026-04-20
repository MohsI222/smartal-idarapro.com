/**
 * Production site origin for Supabase OAuth PKCE and email confirmation redirects.
 * Must match the single redirect URL allowlisted in Supabase (Authentication → URL Configuration).
 */
export const AUTH_SITE_ORIGIN = "https://smartal-idarapro.com";

export function getAuthCallbackUrl(): string {
  return `${AUTH_SITE_ORIGIN}/auth/callback`;
}
