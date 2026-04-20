/**
 * Social login is intentionally disabled across the app — only email + password
 * remain on the auth screen. This component is kept (rather than deleted) so any
 * other place that still imports it keeps compiling; it simply renders nothing.
 *
 * To re-enable third-party logins later, restore the previous implementation
 * from git history (commit before the auth-simplification change).
 */
export function SocialAuthButtons(_props: { className?: string }): null {
  return null;
}
