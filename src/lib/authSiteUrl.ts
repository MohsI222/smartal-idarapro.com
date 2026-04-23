/**
 * Returns the site origin to use for Supabase OAuth PKCE and email redirects.
 *
 * - In the browser: uses window.location.origin so the site works on
 *   both the custom domain (https://smartal-idarapro.com) AND the
 *   Vercel preview URL (https://smartal-idaraprocom.vercel.app).
 * - In SSR / non-browser contexts: falls back to VITE_PUBLIC_APP_URL or
 *   the hardcoded production domain.
 *
 * IMPORTANT: Add BOTH redirect URLs in Supabase Dashboard ->
 *   Authentication -> URL Configuration -> Redirect URLs:
 *     https://smartal-idarapro.com/auth/callback
 *     https://smartal-idaraprocom.vercel.app/auth/callback
 *     https://*.vercel.app/auth/callback   (wildcard covers all previews)
 */
function getSiteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  const envUrl = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (envUrl) return envUrl.trim().replace(/\/$/, "");
  return "https://smartal-idarapro.com";
}

export const AUTH_SITE_ORIGIN = "https://smartal-idarapro.com";

export function getAuthCallbackUrl(): string {
  return `${getSiteOrigin()}/auth/callback`;
}
