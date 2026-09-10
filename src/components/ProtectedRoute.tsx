import { ReactNode } from "react";
import { AccessDeniedScreen } from "@/components/AccessDeniedScreen";
import { usePermissions } from "@/context/PermissionsContext";
import type { UserPermissions } from "@/context/PermissionsContext";

interface ProtectedRouteProps {
  children: ReactNode;
  permission: keyof UserPermissions;
  fallback?: ReactNode;
}

export function ProtectedRoute({ children, permission, fallback }: ProtectedRouteProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060d18] text-slate-400">
        Loading permissions...
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return fallback || <AccessDeniedScreen />;
  }

  return <>{children}</>;
}
