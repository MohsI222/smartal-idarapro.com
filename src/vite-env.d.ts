/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_BOOTSTRAP_KEY?: string;
  /** عند `true` يحاول تسجيل دخول المشرف تلقائياً إذا وُجد مفتاح bootstrap */
  readonly VITE_ADMIN_AUTO_LOGIN?: string;
  /**
   * Canonical public site URL for magic links, referrals, TL dept URLs (no trailing slash).
   * Example: https://app.example.com or https://example.com/myapp
   */
  readonly VITE_PUBLIC_APP_URL?: string;
  /** Optional: URL path the app is served under (e.g. `/app/`). Must start with `/`. */
  readonly VITE_BASE_PATH?: string;
  /**
   * Optional API origin for production when the SPA and API share one domain via reverse proxy — leave unset to use `/api`.
   * For a different host, set the full prefix without trailing slash, e.g. `https://api.example.com/api`.
   */
  readonly VITE_API_URL?: string;
  /** Supabase project URL (client-side; use anon key only). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anonymous/public key for browser use. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Next.js-style alias (same as VITE_SUPABASE_URL) — useful on Vercel if you copied Supabase’s Next template. */
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  /** Next.js-style anon key (same as VITE_SUPABASE_ANON_KEY). */
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  /** Next-style canonical URL (optional; browser usually uses window.location). */
  readonly NEXT_PUBLIC_APP_URL?: string;
  readonly NEXT_PUBLIC_SITE_URL?: string;
  /** Optional override for the public-facing super admin email shown in the UI. */
  readonly VITE_SUPER_ADMIN_EMAIL?: string;
  /** Legacy Netlify Identity flags — ignored; auth uses Supabase + API (see `netlifyIdentity.ts` stubs). */
  readonly VITE_USE_NETLIFY_IDENTITY?: string;
  readonly VITE_NETLIFY_IDENTITY_URL?: string;
}
