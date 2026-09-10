import { useState, useEffect } from 'react';
import { Shield, Loader2, Search, Crown, UserPlus, Lock, Unlock, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { EmployeeListInline } from '@/components/hr/EmployeeListInline';

interface HrEmployee {
  id: string;
  user_id: string;
  name: string;
  employee_id: string;
  work_number: string | null;
}

interface UserPermissions {
  employee_id: string;
  can_access_inventory: boolean;
  can_access_hr: boolean;
  can_access_delivery: boolean;
  can_access_transport_logistics: boolean;
  can_access_wedding_invitations: boolean;
  can_access_legal: boolean;
  can_access_ai: boolean;
  can_access_settings: boolean;
  is_admin: boolean;
}

interface Section {
  key: keyof UserPermissions;
  label: string;
  icon: string;
  description: string;
}

interface PermissionsManagerListProps {
  isAdmin: boolean;
}

const SECTIONS: Section[] = [
  { key: 'can_access_inventory', label: 'المخزون / Inventory', icon: '📦', description: 'نظام إدارة المخزون ونقاط البيع' },
  { key: 'can_access_hr', label: 'الموارد البشرية / HR', icon: '👥', description: 'إدارة الموظفين والرواتب' },
  { key: 'can_access_delivery', label: 'التوصيل / Delivery', icon: '🚚', description: 'مركز التوصيل والطلبات' },
  { key: 'can_access_transport_logistics', label: 'النقل واللوجيستيك / Logistics', icon: '🚛', description: 'إدارة النقل واللوجيستيك' },
  { key: 'can_access_wedding_invitations', label: 'دعوات الأعراس / Weddings', icon: '🎉', description: 'إدارة دعوات الأعراس والمناسبات' },
  { key: 'can_access_legal', label: 'القانوني / Legal', icon: '⚖️', description: 'المستندات القانونية والعقود' },
  { key: 'can_access_ai', label: 'الذكاء الاصطناعي / AI', icon: '🤖', description: 'ميزات الذكاء الاصطناعي' },
  { key: 'can_access_settings', label: 'الإعدادات / Settings', icon: '⚙️', description: 'إعدادات النظام' },
];

export function PermissionsManagerList({ isAdmin }: PermissionsManagerListProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<HrEmployee | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user: currentUser } = useAuth();

  const fetchPermissions = async (employeeId: string) => {
    try {
      console.log('[PermissionsManagerList] Fetching permissions for employee_id:', employeeId);
      setLoading(true);
      
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error: fetchError } = await supabase
        .from('permissions')
        .select('*')
        .eq('employee_id', employeeId)
        .single();

      if (fetchError) {
        console.log('[PermissionsManagerList] Fetch error:', fetchError.code, fetchError.message);
        if (fetchError.code === 'PGRST116') {
          // Create default permissions if none exist
          console.log('[PermissionsManagerList] Creating default permissions...');
          const { data: newPermissions, error: insertError } = await supabase
            .from('permissions')
            .insert({
              employee_id: employeeId,
              can_access_inventory: true,
              can_access_hr: true,
              can_access_delivery: true,
              can_access_transport_logistics: true,
              can_access_wedding_invitations: true,
              can_access_legal: true,
              can_access_ai: true,
              can_access_settings: true,
              is_admin: false,
            })
            .select()
            .single();

          if (insertError) {
            console.error('[PermissionsManagerList] Insert error:', insertError);
            throw insertError;
          }
          console.log('[PermissionsManagerList] Default permissions created:', newPermissions);
          setPermissions(newPermissions);
        } else {
          throw fetchError;
        }
      } else {
        console.log('[PermissionsManagerList] Permissions fetched:', data);
        setPermissions(data);
      }
    } catch (err) {
      console.error('[PermissionsManagerList] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmployee = (employee: HrEmployee) => {
    console.log('[PermissionsManagerList] Selected employee:', employee);
    console.log('[PermissionsManagerList] Employee ID (hr_employees.id):', employee.id);
    console.log('[PermissionsManagerList] Employee employee_id:', employee.employee_id);
    setSelectedEmployee(employee);
    setIsModalOpen(false);
    fetchPermissions(employee.id);
  };

  const handleToggle = async (field: keyof UserPermissions) => {
    if (!permissions || !selectedEmployee || !supabase) return;

    const newValue = !permissions[field];
    setPermissions({ ...permissions, [field]: newValue });

    // Save immediately to Supabase
    try {
      setSaving(true);
      const { error: updateError } = await supabase
        .from('permissions')
        .update({ [field]: newValue })
        .eq('employee_id', selectedEmployee.id);

      if (updateError) throw updateError;
      console.log('[Permissions] Saved:', field, newValue);
    } catch (err) {
      console.error('[Permissions] Error saving:', err);
      // Revert on error
      setPermissions({ ...permissions, [field]: !newValue });
    } finally {
      setSaving(false);
    }
  };

  const filteredSections = SECTIONS.filter(section => {
    const searchLower = search.toLowerCase();
    return (
      section.label.toLowerCase().includes(searchLower) ||
      section.description.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!selectedEmployee) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Employee to Manage Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeListInline
              onSelectEmployee={handleSelectEmployee}
              excludeUserId={currentUser?.id}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Employee Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="size-5" />
              <span>Managing: {selectedEmployee.name} (ID: {selectedEmployee.employee_id})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedEmployee(null);
                setPermissions(null);
              }}
            >
              Change Employee
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Search for Sections */}
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 left-3 size-4 text-slate-500" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sections: المخزون، المالية، رادار الطلبات، النقل واللوجيستيك..."
          className="pl-10"
        />
      </div>

      {/* Sections Grid */}
      <div className="grid gap-4">
        {filteredSections.map((section) => (
          <Card key={section.key} className="hover:bg-slate-800/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-3xl">{section.icon}</span>
                  <div className="flex-1">
                    <Label className="text-base font-semibold text-slate-200">
                      {section.label}
                    </Label>
                    <p className="text-sm text-slate-400 mt-1">
                      {section.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {permissions?.[section.key] ? (
                    <Unlock className="size-5 text-emerald-400" />
                  ) : (
                    <Lock className="size-5 text-red-400" />
                  )}
                  <Switch
                    checked={permissions?.[section.key] || false}
                    onCheckedChange={() => handleToggle(section.key)}
                    disabled={!isAdmin || saving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSections.length === 0 && search && (
        <div className="text-center py-8 text-slate-400">
          No sections match "{search}"
        </div>
      )}

      {saving && (
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          <span>Saving changes...</span>
        </div>
      )}

      <EmployeeSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectEmployee={handleSelectEmployee}
        excludeUserId={currentUser?.id}
        userId={currentUser?.id}
      />
    </div>
  );
}
