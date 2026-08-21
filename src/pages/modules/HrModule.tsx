import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Download, FileSpreadsheet, FileText, Trash2, Users, Shield, Loader2 } from "lucide-react";
import { QuickOfficeBar } from "@/components/office/QuickOfficeBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OcrScanner, parseMoroccanIdHints } from "@/components/OcrScanner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { downloadXlsxWorkbook } from "@/lib/excelDownload";
import { buildPdfTableHtml, exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import * as XLSX from "xlsx";
import { useI18n } from "@/i18n/I18nProvider";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import HrEnterpriseSuite from "@/components/hr/HrEnterpriseSuite";
import { exportBrandedTableDocx, withFileToast } from "@/services/fileService";
import {
  createEmptyHrEmployeeDraft,
} from "@/features/hr/employee-helpers";
import type { HrEmployeeDraft } from "@/features/hr/types";
import { useHrEmployeesRealtime } from "@/hooks/useSupabaseRealtime";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type HrEmployee = {
  id: string;
  user_id: string;
  name: string;
  national_id: string | null;
  employee_id: string;
  work_number: string | null;
  role: string | null;
  salary: number;
  contract_type: string | null;
  contract_end: string | null;
  start_date: string | null;
  birth_date: string | null;
  marital_status: string | null;
  uniform_color: string | null;
  city: string | null;
  address: string | null;
  rib: string | null;
  bank_name: string | null;
  created_at: string;
  updated_at: string;
  // Advanced payroll fields
  hourly_rate: number | null;
  daily_hours: number | null;
  currency: string | null;
  overtime_125_hours: number | null;
  overtime_150_hours: number | null;
  overtime_200_hours: number | null;
  attendance_bonus: number | null;
  productivity_bonus: number | null;
  deductions: number | null;
  deductions_percentage: number | null;
  gross_salary: number | null;
  net_salary: number | null;
};

type MetricRow = {
  id: string;
  week_label: string;
  production: number;
  logistics: number;
  quality: number;
};

function HrModule() {
  const { t, locale, isRtl } = useI18n();
  const { token, isApproved, approvedModules, user, isAdmin } = useAuth();
  const allowed = isAdmin || (isApproved && approvedModules.includes("hr"));
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [empDrafts, setEmpDrafts] = useState<Record<string, HrEmployee>>({});
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [metricDrafts, setMetricDrafts] = useState<Record<string, MetricRow>>({});
  const [form, setForm] = useState<HrEmployeeDraft>(createEmptyHrEmployeeDraft());
  const [search, setSearch] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importDrafts, setImportDrafts] = useState<HrEmployeeDraft[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  
  // Absence tracking state
  const [absenceRecords, setAbsenceRecords] = useState<Array<{
    id: string;
    employeeId: string;
    fromDate: string;
    toDate: string;
    reason: string;
    returnDate?: string;
  }>>([]);
  const [absenceForm, setAbsenceForm] = useState<{
    employeeId: string;
    fromDate: string;
    toDate: string;
    reason: string;
    returnDate: string;
  }>({
    employeeId: "",
    fromDate: "",
    toDate: "",
    reason: "",
    returnDate: "",
  });
  const [absenceSearch, setAbsenceSearch] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const employeePayload = useCallback((row: HrEmployee) => ({
    name: row.name,
    national_id: row.national_id,
    employee_id: row.employee_id,
    work_number: row.work_number,
    role: row.role,
    salary: row.salary,
    contract_type: row.contract_type,
    contract_end: row.contract_end,
    start_date: row.start_date,
    birth_date: row.birth_date,
    marital_status: row.marital_status,
    uniform_color: row.uniform_color,
    city: row.city,
    address: row.address,
    rib: row.rib,
    bank_name: row.bank_name,
  }), []);

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      // Fetch employees - use Express API for Super Admin, Supabase for regular users
      let employeesData: HrEmployee[] = [];
      
      if (isAdmin && token) {
        // Super Admin: use Express API endpoint to bypass RLS
        try {
          const m = await api<HrEmployee[]>("/super-admin/hr-employees", { token });
          employeesData = Array.isArray(m) ? m : [];
        } catch (e) {
          console.error("[hr] Super Admin fetch error:", e);
        }
      } else if (isSupabaseConfigured && user?.id && supabase) {
        // Regular user: use Supabase with user_id filter
        const { data: supabaseEmployees, error: supabaseError } = await supabase
          .from('hr_employees')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (supabaseError) {
          console.error("[hr] Supabase fetch error:", supabaseError);
        } else if (supabaseEmployees) {
          employeesData = supabaseEmployees as HrEmployee[];
        }
      }
      
      // Fetch metrics from API
      let metricsData: MetricRow[] = [];
      if (token) {
        try {
          const m = await api<{ metrics: typeof metrics }>("/hr/metrics", { token });
          metricsData = Array.isArray(m.metrics) ? (m.metrics as MetricRow[]) : [];
        } catch (e) {
          console.error("[hr] Metrics fetch error:", e);
        }
      }
      
      startTransition(() => {
        setEmployees(employeesData);
        setMetrics(metricsData);
      });
      
    } catch (error) {
      console.error("[hr] load failed", error);
      startTransition(() => {
        setEmployees([]);
        setMetrics([]);
      });
    }
  }, [token, allowed, user?.id, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime subscription for hr_employees table
  useHrEmployeesRealtime(
    user?.id || "",
    useCallback((newEmployee: any) => {
      setEmployees((prev) => {
        const exists = prev.some((e) => e.id === newEmployee.id);
        if (exists) {
          return prev.map((e) => (e.id === newEmployee.id ? newEmployee : e));
        }
        return [newEmployee, ...prev];
      });
    }, []),
    useCallback((updatedEmployee: any) => {
      setEmployees((prev) => prev.map((e) => (e.id === updatedEmployee.id ? updatedEmployee : e)));
    }, []),
    useCallback((deletedEmployee: any) => {
      setEmployees((prev) => prev.filter((e) => e.id !== deletedEmployee.id));
    }, []),
    isSupabaseConfigured && allowed
  );

  useEffect(() => {
    const d: Record<string, HrEmployee> = {};
    for (const e of employees) d[e.id] = { ...e };
    setEmpDrafts(d);
  }, [employees]);

  useEffect(() => {
    const d: Record<string, MetricRow> = {};
    for (const m of metrics) d[m.id] = { ...m };
    setMetricDrafts(d);
  }, [metrics]);

  const loadAbsenceRecords = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id || !supabase) {
      setAbsenceRecords([]);
      return;
    }
    
    try {
      const { data: absenceData, error: supabaseError } = await supabase
        .from('hr_absence_records')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (!supabaseError && absenceData) {
        const formattedRecords = absenceData.map((record: any) => ({
          id: record.id,
          employeeId: record.employee_id,
          fromDate: record.from_date,
          toDate: record.to_date,
          reason: record.reason,
          returnDate: record.return_date,
        }));
        setAbsenceRecords(formattedRecords);
      } else {
        setAbsenceRecords([]);
      }
    } catch (error) {
      console.error('Failed to load absence records:', error);
      setAbsenceRecords([]);
    }
  }, [isSupabaseConfigured, user?.id, supabase]);

  useEffect(() => {
    loadAbsenceRecords();
  }, [loadAbsenceRecords]);

  const saveEmployeeRow = async (id: string) => {
    const row = empDrafts[id];
    if (!row) return;
    try {
      if (isAdmin && token) {
        // Super Admin: use Express API endpoint to bypass RLS
        await api(`/super-admin/hr-employees/${id}`, {
          method: "PUT",
          token,
          body: JSON.stringify(employeePayload(row)),
        });
      } else if (supabase) {
        // Regular user: use Supabase
        const { error: supabaseError } = await supabase
          .from('hr_employees')
          .update(employeePayload(row))
          .eq('id', id);
        
        if (supabaseError) {
          console.error("Failed to update employee in Supabase:", supabaseError);
          throw supabaseError;
        }
      } else {
        throw new Error("Supabase not configured");
      }
      
      await load();
    } catch (error) {
      console.error("Failed to save employee:", error);
      throw error;
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!supabase) return;
    const { error: supabaseError } = await supabase
      .from('hr_employees')
      .delete()
      .eq('id', id);
    
    if (supabaseError) {
      console.error("Failed to delete employee from Supabase:", supabaseError);
      return;
    }
    
    await load();
  };

  const saveMetricRow = async (id: string) => {
    if (!token) return;
    const row = metricDrafts[id];
    if (!row) return;
    await api(`/hr/metrics/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        week_label: row.week_label,
        production: row.production,
        logistics: row.logistics,
        quality: row.quality,
      }),
    });
    await load();
  };

  const filteredEmployees = useMemo(
    () => {
      if (!search) return employees;
      const lowerSearch = search.toLowerCase();
      return employees.filter((e) =>
        e.name?.toLowerCase().includes(lowerSearch) ||
        e.employee_id?.toLowerCase().includes(lowerSearch) ||
        e.role?.toLowerCase().includes(lowerSearch) ||
        e.city?.toLowerCase().includes(lowerSearch)
      );
    },
    [employees, search]
  );


  const expiring = useMemo(() => {
    const now = Date.now();
    const in30 = 30 * 864e5;
    return employees.filter((emp) => {
      if (!emp.contract_end) return false;
      const t = new Date(emp.contract_end).getTime();
      return t - now < in30 && t > now;
    });
  }, [employees]);

  const addEmployee = async () => {
    console.log("addEmployee called", { form, supabase: !!supabase });
    
    if (!form.name) {
      alert(locale.startsWith("ar") ? "يرجى ملء الاسم على الأقل" : "Please fill in at least the name");
      return;
    }
    
    try {
      console.log("DEBUG - user.id:", user.id);
      console.log("DEBUG - user.id type:", typeof user.id);
      
      // Build payload with only the fields that have real values
      const cleanedPayload: Record<string, any> = {
        name: form.name,
      };
      
      // Add user_id only if available (optional in database)
      if (user?.id) {
        cleanedPayload.user_id = user.id;
      }
      
      console.log("DEBUG - cleanedPayload:", cleanedPayload);
      
      // Only add employee_id if provided by user
      if (form.employee_id && form.employee_id.trim() !== "") {
        cleanedPayload.employee_id = form.employee_id;
      }
      
      // Only add other fields if they have real values
      if (form.national_id && form.national_id.trim() !== "") {
        cleanedPayload.national_id = form.national_id;
      }
      if (form.work_number && form.work_number.trim() !== "") {
        cleanedPayload.work_number = form.work_number;
      }
      if (form.role && form.role.trim() !== "") {
        cleanedPayload.role = form.role;
      }
      if (form.salary && form.salary > 0) {
        cleanedPayload.salary = form.salary;
      }
      if (form.contract_type && form.contract_type.trim() !== "") {
        cleanedPayload.contract_type = form.contract_type;
      }
      if (form.contract_end) {
        cleanedPayload.contract_end = form.contract_end;
      }
      if (form.start_date) {
        cleanedPayload.start_date = form.start_date;
      }
      if (form.birth_date) {
        cleanedPayload.birth_date = form.birth_date;
      }
      if (form.marital_status && form.marital_status.trim() !== "") {
        cleanedPayload.marital_status = form.marital_status;
      }
      if (form.uniform_color && form.uniform_color.trim() !== "") {
        cleanedPayload.uniform_color = form.uniform_color;
      }
      if (form.city && form.city.trim() !== "") {
        cleanedPayload.city = form.city;
      }
      if (form.address && form.address.trim() !== "") {
        cleanedPayload.address = form.address;
      }
      if (form.rib && form.rib.trim() !== "") {
        cleanedPayload.rib = form.rib;
      }
      if (form.bank_name && form.bank_name.trim() !== "") {
        cleanedPayload.bank_name = form.bank_name;
      }
      
      console.log("Inserting employee payload:", cleanedPayload);
      
      if (isAdmin && token) {
        // Super Admin: use Express API endpoint to bypass RLS
        await api("/super-admin/hr-employees", {
          method: "POST",
          token,
          body: JSON.stringify(cleanedPayload),
        });
      } else if (supabase) {
        // Regular user: use Supabase
        const { error: supabaseError } = await supabase
          .from('hr_employees')
          .insert([cleanedPayload]);
        
        if (supabaseError) {
          console.error("Failed to add employee to Supabase:", supabaseError);
          alert(locale.startsWith("ar") ? "فشل حفظ الموظف: " + supabaseError.message : "Failed to save employee: " + supabaseError.message);
          return;
        }
      } else {
        alert(locale.startsWith("ar") ? "Supabase not configured" : "Supabase not configured");
        return;
      }
      
      setForm(createEmptyHrEmployeeDraft());
      await load();
      alert(locale.startsWith("ar") ? "تم حفظ الموظف بنجاح" : "Employee saved successfully");
    } catch (error) {
      console.error("Failed to add employee:", error);
      alert(locale.startsWith("ar") ? "فشل حفظ الموظف" : "Failed to save employee");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportMessage(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = event.target?.result;
        if (!data) return;
        
        try {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames?.[0];
          if (!sheetName) throw new Error("No sheets found");
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          
          // Flexible name column mapping
          const getName = (row: any): string => {
            const nameKeys = [
              'Name', 'الاسم', 'الاسم الكامل', 'Full Name', 'Nom', 'Nom complet',
              'name', 'nom', 'full_name', 'full name', 'الاسم الكامل'
            ];
            for (const key of nameKeys) {
              if (row[key] && String(row[key]).trim()) {
                return String(row[key]).trim();
              }
            }
            return '';
          };
          
          const employees: HrEmployeeDraft[] = jsonData
            .map((row: any) => ({
              name: getName(row),
              national_id: row['National ID'] || row['رقم الهوية'] || row['CIN'] || row['رقم البطاقة الوطنية'] || null,
              employee_id: row['Employee ID'] || row['رقم الموظف'] || row['رقم التعريف'] || null,
              work_number: row['Work Number'] || row['رقم العمل'] || null,
              role: row['Role'] || row['المهمة'] || null,
              salary: Number(row['Salary'] || row['الراتب'] || 0) || 0,
              contract_type: row['Contract Type'] || row['نوع العقد'] || 'CDI',
              contract_end: row['Contract End'] || row['نهاية العقد'] || null,
              start_date: row['Start Date'] || row['تاريخ البدء'] || row['تاريخ التوظيف'] || null,
              birth_date: row['Birth Date'] || row['تاريخ الميلاد'] || row['تاريخ الازدياد'] || null,
              marital_status: row['Marital Status'] || row['الحالة الاجتماعية'] || row['الحالة العائلية'] || null,
              uniform_color: row['Uniform Color'] || row['لون الزي'] || row['لون البدلة'] || null,
              city: row['City'] || row['المدينة'] || null,
              address: row['Address'] || row['العنوان'] || null,
              rib: row['RIB'] || row['رقم الحساب'] || row['رقم الحساب البنكي'] || null,
              bank_name: row['Bank Name'] || row['اسم البنك'] || null,
            }))
            .filter((emp) => emp.name && emp.name.trim() !== ''); // Filter out rows without name
          
          setImportDrafts(employees);
          setImportMessage(locale.startsWith("ar") ? `تم استيراد ${employees.length} موظف` : `Imported ${employees.length} employees`);
        } catch (err) {
          console.error("Error parsing Excel:", err);
          setImportMessage(locale.startsWith("ar") ? "فشل قراءة الملف" : "Failed to read file");
        }
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error("Error importing file:", error);
      setImportMessage(locale.startsWith("ar") ? "فشل استيراد الملف" : "Failed to import file");
    } finally {
      setIsImporting(false);
    }
  };

  const saveImportedEmployees = async () => {
    if (!supabase || importDrafts.length === 0) return;
    
    try {
      setIsImporting(true);
      
      const payload = importDrafts.map((d) => {
        // Build payload with only the fields that have real values
        const cleanedPayload: Record<string, any> = {
          name: d.name,
        };
        
        // Add user_id only if available (optional in database)
        if (user?.id) {
          cleanedPayload.user_id = user.id;
        }
        
        // Only add employee_id if provided
        if (d.employee_id && d.employee_id.trim() !== "") {
          cleanedPayload.employee_id = d.employee_id;
        }
        
        // Only add other fields if they have real values
        if (d.national_id && d.national_id.trim() !== "") {
          cleanedPayload.national_id = d.national_id;
        }
        if (d.work_number && d.work_number.trim() !== "") {
          cleanedPayload.work_number = d.work_number;
        }
        if (d.role && d.role.trim() !== "") {
          cleanedPayload.role = d.role;
        }
        if (d.salary && d.salary > 0) {
          cleanedPayload.salary = d.salary;
        }
        if (d.contract_type && d.contract_type.trim() !== "") {
          cleanedPayload.contract_type = d.contract_type;
        }
        if (d.contract_end) {
          cleanedPayload.contract_end = d.contract_end;
        }
        if (d.start_date) {
          cleanedPayload.start_date = d.start_date;
        }
        if (d.birth_date) {
          cleanedPayload.birth_date = d.birth_date;
        }
        if (d.marital_status && d.marital_status.trim() !== "") {
          cleanedPayload.marital_status = d.marital_status;
        }
        if (d.uniform_color && d.uniform_color.trim() !== "") {
          cleanedPayload.uniform_color = d.uniform_color;
        }
        if (d.city && d.city.trim() !== "") {
          cleanedPayload.city = d.city;
        }
        if (d.address && d.address.trim() !== "") {
          cleanedPayload.address = d.address;
        }
        if (d.rib && d.rib.trim() !== "") {
          cleanedPayload.rib = d.rib;
        }
        if (d.bank_name && d.bank_name.trim() !== "") {
          cleanedPayload.bank_name = d.bank_name;
        }
        
        return cleanedPayload;
      });
      
      console.log("Bulk insert payload:", payload);
      
      const { error } = await supabase.from('hr_employees').insert(payload);
      if (error) throw error;
      
      setImportDrafts([]);
      setImportMessage(null);
      await load();
      alert(locale.startsWith("ar") ? "تم استيراد الموظفين بنجاح" : "Employees imported successfully");
    } catch (error) {
      console.error("Failed to save imported employees:", error);
      alert(locale.startsWith("ar") ? "فشل الاستيراد" : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const exportPdf = async () => {
    const dir = isRtl ? "rtl" : "ltr";
    const empHeaders = [
      t("tbl.name"),
      t("tbl.empId"),
      t("hr.labelWorkNumber"),
      t("tbl.role"),
      t("tbl.salary"),
      t("tbl.contract"),
      t("tbl.contractEnd"),
      t("hr.enterprise.hireDate"),
      t("hr.labelCity"),
      t("hr.labelAddress"),
      locale.startsWith("ar") ? "رقم الحساب (RIB)" : "RIB",
      locale.startsWith("ar") ? "اسم البنك" : "Bank",
    ];
    const empRows = employees.map((e) => [
      e.name,
      e.employee_id,
      e.work_number ?? "—",
      e.role ?? "—",
      String(e.salary),
      e.contract_type ?? "—",
      e.contract_end ?? "—",
      e.start_date ?? "—",
      e.city ?? "—",
      e.address ?? "—",
      e.rib ?? "—",
      e.bank_name ?? "—",
    ]);
    const empTable = buildPdfTableHtml(empHeaders, empRows, dir);
    const metricHeaders = [
      t("tbl.week"),
      t("tbl.production"),
      t("tbl.logistics"),
      t("tbl.quality"),
    ];
    const metricRows = metrics.map((m) => [
      m.week_label,
      String(Math.round(m.production * 10) / 10),
      String(Math.round(m.logistics * 10) / 10),
      String(Math.round(m.quality * 10) / 10),
    ]);
    const metricTable = buildPdfTableHtml(metricHeaders, metricRows, dir);
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;margin-bottom:10px;">${t("pdf.hrReport")}</h2>
      <p style="color:#94a3b8;font-size:13px;margin-bottom:14px;">${t("hr.title")}</p>
      ${empTable}
      <h3 style="color:#f97316;font-size:15px;margin:18px 0 10px;">${t("tbl.production")} · ${t("tbl.logistics")} · ${t("tbl.quality")}</h3>
      ${metricTable}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: innerHtml,
      sectionTitle: t("pdf.hrReport"),
      fileName: `HR-report-${Date.now()}`,
      direction: dir,
      lang: locale,
      mainTitle: t("brand"),
      dateLocale: locale,
      userId: user?.id,
    });
  };

  const addAbsenceRecord = async () => {
    if (!absenceForm.employeeId || !absenceForm.fromDate || !absenceForm.toDate || !absenceForm.reason) {
      alert(locale.startsWith("ar") ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    
    if (!supabase) {
      alert(locale.startsWith("ar") ? "Supabase غير متصل" : "Supabase not connected");
      return;
    }
    
    try {
      const { error: supabaseError } = await supabase
        .from('hr_absence_records')
        .insert([{
          employee_id: absenceForm.employeeId,
          from_date: absenceForm.fromDate,
          to_date: absenceForm.toDate,
          reason: absenceForm.reason,
          return_date: absenceForm.returnDate || null,
          user_id: user?.id,
        }]);
      
      if (supabaseError) {
        alert(locale.startsWith("ar") ? "فشل حفظ سجل الغياب: " + supabaseError.message : "Failed to save absence record: " + supabaseError.message);
        return;
      }
      
      setAbsenceForm({
        employeeId: "",
        fromDate: "",
        toDate: "",
        reason: "",
        returnDate: "",
      });
      
      await loadAbsenceRecords();
      alert(locale.startsWith("ar") ? "تم إضافة سجل الغياب بنجاح" : "Absence record added successfully");
    } catch (error) {
      alert(locale.startsWith("ar") ? "فشل حفظ سجل الغياب" : "Failed to save absence record");
    }
  };

  const deleteAbsenceRecord = async (recordId: string) => {
    if (!confirm(locale.startsWith("ar") ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure you want to delete this record?")) {
      return;
    }
    
    if (!supabase) {
      alert(locale.startsWith("ar") ? "Supabase غير متصل" : "Supabase not connected");
      return;
    }
    
    try {
      const { error: supabaseError } = await supabase
        .from('hr_absence_records')
        .delete()
        .eq('id', recordId);
      
      if (supabaseError) {
        alert(locale.startsWith("ar") ? "فشل حذف السجل: " + supabaseError.message : "Failed to delete record: " + supabaseError.message);
        return;
      }
      
      await loadAbsenceRecords();
      alert(locale.startsWith("ar") ? "تم حذف السجل بنجاح" : "Record deleted successfully");
    } catch (error) {
      alert(locale.startsWith("ar") ? "فشل حذف السجل" : "Failed to delete record");
    }
  };

  const generateReturnToWorkPdf = async (record: any) => {
    const employee = employees.find((e) => e.id === record.employeeId);
    if (!employee) return;
    
    const dir = isRtl ? "rtl" : "ltr";
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;margin-bottom:10px;">
        ${locale.startsWith("ar") ? "شهادة عودة للعمل" : "Return to Work Certificate"}
      </h2>
      <div style="color:#94a3b8;font-size:13px;margin-bottom:14px;">
        <p><strong>${locale.startsWith("ar") ? "الاسم:" : "Name:"}</strong> ${employee.name}</p>
        <p><strong>${locale.startsWith("ar") ? "رقم التعريف:" : "Employee ID:"}</strong> ${employee.employee_id || "N/A"}</p>
        <p><strong>${locale.startsWith("ar") ? "فترة الغياب:" : "Absence Period:"}</strong> ${record.fromDate} - ${record.toDate}</p>
        <p><strong>${locale.startsWith("ar") ? "السبب:" : "Reason:"}</strong> ${record.reason}</p>
        <p><strong>${locale.startsWith("ar") ? "تاريخ العودة:" : "Return Date:"}</strong> ${record.returnDate || "—"}</p>
      </div>
    `;
    
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: innerHtml,
      sectionTitle: locale.startsWith("ar") ? "شهادة عودة للعمل" : "Return to Work Certificate",
      fileName: `return-to-work-${employee.name}-${Date.now()}`,
      direction: dir,
      lang: locale,
      mainTitle: t("brand"),
      dateLocale: locale,
      userId: user?.id,
    });
  };

  const generateReturnToWorkDocx = async (record: any) => {
    const employee = employees.find((e) => e.id === record.employeeId);
    if (!employee) return;
    
    const headers = [
      locale.startsWith("ar") ? "الحقل" : "Field",
      locale.startsWith("ar") ? "القيمة" : "Value",
    ];
    
    const rows = [
      [locale.startsWith("ar") ? "الاسم" : "Name", employee.name],
      [locale.startsWith("ar") ? "رقم التعريف" : "Employee ID", employee.employee_id || "N/A"],
      [locale.startsWith("ar") ? "فترة الغياب" : "Absence Period", `${record.fromDate} - ${record.toDate}`],
      [locale.startsWith("ar") ? "السبب" : "Reason", record.reason],
      [locale.startsWith("ar") ? "تاريخ العودة" : "Return Date", record.returnDate || "—"],
    ];
    
    const table = buildPdfTableHtml(headers, rows, isRtl ? "rtl" : "ltr");
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;margin-bottom:10px;">
        ${locale.startsWith("ar") ? "شهادة عودة للعمل" : "Return to Work Certificate"}
      </h2>
      ${table}
    `;
    
    await exportBrandedTableDocx({
      innerHtml,
      sectionTitle: locale.startsWith("ar") ? "شهادة عودة للعمل" : "Return to Work Certificate",
      fileName: `return-to-work-${employee.name}-${Date.now()}`,
      direction: isRtl ? "rtl" : "ltr",
      lang: locale,
      mainTitle: t("brand"),
      userId: user?.id,
    });
  };

  const getAbsenceCountByEmployee = (nameOrId: string): { count: number; employeeName: string; employeeId: string } | null => {
    const searchTerm = nameOrId.toLowerCase().trim();
    const employee = employees.find(
      (e) => 
        e.name.toLowerCase().includes(searchTerm) || 
        (e.employee_id && e.employee_id.toLowerCase().includes(searchTerm))
    );
    
    if (!employee) return null;
    
    const count = absenceRecords.filter((r) => r.employeeId === employee.id).length;
    
    return {
      count,
      employeeName: employee.name,
      employeeId: employee.employee_id || "N/A",
    };
  };

  const handleAiQuery = async () => {
    if (!aiQuery.trim()) return;
    
    const result = getAbsenceCountByEmployee(aiQuery);
    
    let response = "";
    if (result) {
      if (result.count === 0) {
        response = locale.startsWith("ar") 
          ? `لا يوجد غياب للموظف ${result.employeeName} (${result.employeeId})`
          : `No absence records found for employee ${result.employeeName} (${result.employeeId})`;
      } else {
        response = locale.startsWith("ar")
          ? `الموظف ${result.employeeName} (${result.employeeId}) لديه ${result.count} ${result.count === 1 ? "غياب" : "غيابات"}`
          : `Employee ${result.employeeName} (${result.employeeId}) has ${result.count} absence${result.count === 1 ? "" : "s"}`;
      }
    } else {
      response = locale.startsWith("ar")
        ? `لم يتم العثور على موظف بالاسم أو الرقم "${aiQuery}"`
        : `No employee found with name or ID "${aiQuery}"`;
    }
    
    setAiResponse(response);
    
    // Text-to-speech (only if not muted)
    if (!isMuted && 'speechSynthesis' in window) {
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(response);
      utterance.lang = locale.startsWith("ar") ? 'ar-SA' : 'en-US';
      utterance.onend = () => setIsSpeaking(false);
      speechSynthesis.speak(utterance);
    }
  };

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(locale.startsWith("ar") ? "المتصفح لا يدعم التعرف على الصوت" : "Browser does not support voice recognition");
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = locale.startsWith("ar") ? 'ar-SA' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setAiQuery(transcript);
        handleAiQuery();
      }
    };
    
    recognition.onerror = () => setIsListening(false);
    
    recognition.start();
  };

  const exportComprehensiveReport = async () => {
    const dir = isRtl ? "rtl" : "ltr";
    const empHeaders = [
      t("tbl.name"),
      t("tbl.empId"),
      t("hr.labelWorkNumber"),
      t("tbl.role"),
      t("tbl.salary"),
      t("tbl.contract"),
      t("tbl.contractEnd"),
      t("hr.enterprise.hireDate"),
      t("hr.labelCity"),
      t("hr.labelAddress"),
      locale.startsWith("ar") ? "رقم الحساب (RIB)" : "RIB",
      locale.startsWith("ar") ? "اسم البنك" : "Bank",
    ];
    const empRows = employees.map((e) => [
      e.name,
      e.employee_id,
      e.work_number ?? "—",
      e.role ?? "—",
      String(e.salary),
      e.contract_type ?? "—",
      e.contract_end ?? "—",
      e.start_date ?? "—",
      e.city ?? "—",
      e.address ?? "—",
      e.rib ?? "—",
      e.bank_name ?? "—",
    ]);
    const empTable = buildPdfTableHtml(empHeaders, empRows, dir);
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;margin-bottom:10px;">${locale.startsWith("ar") ? "تقرير شامل للموارد البشرية" : "Comprehensive HR Report"}</h2>
      <p style="color:#94a3b8;font-size:13px;margin-bottom:14px;">${t("hr.title")}</p>
      ${empTable}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: innerHtml,
      sectionTitle: locale.startsWith("ar") ? "تقرير شامل" : "Comprehensive Report",
      fileName: `HR-comprehensive-${Date.now()}`,
      direction: dir,
      lang: locale,
      mainTitle: t("brand"),
      dateLocale: locale,
      userId: user?.id,
    });
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsEmp = XLSX.utils.json_to_sheet(
      employees.map((e) => ({
        [t("tbl.name")]: e.name,
        [t("tbl.empId")]: e.employee_id,
        [t("hr.labelWorkNumber")]: e.work_number ?? "",
        [t("tbl.role")]: e.role ?? "",
        [t("tbl.salary")]: e.salary,
        [t("tbl.contract")]: e.contract_type ?? "",
        [t("tbl.contractEnd")]: e.contract_end ?? "",
        [t("hr.enterprise.hireDate")]: e.start_date ?? "",
        [t("hr.labelCity")]: e.city ?? "",
        [t("hr.labelAddress")]: e.address ?? "",
        [locale.startsWith("ar") ? "رقم الحساب (RIB)" : "RIB"]: e.rib ?? "",
        [locale.startsWith("ar") ? "اسم البنك" : "Bank"]: e.bank_name ?? "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsEmp, "Employees");
    const wsMet = XLSX.utils.json_to_sheet(
      metrics.map((m) => ({
        [t("tbl.week")]: m.week_label,
        [t("tbl.production")]: m.production,
        [t("tbl.logistics")]: m.logistics,
        [t("tbl.quality")]: m.quality,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsMet, "Metrics");
    downloadXlsxWorkbook(wb, `hr-export-${Date.now()}.xlsx`);
  };

  const exportHrWord = async () => {
    if (!employees.length) return;
    await withFileToast(
      () =>
        exportBrandedTableDocx({
          title: t("hr.title"),
          rows: [
            [
              t("tbl.name"),
              t("tbl.empId"),
              t("hr.labelWorkNumber"),
              t("tbl.role"),
              t("tbl.salary"),
              t("tbl.contract"),
              t("tbl.contractEnd"),
              t("hr.enterprise.hireDate"),
              t("hr.labelCity"),
              t("hr.labelAddress"),
              locale.startsWith("ar") ? "رقم الحساب (RIB)" : "RIB",
              locale.startsWith("ar") ? "اسم البنك" : "Bank",
            ],
            ...employees.map((e) => [
              e.name,
              e.employee_id,
              e.work_number ?? "—",
              e.role ?? "—",
              String(e.salary),
              e.contract_type ?? "—",
              e.contract_end ?? "—",
              e.start_date ?? "—",
              e.city ?? "—",
              e.address ?? "—",
              e.rib ?? "—",
              e.bank_name ?? "—",
            ]),
          ],
          fileName: `hr-pro-${Date.now()}.docx`,
        }),
      t("auth.errGeneric")
    );
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("hr.lockedTitle")}</h2>
        <p className="text-slate-400">{t("hr.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("hr.payCta")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-500/30">
            <Users className="size-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("hr.title")}</h1>
            <p className="text-slate-400 text-sm">{t("hr.moduleSubtitle")}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <QuickOfficeBar
            onProfessionalExcel={exportExcel}
            onProfessionalWord={() => void exportHrWord()}
            disabledExcel={employees.length === 0 && metrics.length === 0}
            disabledWord={employees.length === 0}
            labels={{
              quickGrid: t("fileUi.quickGrid"),
              exportExcel: t("fileUi.proExcel"),
              exportWord: t("fileUi.proWord"),
            }}
          />
          <div className="flex flex-wrap gap-2 justify-end">
            <Button className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/20" variant="outline" data-nav-index="0" data-nav-group="hr-export" onClick={exportExcel}>
              <FileSpreadsheet className="size-4" />
              {t("pdf.exportCsv")}
            </Button>
            <Button className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.42)] hover:bg-cyan-300/25" variant="secondary" data-nav-index="1" data-nav-group="hr-export" onClick={() => void exportPdf()}>
              <Download className="size-4" />
              {t("pdf.export")}
            </Button>
            <Button className="border-purple-500/30 bg-purple-500/10 text-purple-100 shadow-[0_0_22px_rgba(168,85,247,0.35)] hover:bg-purple-500/20" variant="outline" data-nav-index="2" data-nav-group="hr-export" onClick={() => void exportComprehensiveReport()}>
              <FileText className="size-4" />
              {locale.startsWith("ar") ? "تقرير شامل" : "Comprehensive Report"}
            </Button>
          </div>
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="size-6 text-amber-400 shrink-0" />
          <div>
            <p className="font-bold text-amber-200">{t("hr.contractRenewalAlertsTitle")}</p>
            <ul className="text-sm text-slate-300 mt-2 list-disc list-inside">
              {expiring.map((e) => (
                <li key={e.id}>
                  {t("hr.contractEndsLine")
                    .replace("{name}", e.name)
                    .replace("{date}", e.contract_end ?? "—")}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Tabs defaultValue="team">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="team">{t("hr.tabTeam")}</TabsTrigger>
          <TabsTrigger value="absence">{locale.startsWith("ar") ? "الغياب والانضباط" : "Absence & Discipline"}</TabsTrigger>
          <TabsTrigger value="payroll">{locale.startsWith("ar") ? "أجور وتأمينات" : "Payroll & Insurance"}</TabsTrigger>
          <TabsTrigger value="ops">{t("hr.tabOps")}</TabsTrigger>
          <TabsTrigger value="enterprise">{t("hr.tabEnterprise")}</TabsTrigger>
          <TabsTrigger value="ocr">{t("hr.tabOcr")}</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-6">
          <Card className="border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.addEmployeeTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field
                label={t("auth.fullName")}
                value={form.name ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <Field
                label={t("hr.labelCin")}
                value={form.national_id ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, national_id: v }))}
              />
              <Field
                label={t("tbl.empId")}
                value={form.employee_id ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
              />
              <Field
                label={t("hr.labelWorkNumber")}
                value={form.work_number ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, work_number: v }))}
              />
              <Field
                label={t("tbl.role")}
                value={form.role ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, role: v }))}
              />
              <Field
                label={t("hr.labelSalaryMad")}
                type="number"
                value={String(form.salary || "")}
                onChange={(v) => setForm((f) => ({ ...f, salary: Number(v || 0) }))}
              />
              <div>
                <Label>{t("hr.labelContractType")}</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
                  value={form.contract_type ?? ""}
                  data-nav-index="3" data-nav-group="hr-add-employee"
                  onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value }))}
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                </select>
              </div>
              <Field
                label={t("hr.labelContractEndOptional")}
                type="date"
                value={form.contract_end ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, contract_end: v || null }))}
              />
              <Field
                label={t("hr.enterprise.hireDate")}
                type="date"
                value={form.start_date ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, start_date: v }))}
              />
              <Field
                label={t("hr.labelBirthDate")}
                type="date"
                value={form.birth_date ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, birth_date: v }))}
              />
              <Field
                label={t("hr.labelMaritalStatus")}
                value={form.marital_status ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, marital_status: v }))}
              />
              <Field
                label={t("hr.labelUniformColor")}
                value={form.uniform_color ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, uniform_color: v }))}
              />
              <Field
                label={t("hr.labelCity")}
                value={form.city ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, city: v }))}
              />
              <Field
                label={t("hr.labelAddress")}
                value={form.address ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, address: v }))}
              />
              <Field
                label={locale.startsWith("ar") ? "رقم الحساب البنكي (RIB)" : "RIB (Bank Account)"}
                value={form.rib ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, rib: v }))}
              />
              <Field
                label={locale.startsWith("ar") ? "اسم البنك" : "Bank Name"}
                value={form.bank_name ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, bank_name: v }))}
              />
              <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
                <Button
                  className="bg-emerald-400 text-emerald-950 shadow-[0_0_26px_rgba(52,211,153,0.65)] hover:bg-emerald-300"
                  data-nav-index="4" data-nav-group="hr-add-employee"
                  onClick={() => void addEmployee()}
                >
                  {t("hr.saveEmployee")}
                </Button>
                <div className="flex-1">
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      handleImportFile(e);
                      e.target.value = "";
                    }}
                    disabled={isImporting}
                    className="cursor-pointer"
                  />
                </div>
              </div>
              {importMessage && (
                <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className="text-sm text-slate-300">{importMessage}</span>
                  {importDrafts.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => void saveImportedEmployees()}
                      disabled={isImporting}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      {isImporting ? <Loader2 className="size-4 animate-spin" /> : locale.startsWith("ar") ? "حفظ الكل" : "Save All"}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0a1628]/90">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{locale.startsWith("ar") ? "قائمة الموظفين" : "Employee List"}</span>
                <Input
                  placeholder={locale.startsWith("ar") ? "بحث..." : "Search..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 h-8"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80">
                  <tr>
                    <th className="p-2 text-right min-w-[120px]">{t("tbl.name")}</th>
                    <th className="p-2 text-right min-w-[100px]">{t("hr.labelCin")}</th>
                    <th className="p-2 text-right min-w-[100px]">{t("tbl.empId")}</th>
                    <th className="p-2 text-right min-w-[100px]">{t("hr.labelWorkNumber")}</th>
                    <th className="p-2 text-right min-w-[120px]">{t("tbl.role")}</th>
                    <th className="p-2 text-right w-24">{t("tbl.salary")}</th>
                    <th className="p-2 text-right w-28">{t("tbl.contract")}</th>
                    <th className="p-2 text-right w-32">{t("tbl.contractEnd")}</th>
                    <th className="p-2 text-right w-32">{t("hr.enterprise.hireDate")}</th>
                    <th className="p-2 text-right w-32">{t("hr.labelBirthDate")}</th>
                    <th className="p-2 text-right w-28">{t("hr.labelMaritalStatus")}</th>
                    <th className="p-2 text-right w-28">{t("hr.labelUniformColor")}</th>
                    <th className="p-2 text-right min-w-[100px]">{t("hr.labelCity")}</th>
                    <th className="p-2 text-right min-w-[150px]">{t("hr.labelAddress")}</th>
                    <th className="p-2 text-right min-w-[150px]">{locale.startsWith("ar") ? "رقم الحساب (RIB)" : "RIB"}</th>
                    <th className="p-2 text-right min-w-[120px]">{locale.startsWith("ar") ? "اسم البنك" : "Bank"}</th>
                    <th className="p-2 w-24">{t("common.saveRow")}</th>
                    <th className="p-2 w-16">{locale.startsWith("ar") ? "حذف" : "Delete"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((e) => {
                    const d = empDrafts[e.id] ?? e;
                    return (
                      <tr key={e.id} className="border-t border-slate-800">
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.name ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, name: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.national_id ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, national_id: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.employee_id ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, employee_id: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.work_number ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, work_number: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.role ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, role: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.salary ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, salary: Number(ev.target.value) },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <select
                            className="h-9 w-full rounded-md border border-slate-700 bg-slate-900/50 px-2 text-sm"
                            value={d.contract_type ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, contract_type: ev.target.value },
                              }))
                            }
                          >
                            <option value="CDI">CDI</option>
                            <option value="CDD">CDD</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="date"
                            lang="en"
                            dir="ltr"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.contract_end || ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, contract_end: ev.target.value || null },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="date"
                            lang="en"
                            dir="ltr"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.start_date || ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, start_date: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="date"
                            lang="en"
                            dir="ltr"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.birth_date || ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, birth_date: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.marital_status ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, marital_status: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.uniform_color ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, uniform_color: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.city ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, city: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.address ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, address: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.rib ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, rib: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.bank_name ?? ""}
                            onChange={(ev) =>
                              setEmpDrafts((prev) => ({
                                ...prev,
                                [e.id]: { ...d, bank_name: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full bg-emerald-400 text-emerald-950 shadow-[0_0_18px_rgba(52,211,153,0.45)] hover:bg-emerald-300"
                            onClick={() => void saveEmployeeRow(e.id)}
                          >
                            {t("common.saveRow")}
                          </Button>
                        </td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            onClick={() => void deleteEmployee(e.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="absence">
          <div className="space-y-6">
            {/* AI Assistant */}
            <Card className="border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-800/30">
              <CardHeader>
                <CardTitle className="text-lg text-orange-400 flex items-center gap-2">
                  <span>🤖</span>
                  {locale.startsWith("ar") ? "المساعد الذكي للغياب" : "AI Absence Assistant"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    className="bg-slate-900/50 border-slate-700"
                    placeholder={locale.startsWith("ar") ? "اكتب اسم الموظف أو رقم العمل..." : "Enter employee name or ID..."}
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
                  />
                  <Button
                    onClick={startVoiceRecognition}
                    disabled={isListening}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {isListening ? (
                      <span className="animate-pulse">🎙️</span>
                    ) : (
                      <span>🎤</span>
                    )}
                  </Button>
                  <Button
                    onClick={() => setIsMuted(!isMuted)}
                    className="bg-slate-700 hover:bg-slate-600"
                  >
                    {isMuted ? "🔇" : "🔊"}
                  </Button>
                  <Button
                    onClick={handleAiQuery}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {locale.startsWith("ar") ? "بحث" : "Search"}
                  </Button>
                </div>
                {aiResponse && (
                  <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                    <p className="text-slate-200">{aiResponse}</p>
                    {isSpeaking && (
                      <span className="inline-block ml-2 animate-pulse">🔊</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Absence Tracking Section */}
            <Card className="border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-orange-400">
                  {locale.startsWith("ar") ? "تسجيل الغياب والأسباب / Absence log" : "Absence Tracking"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">
                      {locale.startsWith("ar") ? "اختيار من الفريق / Pick from team" : "Select Employee"}
                    </label>
                    <select
                      className="w-full h-10 bg-slate-900/50 border border-slate-700 rounded-md px-3 text-sm"
                      value={absenceForm.employeeId || ""}
                      onChange={(e) => setAbsenceForm({ ...absenceForm, employeeId: e.target.value })}
                    >
                      <option value="">{locale.startsWith("ar") ? "اختر موظف..." : "Select employee..."}</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} - {emp.employee_id || "N/A"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      {locale.startsWith("ar") ? "من / From" : "From"}
                    </label>
                    <Input
                      type="date"
                      className="bg-slate-900/50 border-slate-700"
                      value={absenceForm.fromDate || ""}
                      onChange={(e) => setAbsenceForm({ ...absenceForm, fromDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      {locale.startsWith("ar") ? "إلى / To" : "To"}
                    </label>
                    <Input
                      type="date"
                      className="bg-slate-900/50 border-slate-700"
                      value={absenceForm.toDate || ""}
                      onChange={(e) => setAbsenceForm({ ...absenceForm, toDate: e.target.value })}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">
                      {locale.startsWith("ar") ? "السبب / Reason" : "Reason"}
                    </label>
                    <Input
                      className="bg-slate-900/50 border-slate-700"
                      value={absenceForm.reason || ""}
                      onChange={(e) => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                      placeholder={locale.startsWith("ar") ? "سبب الغياب..." : "Reason for absence..."}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      {locale.startsWith("ar") ? "تاريخ العودة / Return date" : "Return Date"}
                    </label>
                    <Input
                      type="date"
                      className="bg-slate-900/50 border-slate-700"
                      value={absenceForm.returnDate || ""}
                      onChange={(e) => setAbsenceForm({ ...absenceForm, returnDate: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={addAbsenceRecord}
                      className="w-full bg-orange-500 hover:bg-orange-600"
                    >
                      {locale.startsWith("ar") ? "إضافة للسجل / Add to log" : "Add to Log"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Absence Archive */}
            <Card className="border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-orange-400">
                  {locale.startsWith("ar") ? "أرشيف الغياب / Absence Archive" : "Absence Archive"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Input
                    className="bg-slate-900/50 border-slate-700"
                    placeholder={locale.startsWith("ar") ? "بحث بالاسم أو رقم العمل..." : "Search by name or employee ID..."}
                    value={absenceSearch}
                    onChange={(e) => setAbsenceSearch(e.target.value)}
                  />
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/80">
                      <tr>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "الاسم الكامل / Full name" : "Name"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "رقم التعريف / Employee ID" : "Employee ID"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "من / From" : "From"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "إلى / To" : "To"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "السبب / Reason" : "Reason"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "تاريخ العودة / Return date" : "Return Date"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "إجراءات / Actions" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absenceRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400">
                            {locale.startsWith("ar") ? "لا توجد سجلات غياب" : "No absence records"}
                          </td>
                        </tr>
                      ) : (
                        absenceRecords
                          .filter((record) => {
                            if (!absenceSearch.trim()) return true;
                            const employee = employees.find((e) => e.id === record.employeeId);
                            if (!employee) return false;
                            const searchTerm = absenceSearch.toLowerCase();
                            return (
                              employee.name.toLowerCase().includes(searchTerm) ||
                              (employee.employee_id && employee.employee_id.toLowerCase().includes(searchTerm))
                            );
                          })
                          .map((record) => {
                            const employee = employees.find((e) => e.id === record.employeeId);
                            return (
                              <tr key={record.id} className="border-t border-slate-800">
                                <td className="p-2">{employee?.name || "N/A"}</td>
                                <td className="p-2">{employee?.employee_id || "N/A"}</td>
                                <td className="p-2">{record.fromDate}</td>
                                <td className="p-2">{record.toDate}</td>
                                <td className="p-2">{record.reason}</td>
                                <td className="p-2">{record.returnDate || "—"}</td>
                                <td className="p-2 flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => generateReturnToWorkPdf(record)}
                                    className="text-xs"
                                  >
                                    PDF
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => generateReturnToWorkDocx(record)}
                                    className="text-xs"
                                  >
                                    Word
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteAbsenceRecord(record.id)}
                                    className="text-xs"
                                  >
                                    🗑️
                                  </Button>
                                </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Intelligence */}
            <Card className="border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-orange-400">
                  {locale.startsWith("ar") ? "ذكاء الحضور وتنبيهات التأخير" : "Attendance Intelligence"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/80">
                      <tr>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "الاسم / Name" : "Name"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "وقت بداية العمل" : "Start Time"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "وقت الدخول الفعلي" : "Actual Entry"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "الحالة / Status" : "Status"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "في الوقت / On Time" : "On Time"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.slice(0, 5).map((emp) => (
                        <tr key={emp.id} className="border-t border-slate-800">
                          <td className="p-2">{emp.name}</td>
                          <td className="p-2">08:00</td>
                          <td className="p-2">
                            {Math.random() > 0.3 ? "08:05" : "08:45"}
                          </td>
                          <td className="p-2">
                            {Math.random() > 0.3 ? (
                              <span className="text-emerald-400">{locale.startsWith("ar") ? "حاضر" : "Present"}</span>
                            ) : (
                              <span className="text-red-400">{locale.startsWith("ar") ? "متأخر" : "Late"}</span>
                            )}
                          </td>
                          <td className="p-2">
                            {Math.random() > 0.3 ? (
                              <span className="text-emerald-400">✓</span>
                            ) : (
                              <span className="text-red-400">✗</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-6">
          <Card className="border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">{locale.startsWith("ar") ? "أجور وتأمينات" : "Payroll & Insurance"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400">{locale.startsWith("ar") ? "قسم الأجور والتأمينات قيد التطوير" : "Payroll & Insurance section coming soon"}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ops">
          <div className="space-y-6 p-2 rounded-xl bg-[#0c1929]">
            <h3 className="text-lg font-bold text-center text-orange-400">
              {t("hr.opsChartTitle")}
            </h3>
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="week_label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: "#121214", border: "1px solid #334155" }}
                  />
                  <Legend />
                  <Bar dataKey="production" name={t("tbl.production")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="logistics" name={t("tbl.logistics")} fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="quality" name={t("tbl.quality")} fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800 mt-4">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80">
                  <tr>
                    <th className="p-2 text-right">{t("tbl.week")}</th>
                    <th className="p-2 text-right">{t("tbl.production")}</th>
                    <th className="p-2 text-right">{t("tbl.logistics")}</th>
                    <th className="p-2 text-right">{t("tbl.quality")}</th>
                    <th className="p-2 w-24">{t("common.saveRow")}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const d = metricDrafts[m.id] ?? m;
                    return (
                      <tr key={m.id} className="border-t border-slate-800">
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.week_label}
                            onChange={(ev) =>
                              setMetricDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...d, week_label: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.production}
                            onChange={(ev) =>
                              setMetricDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...d, production: Number(ev.target.value) },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.logistics}
                            onChange={(ev) =>
                              setMetricDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...d, logistics: Number(ev.target.value) },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.quality}
                            onChange={(ev) =>
                              setMetricDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...d, quality: Number(ev.target.value) },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full bg-emerald-400 text-emerald-950 shadow-[0_0_18px_rgba(52,211,153,0.45)] hover:bg-emerald-300"
                            onClick={() => void saveMetricRow(m.id)}
                          >
                            {t("common.saveRow")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="enterprise">
          <HrEnterpriseSuite employees={employees as any} />
        </TabsContent>

        <TabsContent value="ocr">
          <OcrScanner
            onExtracted={(text) => {
              const hints = parseMoroccanIdHints(text);
              if (hints.fullName) setForm((f) => ({ ...f, name: hints.fullName ?? f.name }));
              if (hints.cin) setForm((f) => ({ ...f, national_id: hints.cin ?? f.national_id }));
              window.alert(
                hints.raw.slice(0, 400) + (hints.raw.length > 400 ? "…" : "")
              );
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...(type === "date" || type === "time" || type === "datetime-local"
          ? { lang: "en", dir: "ltr" }
          : {})}
      />
    </div>
  );
}

export default HrModule;
