import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface HrEmployee {
  id: string;
  user_id: string;
  name: string;
  employee_id: string;
  work_number: string | null;
}

interface EmployeeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmployee: (employee: HrEmployee) => void;
  excludeUserId?: string;
}

export function EmployeeSelectorModal({ 
  isOpen, 
  onClose, 
  onSelectEmployee,
  excludeUserId 
}: EmployeeSelectorModalProps) {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchEmployees = async () => {
    try {
      console.log('[EmployeeSelectorModal] Fetching employees from hr_employees...');
      setLoading(true);
      
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data: employeesData, error: fetchError } = await supabase
        .from('hr_employees')
        .select('id, user_id, name, employee_id, work_number')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[EmployeeSelectorModal] Fetch error:', fetchError);
        throw fetchError;
      }

      console.log('[EmployeeSelectorModal] Fetched employees:', employeesData?.length || 0);
      const employeesList: HrEmployee[] = (employeesData || []).map((emp: any) => ({
        id: emp.id,
        user_id: emp.user_id,
        name: emp.name,
        employee_id: emp.employee_id || 'N/A',
        work_number: emp.work_number || 'N/A',
      }));

      setEmployees(employeesList);
      console.log('[EmployeeSelectorModal] Set employees state:', employeesList.length);
    } catch (err) {
      console.error('[EmployeeSelectorModal] Error:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen]);

  const filteredEmployees = employees.filter(emp => {
    if (excludeUserId && emp.user_id === excludeUserId) return false;
    
    // If search is empty, show all employees
    if (!search || search.trim() === '') return true;
    
    const searchLower = search.toLowerCase();
    const workNumStr = emp.work_number ? String(emp.work_number).toLowerCase() : '';
    const empIdStr = emp.employee_id ? String(emp.employee_id).toLowerCase() : '';
    
    return (
      emp.name.toLowerCase().includes(searchLower) ||
      empIdStr.includes(searchLower) ||
      workNumStr.includes(searchLower)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">Select Employee</DialogTitle>
          <DialogDescription>
            Choose an employee from your organization to manage their permissions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search and Refresh */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 left-3 size-4 text-slate-500" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, employee ID, or work number..."
                className="pl-10"
              />
            </div>
            <Button
              onClick={fetchEmployees}
              disabled={loading}
              variant="outline"
              size="icon"
              title="Refresh employees list"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Employees List */}
          <div className="overflow-y-auto max-h-[60vh] space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-slate-400" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                {search ? 'No employees match your search' : 'No employees found'}
              </div>
            ) : (
              filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp)}
                  className="w-full flex flex-col items-start gap-2 p-4 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors text-left"
                >
                  <p className="font-medium text-slate-200 text-lg">
                    {emp.name}
                  </p>
                  <p className="text-sm text-slate-400">
                    رقم التعريف / Employee ID: {emp.employee_id || 'N/A'} | رقم العمل / Work number: {emp.work_number || 'N/A'}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
