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
  /** اضبطها لـ `1` لإجبار استخدام `VITE_API_URL` حتى لو كان دوميناً مختلفاً عن الصفحة (معاينات خاصة). */
  readonly VITE_API_CROSS_ORIGIN?: string;
  /**
   * أصل الـ API: نفس الدومين أو رابط كامل. بدون `/api` يُضاف تلقائياً (انظر `getApiUrlPrefix`).
   * إن وُجد رابط مطلق لمضيف يخالف الصفحة (مثلاً معاينة Vercel + `VITE_API_URL` للإنتاج)، يُستعمل `/api` على نفس الصفحة ما لم تُضبط `VITE_API_CROSS_ORIGIN=1`.
   */
  readonly VITE_API_URL?: string;
  /** في `npm run dev`: `1` يفرض استخدام `VITE_API_URL` بدل الـ proxy المحلي */
  readonly VITE_API_FORCE_REMOTE?: string;
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
