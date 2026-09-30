import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface UserPermissions {
  id: string;
  employee_id: string;
  can_access_inventory: boolean;
  can_access_hr: boolean;
  can_access_delivery: boolean;
  can_access_transport_logistics: boolean;
  can_access_wedding_invitations: boolean;
  can_access_auto_real_estate: boolean;
  can_access_contracts: boolean;
  can_access_legal: boolean;
  can_access_ai: boolean;
  can_access_settings: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface PermissionsContextType {
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  isAdmin: () => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children, userId }: { children: ReactNode; userId?: string }) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, token } = useAuth();
  const SUPER_ADMIN_EMAIL = 'lahcenm534@gmail.com';

  const fetchPermissions = async () => {
    if (!userId || !token) {
      setLoading(false);
      return;
    }

    // Bypass permissions query for Super Admin to avoid 401/403 errors
    if (user?.email === SUPER_ADMIN_EMAIL) {
      console.log('[Permissions] Super Admin detected - skipping permissions query');
      setPermissions({
        id: 'super-admin',
        employee_id: 'super-admin',
        can_access_inventory: true,
        can_access_hr: true,
        can_access_delivery: true,
        can_access_transport_logistics: true,
        can_access_wedding_invitations: true,
        can_access_auto_real_estate: true,
        can_access_contracts: true,
        can_access_legal: true,
        can_access_ai: true,
        can_access_settings: true,
        is_admin: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[Permissions] Fetching permissions for user:', userId);

      // First, get the employee_id from hr_employees
      const employeesResponse = await api<{ employees: any[] }>('/hr/employees', { token });
      const employeeData = employeesResponse.employees.find((e: any) => e.user_id === userId);

      if (!employeeData) {
        console.log('[Permissions] No employee record found for user:', userId);
        // Don't block the app if no employee record exists
        setLoading(false);
        return;
      }

      const employeeId = employeeData.id;
      console.log('[Permissions] Found employee ID:', employeeId);

      // Now fetch permissions using employee_id
      const response = await api<{ permissions: UserPermissions | null }>(`/hr/permissions/${employeeId}`, { token });

      if (response.permissions) {
        console.log('[Permissions] Permissions fetched:', response.permissions);
        setPermissions(response.permissions);
      } else {
        // Create default permissions if none exist
        console.log('[Permissions] No permissions record found, creating default permissions');
        try {
          const newPermissions: UserPermissions = {
            id: crypto.randomUUID(),
            employee_id: employeeId,
            can_access_inventory: true,
            can_access_hr: true,
            can_access_delivery: true,
            can_access_transport_logistics: true,
            can_access_wedding_invitations: true,
            can_access_auto_real_estate: true,
            can_access_contracts: true,
            can_access_legal: true,
            can_access_ai: true,
            can_access_settings: true,
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await api('/hr/permissions', {
            method: 'POST',
            token,
            body: JSON.stringify(newPermissions)
          });

          console.log('[Permissions] Default permissions created successfully');
          setPermissions(newPermissions);
        } catch (insertErr) {
          console.error('[Permissions] Error creating default permissions:', insertErr);
          // Don't throw, just log and continue
        }
      }
    } catch (err) {
      console.error('[Permissions] Unexpected error in fetchPermissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
      // Don't block the app even on unexpected errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [userId]);

  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (!permissions) return true; // Default to allow if no permissions exist yet
    // Always allow access if user is admin
    if (permissions.is_admin) return true;
    return permissions[permission] === true;
  };

  const isAdmin = (): boolean => {
    // Super admin always has admin privileges
    if (user?.email === SUPER_ADMIN_EMAIL) {
      console.log('[Permissions] User is super admin:', user.email);
      return true;
    }
    
    // Check permissions table
    const isAdminFromPermissions = permissions?.is_admin === true;
    if (isAdminFromPermissions) {
      console.log('[Permissions] User is admin from permissions table:', user?.email);
    }
    
    return isAdminFromPermissions;
  };

  const refreshPermissions = async () => {
    await fetchPermissions();
  };

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading,
        error,
        hasPermission,
        isAdmin,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

export function useRequirePermission(permission: keyof UserPermissions): boolean {
  const { hasPermission, loading } = usePermissions();
  
  if (loading) return false;
  return hasPermission(permission);
}
