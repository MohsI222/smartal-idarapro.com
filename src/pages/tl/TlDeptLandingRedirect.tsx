import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import type { TlDeptSlug } from "@/lib/tlApi";

/**
 * Short URLs (/production, /logistics, …) → same experience as /dept/:slug
 * (login first if needed, then department workspace / forms).
 */
export function TlDeptLandingRedirect({ slug }: { slug: TlDeptSlug }) {
  const { token, loading } = useAuth();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060d18] text-slate-400">
        {t("common.loading")}
      </div>
    );
  }

  const target = `/dept/${slug}`;
  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(target)}`} replace />;
  }
  return <Navigate to={target} replace />;
}
