export type OAuthProvider = "google" | "facebook" | "apple" | "tiktok";

/**
 * OAuth login is no longer supported - Supabase removed.
 * This function throws an error if called.
 */
export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<void> {
  throw new Error("OAuth login is no longer available. Please use email/password login.");
}
