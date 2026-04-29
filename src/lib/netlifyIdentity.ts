/**
 * Netlify Identity is intentionally not used — authentication is Supabase + `/api` only.
 * These stubs match the old module surface so imports resolve without `netlify-identity-widget`
 * (avoids extra dependency and keeps AuthContext / landing flows on Supabase).
 *
 * `NETLIFY_IDENTITY_ENABLED` stays false even if legacy env vars exist on Vercel.
 */
export const NETLIFY_IDENTITY_ENABLED = false as const;

export function ensureNetlifyIdentity(): null {
  return null;
}

export function openNetlifyIdentityLogin(): void {}

export function openNetlifyIdentitySignup(): void {}

export function mapNetlifyUserToMetadata(_user: unknown): {
  id: string;
  email: string;
  name: string;
} {
  return { id: "", email: "", name: "" };
}
