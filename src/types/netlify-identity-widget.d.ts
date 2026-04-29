declare module "netlify-identity-widget" {
  export interface NetlifyIdentityUser {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; name?: string; [k: string]: unknown };
    app_metadata?: Record<string, unknown>;
    token?: { access_token?: string; expires_at?: number };
  }

  export interface NetlifyIdentityWidget {
    init(opts?: { APIUrl?: string }): void;
    open(tab?: "login" | "signup"): void;
    close(): void;
    on(event: "init" | "login" | "logout" | "error" | "modal_closed", cb: (user?: NetlifyIdentityUser) => void): void;
    currentUser(): NetlifyIdentityUser | null;
    logout(): void;
  }

  const netlifyIdentity: NetlifyIdentityWidget;
  export default netlifyIdentity;
}
