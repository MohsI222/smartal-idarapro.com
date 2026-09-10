import { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, Loader2, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import type { UserPermissions } from '@/context/PermissionsContext';

interface PermissionsManagerProps {
  userId: string;
  userName?: string;
  isAdmin?: boolean;
  onSave?: () => void;
}

export function PermissionsManager({ userId, userName, isAdmin = false, onSave }: PermissionsManagerProps) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error: fetchError } = await supabase
        .from('permissions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Create default permissions if none exist
          const { data: newPermissions, error: insertError } = await supabase
            .from('permissions')
            .insert({
              user_id: userId,
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

          if (insertError) throw insertError;
          setPermissions(newPermissions);
        } else {
          throw fetchError;
        }
      } else {
        setPermissions(data);
      }
    } catch (err) {
      console.error('[PermissionsManager] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [userId]);

  const handleSave = async () => {
    if (!permissions || !supabase) return;

    try {
      setSaving(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('permissions')
        .update({
          can_access_inventory: permissions.can_access_inventory,
          can_access_hr: permissions.can_access_hr,
          can_access_delivery: permissions.can_access_delivery,
          can_access_transport_logistics: permissions.can_access_transport_logistics,
          can_access_wedding_invitations: permissions.can_access_wedding_invitations,
          can_access_auto_real_estate: permissions.can_access_auto_real_estate,
          can_access_legal: permissions.can_access_legal,
          can_access_ai: permissions.can_access_ai,
          can_access_settings: permissions.can_access_settings,
          is_admin: permissions.is_admin,
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      onSave?.();
    } catch (err) {
      console.error('[PermissionsManager] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (field: keyof UserPermissions) => {
    if (!permissions) return;
    setPermissions({ ...permissions, [field]: !permissions[field] });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (!permissions) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-400">
          Failed to load permissions
        </CardContent>
      </Card>
    );
  }

  const permissionItems = [
    { key: 'can_access_inventory' as const, label: 'Inventory/POS', icon: '📦' },
    { key: 'can_access_hr' as const, label: 'HR Module', icon: '👥' },
    { key: 'can_access_delivery' as const, label: 'Delivery Hub', icon: '🚚' },
    { key: 'can_access_transport_logistics' as const, label: 'Transport Logistics', icon: '🚛' },
    { key: 'can_access_auto_real_estate' as const, label: 'Auto & Real Estate', icon: '🏠' },
    { key: 'can_access_wedding_invitations' as const, label: 'Wedding Invitations', icon: '🎉' },
    { key: 'can_access_legal' as const, label: 'Legal Module', icon: '⚖️' },
    { key: 'can_access_ai' as const, label: 'AI Features', icon: '🤖' },
    { key: 'can_access_settings' as const, label: 'Settings', icon: '⚙️' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Permissions Management
          {userName && <span className="text-sm font-normal text-slate-400">- {userName}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Admin Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3">
            <User className="size-5 text-amber-400" />
            <div>
              <Label className="text-base font-semibold">Admin Access</Label>
              <p className="text-xs text-slate-400">Can manage other users permissions</p>
            </div>
          </div>
          <Switch
            checked={permissions.is_admin}
            onCheckedChange={() => handleToggle('is_admin')}
            disabled={!isAdmin}
          />
        </div>

        {/* Permission Toggles */}
        <div className="space-y-3">
          {permissionItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <Label className="cursor-pointer">{item.label}</Label>
              </div>
              <div className="flex items-center gap-2">
                {permissions[item.key] ? (
                  <Unlock className="size-4 text-emerald-400" />
                ) : (
                  <Lock className="size-4 text-red-400" />
                )}
                <Switch
                  checked={permissions[item.key]}
                  onCheckedChange={() => handleToggle(item.key)}
                  disabled={!isAdmin}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        {isAdmin && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" />
                Save Permissions
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
