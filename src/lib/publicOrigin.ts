/**
 * Public base URL for share links (magic links, PWA /dept URLs, referral registration).
 *
 * - Set **VITE_PUBLIC_APP_URL** (no trailing slash) when the live domain must be fixed
 *   (reverse proxy, wrong Host header, or email templates built server-side).
 * - If unset, uses `window` origin plus **Vite `base`** so subpath deploys (`vite.config base`)
 *   still produce correct absolute links.
 * - On localhost / loopback, forces `http:` so `https://localhost` does not break dev certs.
 */
export function getPublicOrigin(): string {
  const explicit = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  if (typeof window === "undefined") return "";

  const { protocol, hostname, host } = window.location;
  if (!host) return window.location.origin || "";
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local");
  const proto = isLocalHost ? "http:" : protocol;
  const origin = `${proto}//${host}`;
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base === "/" ? "" : base.replace(/\/$/, "");
  return `${origin}${prefix}`;
}
