import type { ReactNode } from "react";
import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { I18nProvider, useI18n } from "@/i18n/I18nProvider";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppShell } from "@/components/layout/AppShell";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { AuthCallback } from "@/pages/AuthCallback";
import { DashboardHome } from "@/pages/DashboardHome";
import { Pay } from "@/pages/Pay";
import { SuperAdminDashboard } from "@/pages/SuperAdminDashboard";
import { HrModule } from "@/pages/modules/HrModule";
import { LawModule } from "@/pages/modules/LawModule";
import { AccModule } from "@/pages/modules/AccModule";
import { EduModule } from "@/pages/modules/EduModule";
import { Reminders } from "@/pages/Reminders";
import { DevicesSettings } from "@/pages/DevicesSettings";
import { VisaRadarModule } from "@/pages/modules/VisaRadarModule";
import { GovServicesModule } from "@/pages/modules/GovServicesModule";
import { EduPrintModule } from "@/pages/modules/EduPrintModule";
import { TechAutoModule } from "@/pages/modules/TechAutoModule";
import { InternalChatModule } from "@/pages/modules/InternalChatModule";
import { CorporateAcademyModule } from "@/pages/modules/CorporateAcademyModule";
import { BusinessToolsModule } from "@/pages/modules/BusinessToolsModule";
import { InventoryPosModule } from "@/pages/modules/InventoryPosModule";
import { CompanySetupModule } from "@/pages/modules/CompanySetupModule";
import { MemberManagementModule } from "@/pages/modules/MemberManagementModule";
import { AdminPlatformSettings } from "@/pages/AdminPlatformSettings";
import { LegalTermsPage } from "@/pages/LegalTermsPage";
import { SecurityPrivacyPage } from "@/pages/SecurityPrivacyPage";
import { CguPage } from "@/pages/CguPage";
import { TrustCharterPage } from "@/pages/TrustCharterPage";
import { SubscriptionContractPage } from "@/pages/SubscriptionContractPage";
import { TransportLogisticsHub } from "@/pages/modules/TransportLogisticsHub";
import { TransportLogisticsAdmin } from "@/pages/modules/TransportLogisticsAdmin";
import { TlDepartmentPage } from "@/pages/tl/TlDepartmentPage";
import { TlDeptLandingRedirect } from "@/pages/tl/TlDeptLandingRedirect";
import { SupportPage } from "@/pages/SupportPage";

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
      <Route
        path="/education/exams"
        element={<Navigate to="/app/edu?tab=exams" replace />}
      />
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
        <Route
          path="education/exams"
          element={<Navigate to="/app/edu?tab=exams" replace />}
        />
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

const routerBasename =
  import.meta.env.BASE_URL.replace(/\/$/, "") === "" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
            <Toaster richColors position="top-center" theme="dark" />
            <SpeedInsights />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
