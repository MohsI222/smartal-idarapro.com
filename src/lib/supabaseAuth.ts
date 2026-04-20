import type { Provider } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getAuthCallbackUrl } from "@/lib/authSiteUrl";

export type OAuthProvider = "google" | "facebook" | "apple" | "tiktok";

/** TikTok: يفعّل من لوحة Supabase كمزوّد OAuth مخصّص (مثلاً المعرّف `tiktok` → استخدم `custom:tiktok`). */
const TIKTOK_PROVIDER: Provider = "custom:tiktok";

export function getOAuthCallbackUrl(): string {
  return getAuthCallbackUrl();
}

function toSupabaseProvider(provider: OAuthProvider): Provider {
  if (provider === "tiktok") return TIKTOK_PROVIDER;
  return provider;
}

/**
 * يبدأ تدفق OAuth ويعيد التوجيه إلى مزوّد الهوية. بعد العودة إلى `/auth/callback` يُستكمل الربط مع API المنصة.
 */
export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase غير مضبوط — أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY إلى .env");
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: toSupabaseProvider(provider),
    options: {
      redirectTo: getOAuthCallbackUrl(),
      skipBrowserRedirect: false,
    },
  });
  if (error) throw error;
}
