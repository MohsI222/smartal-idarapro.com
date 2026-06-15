/**
 * طبقة الحماية والـ CORS لـ Express (المشروع ليس Next.js — لا يوجد `middleware.ts` على مستوى الجذر).
 *
 * يستوردها `server/index.ts`: Helmet، CORS، وفحص Origin على `/api/auth` عند تفعيل `AUTH_STRICT_ORIGIN=true`.
 */
export {
  applySecurityMiddleware,
  authAdminBootstrapLimiter,
  authLoginLimiter,
  authRegisterLimiter,
  authSupabaseOauthLimiter,
  createAuthOriginGuard,
  createProductionCorsOptions,
  isTrustedBrowserOrigin,
} from "./authSecurity.js";
