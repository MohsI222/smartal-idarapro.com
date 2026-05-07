import type { ReactNode } from "react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nProvider, useI18n } from "@/i18n/I18nProvider";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppShell } from "@/components/layout/AppShell";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { AuthCallback } from "@/pages/AuthCallback";
import { DashboardHome } from "@/pages/DashboardHome";

const Pay = lazy(() => import("@/pages/Pay").then((m) => ({ default: m.Pay })));
const SuperAdminDashboard = lazy(() =>
  import("@/pages/SuperAdminDashboard").then((m) => ({ default: m.SuperAdminDashboard }))
);
const HrModule = lazy(() => import("@/pages/modules/HrModule").then((m) => ({ default: m.HrModule })));
const LawModule = lazy(() => import("@/pages/modules/LawModule").then((m) => ({ default: m.LawModule })));
const AccModule = lazy(() => import("@/pages/modules/AccModule").then((m) => ({ default: m.AccModule })));
const EduModule = lazy(() => import("@/pages/modules/EduModule").then((m) => ({ default: m.EduModule })));
const Reminders = lazy(() => import("@/pages/Reminders").then((m) => ({ default: m.Reminders })));
const DevicesSettings = lazy(() =>
  import("@/pages/DevicesSettings").then((m) => ({ default: m.DevicesSettings }))
);
const VisaRadarModule = lazy(() =>
  import("@/pages/modules/VisaRadarModule").then((m) => ({ default: m.VisaRadarModule }))
);
const GovServicesModule = lazy(() =>
  import("@/pages/modules/GovServicesModule").then((m) => ({ default: m.GovServicesModule }))
);
const EduPrintModule = lazy(() =>
  import("@/pages/modules/EduPrintModule").then((m) => ({ default: m.EduPrintModule }))
);
const TechAutoModule = lazy(() =>
  import("@/pages/modules/TechAutoModule").then((m) => ({ default: m.TechAutoModule }))
);
const InternalChatModule = lazy(() =>
  import("@/pages/modules/InternalChatModule").then((m) => ({ default: m.InternalChatModule }))
);
const CorporateAcademyModule = lazy(() =>
  import("@/pages/modules/CorporateAcademyModule").then((m) => ({ default: m.CorporateAcademyModule }))
);
const BusinessToolsModule = lazy(() =>
  import("@/pages/modules/BusinessToolsModule").then((m) => ({ default: m.BusinessToolsModule }))
);
const InventoryPosModule = lazy(() =>
  import("@/pages/modules/InventoryPosModule").then((m) => ({ default: m.InventoryPosModule }))
);
const CompanySetupModule = lazy(() =>
  import("@/pages/modules/CompanySetupModule").then((m) => ({ default: m.CompanySetupModule }))
);
const MemberManagementModule = lazy(() =>
  import("@/pages/modules/MemberManagementModule").then((m) => ({ default: m.MemberManagementModule }))
);
const AdminPlatformSettings = lazy(() =>
  import("@/pages/AdminPlatformSettings").then((m) => ({ default: m.AdminPlatformSettings }))
);
const LegalTermsPage = lazy(() =>
  import("@/pages/LegalTermsPage").then((m) => ({ default: m.LegalTermsPage }))
);
const SecurityPrivacyPage = lazy(() =>
  import("@/pages/SecurityPrivacyPage").then((m) => ({ default: m.SecurityPrivacyPage }))
);
const CguPage = lazy(() => import("@/pages/CguPage").then((m) => ({ default: m.CguPage })));
const TrustCharterPage = lazy(() =>
  import("@/pages/TrustCharterPage").then((m) => ({ default: m.TrustCharterPage }))
);
const SubscriptionContractPage = lazy(() =>
  import("@/pages/SubscriptionContractPage").then((m) => ({ default: m.SubscriptionContractPage }))
);
const TransportLogisticsHub = lazy(() =>
  import("@/pages/modules/TransportLogisticsHub").then((m) => ({ default: m.TransportLogisticsHub }))
);
const TransportLogisticsAdmin = lazy(() =>
  import("@/pages/modules/TransportLogisticsAdmin").then((m) => ({ default: m.TransportLogisticsAdmin }))
);
const TlDepartmentPage = lazy(() =>
  import("@/pages/tl/TlDepartmentPage").then((m) => ({ default: m.TlDepartmentPage }))
);
const TlDeptLandingRedirect = lazy(() =>
  import("@/pages/tl/TlDeptLandingRedirect").then((m) => ({ default: m.TlDeptLandingRedirect }))
);
const SupportPage = lazy(() => import("@/pages/SupportPage").then((m) => ({ default: m.SupportPage })));
const PublicWriterModule = lazy(() =>
  import("@/pages/modules/PublicWriterModule").then((m) => ({ default: m.PublicWriterModule }))
);
const LegalEditor = lazy(() =>
  import("@/pages/modules/LegalEditor").then((m) => ({ default: m.LegalEditor }))
);
const AiMediaLabModule = lazy(() =>
  import("@/pages/modules/AiMediaLabModule").then((m) => ({ default: m.AiMediaLabModule }))
);
const LawyerPortalModule = lazy(() =>
  import("@/pages/modules/LawyerPortalModule").then((m) => ({ default: m.LawyerPortalModule }))
);

function Protected({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060d18] text-slate-400">
        {t("common.loading")}
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/security-privacy" element={<SecurityPrivacyPage />} />
      <Route path="/cgu" element={<CguPage />} />
      <Route path="/trust" element={<TrustCharterPage />} />
      <Route path="/subscription-contract" element={<SubscriptionContractPage />} />
      <Route path="/production" element={<TlDeptLandingRedirect slug="production" />} />
      <Route path="/quality" element={<TlDeptLandingRedirect slug="quality" />} />
      <Route path="/maintenance" element={<TlDeptLandingRedirect slug="maintenance" />} />
      <Route path="/logistics" element={<TlDeptLandingRedirect slug="logistics" />} />
      <Route path="/transport" element={<TlDeptLandingRedirect slug="transport" />} />
      <Route path="/utilities" element={<TlDeptLandingRedirect slug="utilities" />} />
      <Route
        path="/dept/:dept"
        element={
          <Protected>
            <TlDepartmentPage />
          </Protected>
        }
      />
      <Route path="/education/exams" element={<Navigate to="/app/edu?tab=exams" replace />} />
      <Route
        path="/admin-secret-portal"
        element={
          <Protected>
            <SuperAdminDashboard />
          </Protected>
        }
      />
      <Route
        path="/app"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="pay" element={<Pay />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="admin" element={<SuperAdminDashboard />} />
        <Route path="admin/platform" element={<AdminPlatformSettings />} />
        <Route path="hr" element={<HrModule />} />
        <Route path="law" element={<LawModule />} />
        <Route path="acc" element={<AccModule />} />
        <Route path="public" element={<PublicWriterModule />} />
        <Route path="edu" element={<EduModule />} />
        <Route path="education/exams" element={<Navigate to="/app/edu?tab=exams" replace />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="devices" element={<DevicesSettings />} />
        <Route path="visa" element={<VisaRadarModule />} />
        <Route path="inventory" element={<InventoryPosModule />} />
        <Route path="company" element={<CompanySetupModule />} />
        <Route path="members" element={<MemberManagementModule />} />
        <Route path="gov" element={<GovServicesModule />} />
        <Route path="edu-print" element={<EduPrintModule />} />
        <Route path="techauto" element={<TechAutoModule />} />
        <Route path="chat" element={<InternalChatModule />} />
        <Route path="academy" element={<CorporateAcademyModule />} />
        <Route path="tools" element={<BusinessToolsModule />} />
        <Route path="legal-ai" element={<LegalEditor />} />
        <Route path="lawyer" element={<LawyerPortalModule />} />
        <Route path="media-lab" element={<AiMediaLabModule />} />
        <Route path="tl" element={<TransportLogisticsHub />} />
        <Route path="tl/admin" element={<TransportLogisticsAdmin />} />
        <Route path="legal" element={<LegalTermsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function SuspensedAppRoutes() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#060d18] text-slate-400">
          {t("common.loading")}
        </div>
      }
    >
      <AppRoutes />
    </Suspense>
  );
}

const routerBasename =
  import.meta.env.BASE_URL.replace(/\/$/, "") === "" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <SuspensedAppRoutes />
            <Toaster richColors position="top-center" theme="dark" />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
