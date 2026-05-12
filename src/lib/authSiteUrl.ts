/**
 * Production site origin for Supabase OAuth PKCE and email-confirmation redirects.
 * Redirects must be allowlisted in Supabase: Authentication → URL Configuration → Redirect URLs
 * (e.g. `https://www.smartal-idarapro.com/auth/callback`, apex + `smartal-idara.com` if used, and `*.vercel.app` previews).
 *
 * - In the browser: `window.location.origin` so the app works on the custom domain
 *   and on Vercel preview deployments (e.g. `https://my-app.vercel.app`).
 * - In non-browser contexts: `VITE_PUBLIC_APP_URL`, else the default production host below.
 */
function getSiteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  const envUrl = (import.meta.env.VITE_PUBLIC_APP_URL ??
    import.meta.env.NEXT_PUBLIC_APP_URL ??
    import.meta.env.NEXT_PUBLIC_SITE_URL) as string | undefined;
  if (envUrl) return envUrl.trim().replace(/\/$/, "");
  return "https://www.smartal-idarapro.com";
}

/** Use this or `getAuthCallbackUrl` — do not hardcode the production domain (breaks Vercel previews). */
export function getAuthSiteOrigin(): string {
  return getSiteOrigin();
}

export function getAuthCallbackUrl(): string {
  return `${getSiteOrigin()}/auth/callback`;
}
