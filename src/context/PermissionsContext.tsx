import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
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
  const { user } = useAuth();
  const SUPER_ADMIN_EMAIL = 'lahcenm534@gmail.com';

  const fetchPermissions = async () => {
    if (!userId || !supabase) {
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
      const { data: employeeData, error: employeeError } = await supabase
        .from('hr_employees')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (employeeError) {
        console.error('[Permissions] Error fetching employee record:', employeeError);
        // Don't block the app if employee fetch fails, just log and continue
        setLoading(false);
        return;
      }

      if (!employeeData) {
        console.log('[Permissions] No employee record found for user:', userId);
        // Don't block the app if no employee record exists
        setLoading(false);
        return;
      }

      const employeeId = employeeData.id;
      console.log('[Permissions] Found employee ID:', employeeId);

      // Now fetch permissions using employee_id
      const { data, error: fetchError } = await supabase
        .from('permissions')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (fetchError) {
        console.warn('[Permissions] Error fetching permissions:', fetchError);
        // If no permissions record exists, create default permissions
        if (fetchError.code === 'PGRST116') {
          console.log('[Permissions] No permissions record found, creating default permissions');
          try {
            const { data: newPermissions, error: insertError } = await supabase
              .from('permissions')
              .insert({
                employee_id: employeeId,
                can_access_inventory: true,
                can_access_hr: true,
                can_access_delivery: true,
                can_access_transport_logistics: true,
                can_access_wedding_invitations: true,
                can_access_auto_real_estate: true,
                can_access_legal: true,
                can_access_ai: true,
                can_access_settings: true,
                is_admin: false,
              })
              .select()
              .single();

            if (insertError) {
              console.error('[Permissions] Error creating default permissions:', insertError);
              // Don't throw, just log and continue
            } else {
              console.log('[Permissions] Default permissions created successfully');
              setPermissions(newPermissions);
            }
          } catch (insertErr) {
            console.error('[Permissions] Silent error in insert operation:', insertErr);
            // Silent catch - don't block the app
          }
        } else {
          // Handle other permission errors gracefully
          console.warn('[Permissions] Non-PGRST116 error:', fetchError.code, fetchError.message);
          // Check if it's a permission/RLS error - might indicate the user doesn't have access
          if (fetchError.code === '42501' || fetchError.message?.includes('permission')) {
            console.warn('[Permissions] RLS permission denied - user may not have access to permissions table');
            // Set default permissions for the user to avoid blocking the app
            setPermissions({
              id: '',
              employee_id: employeeId,
              can_access_inventory: true,
              can_access_hr: true,
              can_access_delivery: true,
              can_access_transport_logistics: true,
              can_access_wedding_invitations: true,
              can_access_auto_real_estate: true,
              can_access_legal: true,
              can_access_ai: true,
              can_access_settings: true,
              is_admin: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          // Don't throw, just log and continue
        }
      } else if (data) {
        console.log('[Permissions] Permissions loaded successfully');
        setPermissions(data);
      } else {
        console.log('[Permissions] No permissions data returned, but no error');
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
    
    // Check if user has admin role from auth.users
    if (user?.user_metadata?.role === 'admin') {
      console.log('[Permissions] User has admin role:', user.email);
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
