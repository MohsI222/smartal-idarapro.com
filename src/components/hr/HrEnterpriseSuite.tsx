import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Award,
  BookMarked,
  Check,
  ClipboardList,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  Percent,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Upload,
  User,
  X,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Banknote,
  Sparkles,
} from "lucide-react";
import { AiGenerateButton } from "@/components/AiGenerateButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/strings";
import { api } from "@/lib/api";
import { getPublicOrigin } from "@/lib/publicOrigin";
import {
  buildDismissalNoticeHtml,
  buildEmploymentContractHtml,
  buildInternalRulesAckHtml,
  buildPayrollSlipHtml,
  buildReturnToWorkHtml,
  buildWorkCertificateHtml,
  type HrBranding,
} from "@/lib/hrEnterpriseHtml";
import { buildPdfTableHtml, exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import { downloadHtmlAsWord } from "@/lib/wordExport";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { todayIsoLocal } from "@/lib/todayIso";
import { tlSendMessage, tlWorkers, type TlWorker } from "@/lib/tlApi";
import { buildEnterpriseEmployeePrefill } from "@/features/hr/employee-helpers";
import type { HrEmployeeRecord } from "@/features/hr/types";

const PUBLIC_SUPER_ADMIN_EMAIL = "lahcenm534@gmail.com";

type AbsenceRow = {
  id: string;
  employeeName: string;
  employeeId: string;
  from: string;
  to: string;
  reason: string;
};

type PayrollForm = {
  employeeName: string;
  employeeId: string;
  workNumber: string;
  nationalId: string;
  maritalStatus: string;
  workDays: string;
  hireDate: string;
  city: string;
  address: string;
  period: string;
  gross: string;
  cnss: string;
  amo: string;
  ipe: string;
  mutual: string;
  mutualId: string;
  paidLeave: string;
  overtime125: string;
  overtime150: string;
  overtime200: string;
  seniorityBonus: string;
  attendanceBonus: string;
  productivityBonus: string;
  advanceSalary: string;
  igreCnssDependents: string;
  dailyHours: string;
  hourlyRate: string;
  department: string;
  contractEndDate: string;
  rib?: string;
};

function minutesFromTime(value: string): number | null {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function analyzeAttendance(scheduledStart: string, actualCheckIn: string) {
  const scheduled = minutesFromTime(scheduledStart);
  const actual = minutesFromTime(actualCheckIn);
  if (scheduled === null || actual === null) return { minutesLate: 0, absent: !actualCheckIn, late: false };
  const minutesLate = Math.max(0, actual - scheduled);
  return { minutesLate, absent: minutesLate >= 240, late: minutesLate >= 10 };
}

function numericAmount(value: string): number {
  return Math.max(0, Number(String(value || "").replace(",", ".")) || 0);
}

function payrollFromForm(form: PayrollForm) {
  // حساب الأجر الأساسي تلقائياً من ثمن الساعة وعدد الساعات وعدد الأيام
  let baseSalary = numericAmount(form.gross);
  
  const hourlyRate = numericAmount(form.hourlyRate);
  const dailyHours = numericAmount(form.dailyHours);
  const workDays = numericAmount(form.workDays);
  
  // إذا تم توفير ثمن الساعة وعدد الساعات وعدد الأيام، احسب الأجر الأساسي تلقائياً
  if (hourlyRate > 0 && dailyHours > 0 && workDays > 0) {
    baseSalary = hourlyRate * dailyHours * workDays;
  }
  
  const paidLeave = numericAmount(form.paidLeave);
  const overtime125 = numericAmount(form.overtime125);
  const overtime150 = numericAmount(form.overtime150);
  const overtime200 = numericAmount(form.overtime200);
  const seniorityBonus = numericAmount(form.seniorityBonus);
  const attendanceBonus = numericAmount(form.attendanceBonus);
  const productivityBonus = numericAmount(form.productivityBonus);
  const totalBrut =
    baseSalary +
    paidLeave +
    overtime125 +
    overtime150 +
    overtime200 +
    seniorityBonus +
    attendanceBonus +
    productivityBonus;
  const cnss = form.cnss.trim() ? numericAmount(form.cnss) : Math.min(totalBrut, 6000) * 0.0448;
  const amo = form.amo.trim() ? numericAmount(form.amo) : totalBrut * 0.0226;
  const ipe = form.ipe.trim() ? numericAmount(form.ipe) : totalBrut * 0.0019;
  const mutual = numericAmount(form.mutual);
  const advanceSalary = numericAmount(form.advanceSalary);
  const totalCotisations = cnss + amo + ipe + mutual;
  const netSalary = Math.max(0, totalBrut - totalCotisations - advanceSalary);
  return {
    baseSalary,
    paidLeave,
    overtime125,
    overtime150,
    overtime200,
    seniorityBonus,
    attendanceBonus,
    productivityBonus,
    cnss,
    amo,
    ipe,
    mutual,
    advanceSalary,
    totalBrut,
    totalCotisations,
    netSalary,
  };
}

function pdfLang(locale: AppLocale): string {
  if (locale.startsWith("ar")) return "ar";
  if (locale === "fr") return "fr";
  return "en";
}

function HrEnterpriseSuite({ employees: propEmployees }: { employees: HrEmployeeRecord[] }) {
  const { t, locale, isRtl } = useI18n();
  const { token, user } = useAuth();
  const appLocale = locale as AppLocale;
  const dir = isRtl ? "rtl" : "ltr";
  
  // Admin-only check for Correspondence section
  const isSuperAdmin = user?.email?.toLowerCase() === PUBLIC_SUPER_ADMIN_EMAIL.toLowerCase();

  // Local state for employees with localStorage sync
  const [employees, setEmployees] = useState<HrEmployeeRecord[]>(propEmployees);

  // Sync with prop changes and localStorage
  useEffect(() => {
    setEmployees(propEmployees);
  }, [propEmployees]);

  useEffect(() => {
    if (employees && employees.length > 0) {
      // Sync with localStorage backup
      try {
        const backup = JSON.parse(localStorage.getItem("hrEmployeesBackup") || "{}");
        if (Object.keys(backup).length > 0) {
          const mergedEmployees = [...employees];
          for (const [id, data] of Object.entries(backup)) {
            const existingIndex = mergedEmployees.findIndex((emp) => emp.id === id || emp.employee_id === (data as any).employee_id);
            if (existingIndex >= 0) {
              mergedEmployees[existingIndex] = { ...mergedEmployees[existingIndex], ...(data as any) };
            }
          }
          setEmployees(mergedEmployees);
        }
      } catch (e) {
        console.error("Failed to sync with localStorage:", e);
      }
    }
  }, [employees?.length]); // Only re-run when length changes to avoid loops

  const [branding, setBranding] = useState<HrBranding>({ companyName: "" });
  const [loadingBrand, setLoadingBrand] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingStatus, setBrandingStatus] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [absForm, setAbsForm] = useState({
    employeeName: "",
    employeeId: "",
    from: todayIsoLocal(),
    to: todayIsoLocal(),
    reason: "",
  });
  const [returnDate, setReturnDate] = useState(() => todayIsoLocal());
  const [attendanceAi, setAttendanceAi] = useState({
    scheduledStart: "09:00",
    actualCheckIn: "09:00",
  });

  const [dismissForm, setDismissForm] = useState({
    employeeName: "",
    employeeId: "",
    dateNotice: todayIsoLocal(),
    grounds: "",
  });

  const [rulesText, setRulesText] = useState("");
  const rulesSeeded = useRef(false);
  useEffect(() => {
    if (rulesSeeded.current) return;
    rulesSeeded.current = true;
    setRulesText(t("hr.enterprise.rulesDefault"));
  }, [t]);
  const [rulesAck, setRulesAck] = useState({
    employeeName: "",
    employeeId: "",
    date: todayIsoLocal(),
  });

  const [contractCtx, setContractCtx] = useState({
    employerName: "",
    employeeName: "",
    nationalId: "",
    jobTitle: "",
    salaryGross: "",
    trialMonths: "3",
    contractType: "CDI",
    workPlace: "Maroc",
    hours: "44",
  });
  const [contractDraft, setContractDraft] = useState("");

  const [certWork, setCertWork] = useState({
    employeeName: "",
    employeeId: "",
    role: "",
    hireDate: todayIsoLocal(),
    endDate: "",
    maritalStatus: "",
    workDays: "",
  });

  const [certSalary, setCertSalary] = useState<PayrollForm>({
    employeeName: "",
    employeeId: "",
    workNumber: "",
    nationalId: "",
    maritalStatus: "",
    workDays: "",
    hireDate: "",
    city: "",
    address: "",
    period: "",
    gross: "",
    cnss: "",
    amo: "",
    ipe: "",
    mutual: "",
    mutualId: "",
    paidLeave: "0",
    overtime125: "0",
    overtime150: "0",
    overtime200: "0",
    seniorityBonus: "0",
    attendanceBonus: "0",
    productivityBonus: "0",
    advanceSalary: "0",
    igreCnssDependents: "",
    dailyHours: "8",
    hourlyRate: "",
    department: "",
    contractEndDate: "",
  });
  const salaryCalc = useMemo(() => payrollFromForm(certSalary), [certSalary]);
  const [bridgeWorkers, setBridgeWorkers] = useState<TlWorker[]>([]);
  const [bridgeInventoryCount, setBridgeInventoryCount] = useState(0);
  const [bridgeSenderId, setBridgeSenderId] = useState("");
  const [bridgeRecipientId, setBridgeRecipientId] = useState("");
  const [bridgeBody, setBridgeBody] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState("");
  const [isBridgeLoading, setIsBridgeLoading] = useState(false);
  const [isBridgeSending, setIsBridgeSending] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [showEmployeeSearch, setShowEmployeeSearch] = useState(false);
  const [importFileStatus, setImportFileStatus] = useState("");
  const salaryFileInputRef = useRef<HTMLInputElement>(null);
  const attendanceCalc = useMemo(
    () => analyzeAttendance(attendanceAi.scheduledStart, attendanceAi.actualCheckIn),
    [attendanceAi.actualCheckIn, attendanceAi.scheduledStart]
  );

  // AI Advisor State
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);

  // Comparison State
  const [comparisonEmployee, setComparisonEmployee] = useState("");
  const [comparisonPeriod1, setComparisonPeriod1] = useState("2026-04");
  const [comparisonPeriod2, setComparisonPeriod2] = useState("2026-05");

  // Bank Transfer State
  const [selectedForTransfer, setSelectedForTransfer] = useState<Set<string>>(new Set());
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>("all");
  const [bankTransferSearchQuery, setBankTransferSearchQuery] = useState<string>("");
  const [transferDrafts, setTransferDrafts] = useState<Record<string, any>>({});

  // Admin Profile State
  const [adminProfile, setAdminProfile] = useState(() => {
    const saved = localStorage.getItem("admin_profile");
    return saved ? JSON.parse(saved) : { name: "", title: "", department: "", phone: "", email: "" };
  });

  // Payroll Archive State
  const [payrollArchives, setPayrollArchives] = useState<Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    period: string;
    netSalary: number;
    date: string;
    data: any;
  }>>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [editingArchive, setEditingArchive] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedArchives, setSelectedArchives] = useState<Set<string>>(new Set());

  // Correspondence State
  const [correspondenceMessages, setCorrespondenceMessages] = useState<Array<{ id: string; sender_name: string; recipient_name: string; body: string; attachment_original_name?: string; created_at: string; external_user_name?: string; company_name?: string }>>([]);
  const [externalUsers, setExternalUsers] = useState<Array<{ id: string; full_name: string; company_name: string; magic_token: string }>>([]);

  // AI Advisor Handler
  const handleAiMessage = async () => {
    if (!aiInput.trim() || isAiLoading) return;

    const userMessage = aiInput.trim();
    setAiMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setAiInput("");
    setIsAiLoading(true);

    // Simulate AI response with Moroccan payroll knowledge
    setTimeout(() => {
      const responses = {
        ar: [
          "بناءً على القانون المغربي، منحة الأقدمية تُحتسب حسب المادة 350 من مدونة الشغل. النسب هي: 0% لأقل من سنتين، 5% من 2-5 سنوات، 10% من 5-12 سنة، 15% من 12-20 سنة، 20% من 20-25 سنة، و25% لـ 25 سنة فما فوق.",
          "اقتطاع CNSS يُحتسب بنسبة 4.48% من الأجر الإجمالي ولكن بحد أقصى 6000 درهم شهرياً. اقتطاع AMO يُحتسب بنسبة 2.26% على كامل الأجر بدون سقف.",
          "الضريبة على الدخل (IGR) تُحتسب على أساس شريحة تصاعدية حسب الدخل السنوي الصافي بعد الاقتطاعات الإلزامية.",
        ],
        fr: [
          "Selon la loi marocaine, la prime d'ancienneté est calculée selon l'article 350 du Code du travail. Les taux sont: 0% pour moins de 2 ans, 5% pour 2-5 ans, 10% pour 5-12 ans, 15% pour 12-20 ans, 20% pour 20-25 ans, et 25% pour 25 ans et plus.",
          "La cotisation CNSS est calculée à 4.48% du salaire brut mais avec un plafond maximum de 6000 MAD mensuels. La cotisation AMO est calculée à 2.26% sur l'intégralité du salaire sans plafond.",
          "L'IGR (Impôt sur le Revenu) est calculé selon un barème progressif basé sur le revenu annuel net après déductions obligatoires.",
        ],
        en: [
          "According to Moroccan law, seniority bonus is calculated per Article 350 of the Labor Code. Rates: 0% for <2 years, 5% for 2-5 years, 10% for 5-12 years, 15% for 12-20 years, 20% for 20-25 years, and 25% for 25+ years.",
          "CNSS contribution is calculated at 4.48% of gross salary with a maximum cap of 6000 MAD monthly. AMO contribution is calculated at 2.26% on full salary without cap.",
          "Income tax (IGR) is calculated on a progressive scale based on annual net income after mandatory deductions.",
        ],
        es: [
          "Según la ley marroquí, la prima de antigüedad se calcula según el artículo 350 del Código del Trabajo. Tasas: 0% para <2 años, 5% para 2-5 años, 10% para 5-12 años, 15% para 12-20 años, 20% para 20-25 años, y 25% para 25+ años.",
          "La cotización CNSS se calcula al 4.48% del salario bruto con un máximo de 6000 MAD mensuales. La cotización AMO se calcula al 2.26% sobre el salario completo sin tope.",
          "El impuesto sobre la renta (IGR) se calcula según una escala progresiva basada en el ingreso anual neto después de deducciones obligatorias.",
        ],
      };

      const lang = locale.startsWith("ar") ? "ar" : locale.startsWith("fr") ? "fr" : locale.startsWith("es") ? "es" : "en";
      const langResponses = responses[lang] || [];
      const response = langResponses[Math.floor(Math.random() * langResponses.length)];

      setAiMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setIsAiLoading(false);

      // Scroll to bottom
      setTimeout(() => {
        aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }, 1000);
  };

  // Voice Recording Handler
  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      // In a real implementation, stop recording and process audio
    } else {
      setIsRecording(true);
      // In a real implementation, start recording using Web Speech API
      setTimeout(() => {
        setIsRecording(false);
        setAiInput(locale.startsWith("ar") ? "كيف أحسب منحة الأقدمية؟" : "How do I calculate seniority bonus?");
      }, 2000);
    }
  };

  // Bank Transfer CSV Generation
  const generateBankTransferCsv = () => {
    const selectedEmployees = (filteredEmployeesForTransfer || []).filter((e) => selectedForTransfer.has(e.id));
    if (!selectedEmployees || selectedEmployees.length === 0) {
      alert(locale.startsWith("ar") ? "يرجى تحديد موظف واحد على الأقل" : "Please select at least one employee");
      return;
    }

    const csvContent = [
      ["RIB", "Nom", "Montant", "Banque", "Reference", "CIN", "Employee ID", "City"],
      ...(selectedEmployees || []).map((e) => {
        const draft = transferDrafts[e.id] || {};
        const sortedPayroll = (payrollArchives || [])
          .filter((p) => p.employeeId === e.employee_id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latestPayroll = sortedPayroll[0];
        const netSalary = draft.netSalary || latestPayroll?.netSalary || e.salary;
        return [
          draft.rib || e.rib || "RIB-" + e.employee_id,
          e.name,
          netSalary.toFixed(2),
          draft.bank_name || e.bank_name || "—",
          "SALAIRE-" + new Date().toISOString().slice(0, 7),
          draft.national_id || e.national_id || "—",
          e.employee_id,
          draft.city || e.city || "—",
        ];
      }),
    ]
      .map((row) => row.join(","))
      .join("\n");

    // Add BOM for UTF-8 encoding to ensure proper display in Excel
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `virement-bancaire-${Date.now()}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    
    // Cleanup with delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);
  };

  // Bank Transfer Excel Generation
  const generateBankTransferExcel = () => {
    const selectedEmployees = (filteredEmployeesForTransfer || []).filter((e) => selectedForTransfer.has(e.id));
    if (!selectedEmployees || selectedEmployees.length === 0) {
      alert(locale.startsWith("ar") ? "يرجى تحديد موظف واحد على الأقل" : "Please select at least one employee");
      return;
    }

    const wb = XLSX.utils.book_new();
    const data = (selectedEmployees || []).map((e) => {
      const draft = transferDrafts[e.id] || {};
      const sortedPayroll = payrollArchives
        .filter((p) => p.employeeId === e.employee_id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestPayroll = sortedPayroll[0];
      const netSalary = draft.netSalary || latestPayroll?.netSalary || e.salary;
      return {
        [locale.startsWith("ar") ? "رقم الحساب (RIB)" : "RIB"]: draft.rib || e.rib || "RIB-" + e.employee_id,
        [locale.startsWith("ar") ? "الاسم" : "Name"]: e.name,
        [locale.startsWith("ar") ? "المبلغ (درهم)" : "Amount (MAD)"]: netSalary.toFixed(2),
        [locale.startsWith("ar") ? "البنك" : "Bank"]: draft.bank_name || e.bank_name || "—",
        [locale.startsWith("ar") ? "المرجع" : "Reference"]: "SALAIRE-" + new Date().toISOString().slice(0, 7),
        [locale.startsWith("ar") ? "رقم البطاقة" : "CIN"]: draft.national_id || e.national_id || "—",
        [locale.startsWith("ar") ? "رقم الموظف" : "Employee ID"]: e.employee_id,
        [locale.startsWith("ar") ? "المدينة" : "City"]: draft.city || e.city || "—",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Bank Transfer");
    XLSX.writeFile(wb, `virement-bancaire-${Date.now()}.xlsx`);
  };

  // Bank Transfer PDF Generation
  const generateBankTransferPdf = async () => {
    const selectedEmployees = (filteredEmployeesForTransfer || []).filter((e) => selectedForTransfer.has(e.id));
    if (!selectedEmployees || selectedEmployees.length === 0) {
      alert(locale.startsWith("ar") ? "يرجى تحديد موظف واحد على الأقل" : "Please select at least one employee");
      return;
    }

    const dir = locale.startsWith("ar") ? "rtl" : "ltr";
    const headers = [
      locale.startsWith("ar") ? "رقم الحساب (RIB)" : "RIB",
      locale.startsWith("ar") ? "الاسم" : "Name",
      locale.startsWith("ar") ? "المبلغ (درهم)" : "Amount (MAD)",
      locale.startsWith("ar") ? "البنك" : "Bank",
      locale.startsWith("ar") ? "المرجع" : "Reference",
      locale.startsWith("ar") ? "رقم البطاقة" : "CIN",
      locale.startsWith("ar") ? "رقم الموظف" : "Employee ID",
      locale.startsWith("ar") ? "المدينة" : "City",
    ];
    const rows = (selectedEmployees || []).map((e) => {
      const draft = transferDrafts[e.id] || {};
      const sortedPayroll = payrollArchives
        .filter((p) => p.employeeId === e.employee_id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestPayroll = sortedPayroll[0];
      const netSalary = draft.netSalary || latestPayroll?.netSalary || e.salary;
      return [
        draft.rib || e.rib || "RIB-" + e.employee_id,
        e.name,
        netSalary.toFixed(2),
        draft.bank_name || e.bank_name || "—",
        "SALAIRE-" + new Date().toISOString().slice(0, 7),
        draft.national_id || e.national_id || "—",
        e.employee_id,
        draft.city || e.city || "—",
      ];
    });
    const table = buildPdfTableHtml(headers, rows, dir);
    const innerHtml = `
      <h2 style="color:#22c55e;font-size:17px;margin-bottom:10px;">
        ${locale.startsWith("ar") ? "أمر تحويل بنكي جماعي" : "Bank Transfer Batch Order"}
      </h2>
      <p style="color:#94a3b8;font-size:13px;margin-bottom:14px;">
        ${locale.startsWith("ar") ? "التاريخ: " : "Date: "}${new Date().toLocaleDateString()}
      </p>
      ${table}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: innerHtml,
      sectionTitle: locale.startsWith("ar") ? "أمر تحويل بنكي" : "Bank Transfer",
      fileName: `bank-transfer-${Date.now()}`,
      direction: dir,
      lang: appLocale,
    });
  };

  // Save Payroll to Archive
  const savePayrollToArchive = () => {
    if (!certSalary.employeeName || !certSalary.period) {
      alert(locale.startsWith("ar") ? "يرجى ملء اسم الموظف والفترة" : "Please fill in employee name and period");
      return;
    }

    const archive = {
      id: Date.now().toString(),
      employeeId: certSalary.employeeId,
      employeeName: certSalary.employeeName,
      period: certSalary.period,
      netSalary: salaryCalc.netSalary,
      date: new Date().toISOString(),
      data: { ...certSalary, ...salaryCalc },
    };

    setPayrollArchives((prev) => [...prev, archive]);

    // Save to localStorage for persistence - isolated per user
    try {
      const userKey = user?.id ? `payrollArchives_${user.id}` : "payrollArchives";
      const existingArchives = JSON.parse(localStorage.getItem(userKey) || "[]");
      existingArchives.push(archive);
      localStorage.setItem(userKey, JSON.stringify(existingArchives));
      alert(locale.startsWith("ar") ? "تم حفظ شهادة الأجر في الأرشيف بنجاح" : "Payroll certificate saved to archive successfully");
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
      alert(locale.startsWith("ar") ? "فشل الحفظ في الأرشيف" : "Failed to save to archive");
    }
  };

  // Update archive after editing - useEffect to auto-calculate when editingArchive changes
  useEffect(() => {
    if (editingArchive && editingArchive.data) {
      const data = editingArchive.data;
      
      // Calculate base salary from hourly rate, daily hours, and work days
      let baseSalary = data.baseSalary || 0;
      const hourlyRate = data.hourlyRate || 0;
      const dailyHours = data.dailyHours || 0;
      const workDays = data.workDays || 0;
      
      if (hourlyRate > 0 && dailyHours > 0 && workDays > 0) {
        baseSalary = hourlyRate * dailyHours * workDays;
      }
      
      // Calculate overtime
      const overtime125 = (data.overtime125 || 0);
      const overtime150 = (data.overtime150 || 0);
      const overtime200 = (data.overtime200 || 0);
      
      // Calculate total gross
      const totalBrut = baseSalary + 
                       (data.paidLeave || 0) +
                       overtime125 +
                       overtime150 +
                       overtime200 +
                       (data.seniorityBonus || 0) + 
                       (data.attendanceBonus || 0) + 
                       (data.productivityBonus || 0);
      
      // Calculate deductions - same logic as payrollFromForm
      const cnss = String(data.cnss || "").trim() ? numericAmount(String(data.cnss)) : Math.min(totalBrut, 6000) * 0.0448;
      const amo = String(data.amo || "").trim() ? numericAmount(String(data.amo)) : totalBrut * 0.0226;
      const ipe = String(data.ipe || "").trim() ? numericAmount(String(data.ipe)) : totalBrut * 0.0019;
      const mutual = numericAmount(String(data.mutual || "0"));
      const advanceSalary = numericAmount(String(data.advanceSalary || "0"));
      const totalCotisations = cnss + amo + ipe + mutual;
      
      // Calculate net salary
      const netSalary = Math.max(0, totalBrut - totalCotisations - advanceSalary);
      
      // Update editing archive with calculated values
      setEditingArchive({
        ...editingArchive,
        data: {
          ...editingArchive.data,
          baseSalary,
          totalBrut,
          cnss,
          amo,
          ipe,
          mutual,
          totalCotisations,
          netSalary,
        },
        netSalary,
      });
    }
  }, [
    editingArchive?.data?.hourlyRate,
    editingArchive?.data?.dailyHours,
    editingArchive?.data?.workDays,
    editingArchive?.data?.overtime125,
    editingArchive?.data?.overtime150,
    editingArchive?.data?.overtime200,
    editingArchive?.data?.seniorityBonus,
    editingArchive?.data?.attendanceBonus,
    editingArchive?.data?.productivityBonus,
    editingArchive?.data?.paidLeave,
    editingArchive?.data?.cnss,
    editingArchive?.data?.amo,
    editingArchive?.data?.ipe,
    editingArchive?.data?.mutual,
    editingArchive?.data?.advanceSalary,
  ]);

  // Export archives to CSV
  const exportArchivesToCsv = () => {
    if (!payrollArchives || payrollArchives.length === 0) {
      alert(locale.startsWith("ar") ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const headers = [
      locale.startsWith("ar") ? "الموظف" : "Employee",
      locale.startsWith("ar") ? "رقم الموظف" : "Employee ID",
      locale.startsWith("ar") ? "الفترة" : "Period",
      locale.startsWith("ar") ? "صافي الراتب" : "Net Salary",
      locale.startsWith("ar") ? "التاريخ" : "Date",
    ];
    
    const rows = (payrollArchives || []).map((archive) => [
      archive.employeeName,
      archive.employeeId,
      archive.period,
      archive.netSalary.toFixed(2),
      new Date(archive.date).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payroll-archives-${Date.now()}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);
  };

  // Export archives to Excel
  const exportArchivesToExcel = () => {
    if (!payrollArchives || payrollArchives.length === 0) {
      alert(locale.startsWith("ar") ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const wb = XLSX.utils.book_new();
    const data = (payrollArchives || []).map((archive) => ({
      [locale.startsWith("ar") ? "الموظف" : "Employee"]: archive.employeeName,
      [locale.startsWith("ar") ? "رقم الموظف" : "Employee ID"]: archive.employeeId,
      [locale.startsWith("ar") ? "الفترة" : "Period"]: archive.period,
      [locale.startsWith("ar") ? "صافي الراتب" : "Net Salary"]: archive.netSalary.toFixed(2),
      [locale.startsWith("ar") ? "التاريخ" : "Date"]: new Date(archive.date).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, locale.startsWith("ar") ? "أرشيف الأجور" : "Payroll Archive");
    XLSX.writeFile(wb, `payroll-archives-${Date.now()}.xlsx`);
  };

  // Export archives to PDF
  const exportArchivesToPdf = async () => {
    if (!payrollArchives || payrollArchives.length === 0) {
      alert(locale.startsWith("ar") ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const headers = [
      locale.startsWith("ar") ? "الموظف" : "Employee",
      locale.startsWith("ar") ? "رقم الموظف" : "Employee ID",
      locale.startsWith("ar") ? "الفترة" : "Period",
      locale.startsWith("ar") ? "صافي الراتب" : "Net Salary",
      locale.startsWith("ar") ? "التاريخ" : "Date",
    ];
    
    const rows = (payrollArchives || []).map((archive) => [
      archive.employeeName,
      archive.employeeId,
      archive.period,
      archive.netSalary.toFixed(2),
      new Date(archive.date).toLocaleDateString(),
    ]);

    const table = buildPdfTableHtml(headers, rows, dir);
    const innerHtml = `
      <h2 style="color:#a855f7;font-size:17px;margin-bottom:10px;">
        ${locale.startsWith("ar") ? "أرشيف شهادات الأجر" : "Payroll Archive"}
      </h2>
      <p style="color:#94a3b8;font-size:13px;margin-bottom:14px;">
        ${locale.startsWith("ar") ? "التاريخ: " : "Date: "}${new Date().toLocaleDateString()}
      </p>
      ${table}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: innerHtml,
      sectionTitle: locale.startsWith("ar") ? "أرشيف الأجور" : "Payroll Archive",
      fileName: `payroll-archives-${Date.now()}`,
      direction: dir,
      lang: appLocale,
    });
  };

  // Import archives from file
  const importArchivesFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    try {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.csv')) {
        // Parse CSV file with better handling
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (!lines || lines.length < 2) {
          alert(locale.startsWith("ar") ? "الملف فارغ أو غير صالح" : "File is empty or invalid");
          return;
        }

        // Parse CSV with proper quote handling
        const parseCSVLine = (line: string) => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        // Skip header row, parse data rows
        const importedArchives = (lines || []).slice(1).map((line, index) => {
          const columns = parseCSVLine(line);
          
          // Expected CSV format: Employee, Employee ID, Period, Net Salary, Date
          return {
            id: `imported-${Date.now()}-${index}`,
            employeeName: columns?.[0] || "Unknown",
            employeeId: columns?.[1] || "",
            period: columns?.[2] || "",
            netSalary: parseFloat(columns?.[3]) || 0,
            date: columns?.[4] ? new Date(columns[4]).toISOString() : new Date().toISOString(),
            data: {
              employeeName: columns?.[0] || "Unknown",
              employeeId: columns?.[1] || "",
              period: columns?.[2] || "",
              baseSalary: parseFloat(columns?.[3]) || 0,
              totalBrut: parseFloat(columns?.[3]) || 0,
              totalCotisations: 0,
              netSalary: parseFloat(columns?.[3]) || 0,
            },
          };
        });

        setPayrollArchives((prev) => [...prev, ...importedArchives]);
        
        // Update localStorage - isolated per user
        try {
          const userKey = user?.id ? `payrollArchives_${user.id}` : "payrollArchives";
          const existingArchives = JSON.parse(localStorage.getItem(userKey) || "[]");
          const updatedArchives = [...existingArchives, ...importedArchives];
          localStorage.setItem(userKey, JSON.stringify(updatedArchives));
        } catch (e) {
          console.error("Failed to update localStorage:", e);
        }

        alert(locale.startsWith("ar") 
          ? `تم استيراد ${importedArchives.length} سجل بنجاح` 
          : `Successfully imported ${importedArchives.length} records`);
      
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel file using XLSX
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) throw new Error("No sheets found");
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (!jsonData || jsonData.length < 2) {
          alert(locale.startsWith("ar") ? "الملف فارغ أو غير صالح" : "File is empty or invalid");
          return;
        }

        // Skip header row, parse data rows
        const importedArchives = (jsonData || []).slice(1).map((row: any[], index) => {
          return {
            id: `imported-${Date.now()}-${index}`,
            employeeName: String(row?.[0] || "Unknown"),
            employeeId: String(row?.[1] || ""),
            period: String(row?.[2] || ""),
            netSalary: parseFloat(row?.[3]) || 0,
            date: row?.[4] ? new Date(row[4]).toISOString() : new Date().toISOString(),
            data: {
              employeeName: String(row?.[0] || "Unknown"),
              employeeId: String(row?.[1] || ""),
              period: String(row?.[2] || ""),
              baseSalary: parseFloat(row?.[3]) || 0,
              totalBrut: parseFloat(row?.[3]) || 0,
              totalCotisations: 0,
              netSalary: parseFloat(row?.[3]) || 0,
            },
          };
        });

        setPayrollArchives((prev) => [...prev, ...importedArchives]);
        
        // Update localStorage - isolated per user
        try {
          const userKey = user?.id ? `payrollArchives_${user.id}` : "payrollArchives";
          const existingArchives = JSON.parse(localStorage.getItem(userKey) || "[]");
          const updatedArchives = [...existingArchives, ...importedArchives];
          localStorage.setItem(userKey, JSON.stringify(updatedArchives));
        } catch (e) {
          console.error("Failed to update localStorage:", e);
        }

        alert(locale.startsWith("ar") 
          ? `تم استيراد ${importedArchives.length} سجل بنجاح` 
          : `Successfully imported ${importedArchives.length} records`);
      
      } else if (fileName.endsWith('.json')) {
        // Parse JSON file
        const text = await file.text();
        const importedData = JSON.parse(text);
        
        if (Array.isArray(importedData)) {
          const importedArchives = importedData.map((item: any, index) => ({
            ...item,
            id: item.id || `imported-${Date.now()}-${index}`,
            data: {
              ...item.data,
              employeeName: item.employeeName || item.data?.employeeName || "Unknown",
              employeeId: item.employeeId || item.data?.employeeId || "",
              period: item.period || item.data?.period || "",
            },
          }));

          setPayrollArchives((prev) => [...prev, ...importedArchives]);
          
          // Update localStorage - isolated per user
          try {
            const userKey = user?.id ? `payrollArchives_${user.id}` : "payrollArchives";
            const existingArchives = JSON.parse(localStorage.getItem(userKey) || "[]");
            const updatedArchives = [...existingArchives, ...importedArchives];
            localStorage.setItem(userKey, JSON.stringify(updatedArchives));
          } catch (e) {
            console.error("Failed to update localStorage:", e);
          }

          alert(locale.startsWith("ar") 
            ? `تم استيراد ${importedArchives.length} سجل بنجاح` 
            : `Successfully imported ${importedArchives.length} records`);
        }
      } else {
        alert(locale.startsWith("ar") ? "نوع الملف غير مدعوم. يرجى استخدام CSV, Excel, أو JSON" : "Unsupported file type. Please use CSV, Excel, or JSON");
      }
    } catch (error) {
      console.error("Import error:", error);
      alert(locale.startsWith("ar") ? "فشل استيراد الملف" : "Failed to import file");
    }
  };

  // Load archives from localStorage on mount - isolated per user
  useEffect(() => {
    try {
      const userKey = user?.id ? `payrollArchives_${user.id}` : "payrollArchives";
      const savedArchives = JSON.parse(localStorage.getItem(userKey) || "[]");
      setPayrollArchives(savedArchives);
    } catch (e) {
      console.error("Failed to load from localStorage:", e);
    }
  }, [user?.id]);

  // Update archive after editing - isolated per user
  const updateArchive = (updatedData: any) => {
    const updatedArchives = (payrollArchives || []).map((archive) =>
      archive.id === updatedData.id
        ? { 
            ...archive, 
            ...updatedData,
            data: { ...archive.data, ...updatedData.data }
          }
        : archive
    );
    setPayrollArchives(updatedArchives);
    
    // Update localStorage - isolated per user
    try {
      const userKey = user?.id ? `payrollArchives_${user.id}` : "payrollArchives";
      localStorage.setItem(userKey, JSON.stringify(updatedArchives));
      alert(locale.startsWith("ar") ? "تم تحديث الأرشيف بنجاح" : "Archive updated successfully");
    } catch (e) {
      console.error("Failed to update localStorage:", e);
    }
  };

  // Bulk delete selected archives
  const bulkDeleteArchives = () => {
    if (selectedArchives.size === 0) {
      alert(locale.startsWith("ar") ? "يرجى تحديد سجلات للحذف" : "Please select records to delete");
      return;
    }

    const updatedArchives = payrollArchives.filter((archive) => !selectedArchives.has(archive.id));
    setPayrollArchives(updatedArchives);
    setSelectedArchives(new Set());

    // Update localStorage - isolated per user
    try {
      const userKey = user?.id ? `payrollArchives_${user.id}` : "payrollArchives";
      localStorage.setItem(userKey, JSON.stringify(updatedArchives));
      alert(locale.startsWith("ar") ? `تم حذف ${payrollArchives.length - updatedArchives.length} سجل بنجاح` : `Successfully deleted ${payrollArchives.length - updatedArchives.length} records`);
    } catch (e) {
      console.error("Failed to update localStorage:", e);
    }
  };

  // Bulk export selected archives to Excel
  const bulkExportArchives = () => {
    if (selectedArchives.size === 0) {
      alert(locale.startsWith("ar") ? "يرجى تحديد سجلات للتصدير" : "Please select records to export");
      return;
    }

    const selectedData = payrollArchives.filter((archive) => selectedArchives.has(archive.id));
    
    const wb = XLSX.utils.book_new();
    const wsData = [
      [
        locale.startsWith("ar") ? "الموظف" : "Employee",
        locale.startsWith("ar") ? "رقم الموظف" : "Employee ID",
        locale.startsWith("ar") ? "الفترة" : "Period",
        locale.startsWith("ar") ? "صافي الراتب" : "Net Salary",
        locale.startsWith("ar") ? "التاريخ" : "Date",
      ],
      ...(selectedData || []).map((archive) => [
        archive.employeeName,
        archive.employeeId,
        archive.period,
        archive.netSalary,
        new Date(archive.date).toLocaleDateString(),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, locale.startsWith("ar") ? "الأرشيف" : "Archive");
    XLSX.writeFile(wb, `bulk-payroll-export-${Date.now()}.xlsx`);
  };

  // Toggle selection for a single archive
  const toggleArchiveSelection = (id: string) => {
    setSelectedArchives((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (!payrollArchives || selectedArchives.size === payrollArchives.length) {
      setSelectedArchives(new Set());
    } else {
      setSelectedArchives(new Set((payrollArchives || []).map((archive) => archive.id)));
    }
  };

  // Get unique banks from employees
  const uniqueBanks = useMemo(() => {
    const predefinedBanks = [
      locale.startsWith("ar") ? "البنك الشعبي" : "Banque Populaire",
      locale.startsWith("ar") ? "التجاري وافا بنك" : "Attijariwafa Bank",
      locale.startsWith("ar") ? "الشركة العامة" : "Société Générale",
      locale.startsWith("ar") ? "البريد بنك" : "Banque Postale",
      "CH BANK",
      "BMCE",
      "BMCI",
    ];
    const employeeBanks = new Set((employees || []).map((e) => e.bank_name).filter(Boolean));
    return [...predefinedBanks, ...Array.from(employeeBanks)].filter((bank, index, self) => self.indexOf(bank) === index).sort();
  }, [employees, locale]);

  // Filter employees by selected bank
  const filteredEmployeesForTransfer = useMemo(() => {
    let result = employees || [];
    
    // Filter by bank (exact match or partial match for typing)
    if (selectedBankFilter && selectedBankFilter !== "all") {
      result = result.filter((e) => {
        const employeeBank = (e.bank_name || "").toLowerCase();
        const filterBank = selectedBankFilter.toLowerCase();
        return employeeBank === filterBank || employeeBank.includes(filterBank);
      });
    }
    
    // Filter by search query
    const query = bankTransferSearchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter((e) =>
        (e.name?.toLowerCase() || "").includes(query) ||
        (e.employee_id?.toLowerCase() || "").includes(query) ||
        (e.national_id?.toLowerCase() || "").includes(query)
      );
    }
    
    return result;
  }, [employees, selectedBankFilter, bankTransferSearchQuery]);

  // Filter employees for search (payroll form)
  const filteredEmployeesForSearch = useMemo(() => {
    const query = employeeSearchQuery.toLowerCase().trim();
    if (!query) return employees;
    return employees.filter((e) =>
      (e.name?.toLowerCase() || "").includes(query) ||
      (e.employee_id?.toLowerCase() || "").includes(query) ||
      (e.work_number?.toLowerCase() || "").includes(query)
    );
  }, [employees, employeeSearchQuery]);

  const handleSalaryFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setImportFileStatus(t("common.processing"));

    try {
      const { parseHrImportFile } = await import("@/features/hr/import-helpers");
      const parsed = await parseHrImportFile(file, token);
      if (parsed.drafts?.length > 0) {
        const draft = parsed.drafts[0];
        setCertSalary((f) => ({
          ...f,
          employeeName: draft.name || f.employeeName,
          employeeId: draft.employee_id || f.employeeId,
          workNumber: draft.work_number || f.workNumber,
          nationalId: draft.national_id || f.nationalId,
          maritalStatus: draft.marital_status || f.maritalStatus,
          workDays: String(draft.work_days || 0) || f.workDays,
          hireDate: draft.start_date || f.hireDate,
          city: draft.city || f.city,
          address: draft.address || f.address,
          gross: draft.salary ? String(draft.salary) : f.gross,
        }));
        setImportFileStatus(t("hr.importLoaded").replace("{count}", "1"));
      } else {
        setImportFileStatus(t("hr.importEmpty"));
      }
    } catch (error) {
      setImportFileStatus(error instanceof Error ? error.message : t("auth.errGeneric"));
    }
  };

  const exportSalaryExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      {
        [t("auth.fullName")]: certSalary.employeeName,
        [t("tbl.empId")]: certSalary.employeeId,
        [t("hr.labelWorkNumber")]: certSalary.workNumber,
        [t("hr.labelCin")]: certSalary.nationalId,
        [t("hr.labelMaritalStatus")]: certSalary.maritalStatus,
        [t("hr.labelWorkDays")]: certSalary.workDays,
        [t("hr.enterprise.hireDate")]: certSalary.hireDate,
        [t("hr.labelCity")]: certSalary.city,
        [t("hr.labelAddress")]: certSalary.address,
        [locale.startsWith("ar") ? "القسم / المصلحة" : "Département"]: certSalary.department,
        [locale.startsWith("ar") ? "رقم الحساب البنكي (RIB)" : "RIB (Banque)"]: certSalary.rib,
        [locale.startsWith("ar") ? "الأفراد تحت الكفالة (IGR/CNSS)" : "Personnes à charge (IGR/CNSS)"]: certSalary.igreCnssDependents,
        [locale.startsWith("ar") ? "ساعات العمل اليومية" : "Heures journalières"]: certSalary.dailyHours,
        [locale.startsWith("ar") ? "ثمن الساعة العادية" : "Taux horaire"]: certSalary.hourlyRate,
        [locale.startsWith("ar") ? "نهاية عقد العمل" : "Fin de contrat"]: certSalary.contractEndDate,
        [t("hr.enterprise.period")]: certSalary.period,
        [t("hr.labelSalaryMad")]: certSalary.gross,
        [t("hr.enterprise.paidLeave")]: certSalary.paidLeave,
        [t("hr.enterprise.overtime125")]: certSalary.overtime125,
        [t("hr.enterprise.overtime150")]: certSalary.overtime150,
        [t("hr.enterprise.overtime200")]: certSalary.overtime200,
        [t("hr.enterprise.seniorityBonus")]: certSalary.seniorityBonus,
        [t("hr.enterprise.attendanceBonus")]: certSalary.attendanceBonus,
        [t("hr.enterprise.productivityBonus")]: certSalary.productivityBonus,
        [t("hr.enterprise.cnss")]: certSalary.cnss,
        [t("hr.enterprise.amo")]: certSalary.amo,
        [t("hr.enterprise.ipe")]: certSalary.ipe,
        [t("hr.enterprise.mutual")]: certSalary.mutual,
        [t("hr.enterprise.mutualId")]: certSalary.mutualId,
        [t("hr.enterprise.advanceSalary")]: certSalary.advanceSalary,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Salary Certificate");
    XLSX.writeFile(wb, `salary-certificate-${Date.now()}.xlsx`);
  };

  const calculateSeniorityBonus = () => {
    if (!certSalary.hireDate || !certSalary.gross) return;
    
    const hireDate = new Date(certSalary.hireDate);
    const today = new Date();

    // Calculate tenure in years
    const totalMonths = (today.getFullYear() - hireDate.getFullYear()) * 12 + (today.getMonth() - hireDate.getMonth());
    const years = Math.floor(totalMonths / 12);

    // Apply seniority bonus percentage per Article 350 of Moroccan Labor Code
    let percentage = 0;
    if (years < 2) percentage = 0;
    else if (years >= 2 && years < 5) percentage = 5;
    else if (years >= 5 && years < 12) percentage = 10;
    else if (years >= 12 && years < 20) percentage = 15;
    else if (years >= 20 && years < 25) percentage = 20;
    else if (years >= 25) percentage = 25;
    
    const baseSalary = parseFloat(certSalary.gross) || 0;
    const bonusAmount = (baseSalary * percentage) / 100;
    
    setCertSalary((f) => ({
      ...f,
      seniorityBonus: bonusAmount.toFixed(2),
    }));
  };

  // Calculate tenure display
  const tenureDisplay = useMemo(() => {
    if (!certSalary.hireDate) return { years: 0, months: 0, display: "—" };
    const hireDate = new Date(certSalary.hireDate);
    const today = new Date();
    const totalMonths = (today.getFullYear() - hireDate.getFullYear()) * 12 + (today.getMonth() - hireDate.getMonth());
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const display = locale.startsWith("ar")
      ? `${years} سنة و ${months} أشهر`
      : `${years} years and ${months} months`;
    return { years, months, display };
  }, [certSalary.hireDate, locale]);

  // Calculate seniority percentage based on tenure
  const seniorityPercentage = useMemo(() => {
    const { years } = tenureDisplay;
    if (years < 2) return 0;
    else if (years >= 2 && years < 5) return 5;
    else if (years >= 5 && years < 12) return 10;
    else if (years >= 12 && years < 20) return 15;
    else if (years >= 20 && years < 25) return 20;
    else if (years >= 25) return 25;
    return 0;
  }, [tenureDisplay]);

  // Auto-calculate seniority bonus when hire date or gross salary changes
  useEffect(() => {
    if (certSalary.hireDate && certSalary.gross) {
      const baseSalary = parseFloat(certSalary.gross) || 0;
      if (baseSalary > 0 && seniorityPercentage > 0) {
        const bonusAmount = (baseSalary * seniorityPercentage) / 100;
        setCertSalary((f) => ({
          ...f,
          seniorityBonus: bonusAmount.toFixed(2),
        }));
      } else if (seniorityPercentage === 0) {
        setCertSalary((f) => ({
          ...f,
          seniorityBonus: "0",
        }));
      }
    }
  }, [certSalary.hireDate, certSalary.gross, seniorityPercentage]);

  // Auto-calculate gross salary from hourly rate, daily hours, and work days
  useEffect(() => {
    const hourlyRate = parseFloat(certSalary.hourlyRate) || 0;
    const dailyHours = parseFloat(certSalary.dailyHours) || 0;
    const workDays = parseFloat(certSalary.workDays) || 0;
    
    if (hourlyRate > 0 && dailyHours > 0 && workDays > 0) {
      const calculatedGross = hourlyRate * dailyHours * workDays;
      setCertSalary((f) => ({
        ...f,
        gross: calculatedGross.toFixed(2),
      }));
    }
  }, [certSalary.hourlyRate, certSalary.dailyHours, certSalary.workDays]);

  const loadBranding = useCallback(async () => {
    if (!token) return;
    setLoadingBrand(true);
    try {
      const r = await api<{ branding: { companyName?: string; logoDataUrl?: string } }>(
        "/user/branding",
        { token }
      );
      setBranding({
        companyName: r.branding?.companyName ?? "",
        logoDataUrl: r.branding?.logoDataUrl ?? undefined,
      });
    } catch {
      setBranding({ companyName: "" });
    } finally {
      setLoadingBrand(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  const saveBranding = async () => {
    if (!token) return;
    setSavingBranding(true);
    setBrandingStatus("");
    try {
      await api("/user/branding", {
        method: "PUT",
        token,
        body: JSON.stringify({
          companyName: branding.companyName,
          logoDataUrl: branding.logoDataUrl ?? "",
        }),
      });
      setBrandingStatus(t("hr.enterprise.brandingSaved"));
    } catch (error) {
      setBrandingStatus(error instanceof Error ? error.message : t("auth.errGeneric"));
    } finally {
      setSavingBranding(false);
    }
  };

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const logoDataUrl = String(reader.result || "");
      if (logoDataUrl.startsWith("data:image")) {
        setBranding((current) => ({ ...current, logoDataUrl }));
        setBrandingStatus(t("hr.enterprise.logoReady"));
      }
    };
    reader.readAsDataURL(file);
  };

  const loadBridgeData = useCallback(async () => {
    if (!token) return;
    setIsBridgeLoading(true);
    try {
      const [workersResult, inventoryResult] = await Promise.allSettled([
        tlWorkers(token),
        api<{ products?: unknown[] }>("/inventory/products", { token }),
      ]);
      const workers = workersResult.status === "fulfilled" ? workersResult.value : [];
      const products =
        inventoryResult.status === "fulfilled" && Array.isArray(inventoryResult.value.products)
          ? inventoryResult.value.products.length
          : 0;
      setBridgeWorkers(workers);
      setBridgeInventoryCount(products);
      setBridgeSenderId((prev) => prev || workers?.[0]?.id || "");
      setBridgeRecipientId((prev) => prev || workers?.find((worker: TlWorker) => worker.id !== workers?.[0]?.id)?.id || workers?.[1]?.id || "");
    } finally {
      setIsBridgeLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBridgeData();
  }, [loadBridgeData]);

  const loadCorrespondenceMessages = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api<{ messages: Array<{ id: string; sender_name: string; recipient_name: string; body: string; attachment_original_name?: string; created_at: string; external_user_name?: string; company_name?: string }> }>("/api/correspondence/messages", { token });
      setCorrespondenceMessages(r.messages);
    } catch {
      // Silently fail
    }
  }, [token]);

  const loadExternalUsers = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api<{ users: Array<{ id: string; full_name: string; company_name: string; magic_token: string }> }>("/api/correspondence/external-users", { token });
      setExternalUsers(r.users);
    } catch {
      setExternalUsers([]);
    }
  }, [token]);

  useEffect(() => {
    void loadCorrespondenceMessages();
    void loadExternalUsers();
  }, [token]);

  const payrollBridgeSummary = useMemo(
    () =>
      `${t("hr.enterprise.salarySlipTitle")} - ${certSalary.employeeName || "—"} / ${certSalary.period || "—"}\n` +
      `${t("hr.enterprise.totalBrut")}: ${salaryCalc.totalBrut.toFixed(2)} MAD\n` +
      `${t("hr.enterprise.totalCotisations")}: ${salaryCalc.totalCotisations.toFixed(2)} MAD\n` +
      `${t("hr.enterprise.netSalary")}: ${salaryCalc.netSalary.toFixed(2)} MAD`,
    [certSalary.employeeName, certSalary.period, salaryCalc.netSalary, salaryCalc.totalBrut, salaryCalc.totalCotisations, t]
  );

  const sendBridgeMessage = async () => {
    if (!token || !bridgeSenderId || !bridgeRecipientId) return;
    setIsBridgeSending(true);
    setBridgeStatus("");
    try {
      await tlSendMessage(token, {
        from_worker_id: bridgeSenderId,
        to_worker_id: bridgeRecipientId,
        body: bridgeBody.trim() || payrollBridgeSummary,
      });
      setBridgeBody("");
      setBridgeStatus(t("hr.enterprise.bridgeSent"));
    } catch (error) {
      setBridgeStatus(error instanceof Error ? error.message : t("auth.errGeneric"));
    } finally {
      setIsBridgeSending(false);
    }
  };

  const applyEmployeePick = (id: string) => {
    const e = employees.find((x) => x.id === id);
    if (!e) return;
    const prefill = buildEnterpriseEmployeePrefill(e);
    setAbsForm((f) => ({
      ...f,
      employeeName: prefill.absenceEmployee.employeeName,
      employeeId: prefill.absenceEmployee.employeeId,
    }));
    setDismissForm((f) => ({
      ...f,
      employeeName: prefill.absenceEmployee.employeeName,
      employeeId: prefill.absenceEmployee.employeeId,
    }));
    setRulesAck((f) => ({
      ...f,
      employeeName: prefill.absenceEmployee.employeeName,
      employeeId: prefill.absenceEmployee.employeeId,
    }));
    setContractCtx((f) => ({
      ...f,
      employeeName: prefill.contract.employeeName,
      nationalId: prefill.contract.nationalId,
      jobTitle: prefill.contract.jobTitle,
      salaryGross: prefill.contract.salaryGross,
      workPlace: prefill.contract.workPlace || f.workPlace,
    }));
    setCertWork((f) => ({
      ...f,
      employeeName: prefill.workCertificate.employeeName,
      employeeId: prefill.workCertificate.employeeId,
      role: prefill.workCertificate.role,
      hireDate: prefill.workCertificate.hireDate || f.hireDate,
      maritalStatus: prefill.workCertificate.maritalStatus,
      workDays: prefill.workCertificate.workDays,
    }));
    setCertSalary((f) => ({
      ...f,
      employeeName: prefill.payroll.employeeName,
      employeeId: prefill.payroll.employeeId,
      workNumber: prefill.payroll.workNumber,
      nationalId: prefill.payroll.nationalId,
      maritalStatus: prefill.payroll.maritalStatus,
      workDays: prefill.payroll.workDays,
      hireDate: prefill.payroll.hireDate,
      gross: prefill.payroll.gross,
    }));
  };

  const exportPdf = async (innerHtml: string, fileBase: string) => {
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: innerHtml,
      sectionTitle: fileBase,
      fileName: `${fileBase}-${Date.now()}`,
      direction: dir,
      lang: pdfLang(appLocale),
      mainTitle: branding.companyName || t("brand"),
      dateLocale: locale,
      documentMode: "creative",
      logoDataUrl: branding.logoDataUrl?.startsWith("data:image") ? branding.logoDataUrl : undefined,
    });
  };

  const exportWord = async (html: string, name: string) => {
    await downloadHtmlAsWord(html, `${name}-${Date.now()}.docx`);
  };

  const addAbsence = () => {
    if (!absForm.employeeName.trim()) return;
    setAbsences((a) => [
      ...a,
      {
        id: crypto.randomUUID(),
        ...absForm,
      },
    ]);
    setAbsForm({ employeeName: "", employeeId: "", from: todayIsoLocal(), to: todayIsoLocal(), reason: "" });
  };

  const defaultEmployer = useMemo(
    () => branding.companyName || contractCtx.employerName || "—",
    [branding.companyName, contractCtx.employerName]
  );

  if (loadingBrand) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-8">
        <Loader2 className="size-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">{t("hr.enterprise.intro")}</p>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="attendance" className="gap-1.5">
            <ClipboardList className="size-4" />
            {t("hr.enterprise.tabAttendance")}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <BookMarked className="size-4" />
            {t("hr.enterprise.tabRules")}
          </TabsTrigger>
          <TabsTrigger value="contract" className="gap-1.5">
            <FileText className="size-4" />
            {t("hr.enterprise.tabContract")}
          </TabsTrigger>
          <TabsTrigger value="certs" className="gap-1.5">
            <Award className="size-4" />
            {t("hr.enterprise.tabCerts")}
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-1.5">
            <BookMarked className="size-4" />
            {locale.startsWith("ar") ? "الأرشيف" : "Archive"}
          </TabsTrigger>
          <TabsTrigger value="ai-advisor" className="gap-1.5">
            <Sparkles className="size-4" />
            {locale.startsWith("ar") ? "مستشار الذكاء الاصطناعي" : "AI Advisor"}
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-1.5">
            <TrendingUp className="size-4" />
            {locale.startsWith("ar") ? "مقارنة الفترات" : "Comparison"}
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-1.5">
            <Calendar className="size-4" />
            {locale.startsWith("ar") ? "العقود" : "Contracts"}
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-1.5">
            <Banknote className="size-4" />
            {locale.startsWith("ar") ? "التحويل البنكي" : "Bank Transfer"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.absenceTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(employees?.length > 0) && (
                <div>
                  <Label>{t("hr.enterprise.pickEmployee")}</Label>
                  <select
                    className="mt-1 flex h-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
                    defaultValue=""
                    onChange={(e) => applyEmployeePick(e.target.value)}
                  >
                    <option value="">{t("hr.enterprise.pickPlaceholder")}</option>
                    {(employees || []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label={t("auth.fullName")}
                  value={absForm.employeeName}
                  onChange={(v) => setAbsForm((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("tbl.empId")}
                  value={absForm.employeeId}
                  onChange={(v) => setAbsForm((f) => ({ ...f, employeeId: v }))}
                />
                <Field
                  label={t("hr.enterprise.from")}
                  type="date"
                  value={absForm.from}
                  onChange={(v) => setAbsForm((f) => ({ ...f, from: v }))}
                />
                <Field
                  label={t("hr.enterprise.to")}
                  type="date"
                  value={absForm.to}
                  onChange={(v) => setAbsForm((f) => ({ ...f, to: v }))}
                />
              </div>
              <div>
                <Label>{t("hr.enterprise.reason")}</Label>
                <Input
                  className="mt-1"
                  value={absForm.reason}
                  onChange={(e) => setAbsForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <Button type="button" variant="secondary" onClick={addAbsence}>
                {t("hr.enterprise.addAbsence")}
              </Button>

              <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4 shadow-[0_0_28px_rgba(217,70,239,0.18)]">
                <div className="flex items-center gap-2 text-sm font-bold text-fuchsia-100">
                  <ClipboardList className="size-4 text-fuchsia-300" />
                  {t("hr.enterprise.aiAttendanceTitle")}
                </div>
                <div className="mt-3 grid sm:grid-cols-3 gap-3">
                  <Field
                    label={t("hr.enterprise.scheduledStart")}
                    type="time"
                    value={attendanceAi.scheduledStart}
                    onChange={(v) => setAttendanceAi((f) => ({ ...f, scheduledStart: v }))}
                  />
                  <Field
                    label={t("hr.enterprise.actualCheckIn")}
                    type="time"
                    value={attendanceAi.actualCheckIn}
                    onChange={(v) => setAttendanceAi((f) => ({ ...f, actualCheckIn: v }))}
                  />
                  <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
                    <div className="text-slate-400">{t("hr.enterprise.attendanceStatus")}</div>
                    <div className={cn("mt-1 font-bold", attendanceCalc.late ? "text-amber-300" : "text-emerald-300")}>
                      {attendanceCalc.absent
                        ? t("hr.enterprise.absenceWarning")
                        : attendanceCalc.late
                          ? t("hr.enterprise.lateWarning").replace("{minutes}", String(attendanceCalc.minutesLate))
                          : t("hr.enterprise.onTime")}
                    </div>
                  </div>
                </div>
              </div>

              {absences?.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-800 text-sm">
                  <table className="w-full">
                    <thead className="bg-slate-900/80">
                      <tr>
                        <th className="p-2 text-right">{t("tbl.name")}</th>
                        <th className="p-2 text-right">{t("hr.enterprise.from")}</th>
                        <th className="p-2 text-right">{t("hr.enterprise.to")}</th>
                        <th className="p-2 text-right">{t("hr.enterprise.reason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(absences || []).map((a) => (
                        <tr key={a.id} className="border-t border-slate-800">
                          <td className="p-2">{a.employeeName}</td>
                          <td className="p-2">{a.from}</td>
                          <td className="p-2">{a.to}</td>
                          <td className="p-2">{a.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <Label>{t("hr.enterprise.returnDate")}</Label>
                  <Input
                    type="date"
                    lang="en"
                    dir="ltr"
                    className="mt-1"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      type="button"
                      size="sm"
                      className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                      onClick={() =>
                        void exportPdf(
                          buildReturnToWorkHtml({
                            branding,
                            employeeName: absForm.employeeName || "—",
                            employeeId: absForm.employeeId || "—",
                            absenceFrom: absForm.from || "—",
                            absenceTo: absForm.to || "—",
                            reason: absForm.reason || "—",
                            returnDate,
                            dir,
                            locale: appLocale,
                          }),
                          "return-to-work"
                        )
                      }
                    >
                      <Download className="size-4" />
                      {t("hr.enterprise.pdfReturn")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                      onClick={() =>
                        void exportWord(
                          buildReturnToWorkHtml({
                            branding,
                            employeeName: absForm.employeeName || "—",
                            employeeId: absForm.employeeId || "—",
                            absenceFrom: absForm.from || "—",
                            absenceTo: absForm.to || "—",
                            reason: absForm.reason || "—",
                            returnDate,
                            dir,
                            locale: appLocale,
                          }),
                          "return-to-work"
                        )
                      }
                    >
                      {t("hr.enterprise.wordExport")}
                    </Button>
                  </div>
                </div>
                <div>
                  <Field
                    label={t("hr.enterprise.dismissDate")}
                    type="date"
                    value={dismissForm.dateNotice}
                    onChange={(v) => setDismissForm((f) => ({ ...f, dateNotice: v }))}
                  />
                  <Label className="mt-3 block">{t("hr.enterprise.dismissTitle")}</Label>
                  <textarea
                    className={cn(
                      "mt-1 min-h-[72px] w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                    )}
                    value={dismissForm.grounds}
                    onChange={(e) =>
                      setDismissForm((f) => ({ ...f, grounds: e.target.value }))
                    }
                    placeholder={t("hr.enterprise.dismissPlaceholder")}
                  />
                  <div className="mt-2 max-w-md">
                    <AiGenerateButton
                      module="hrContract"
                      variant="outline"
                      context={{
                        docKind: "dismissal_grounds",
                        employeeName: dismissForm.employeeName,
                        employeeId: dismissForm.employeeId,
                        dateNotice: dismissForm.dateNotice,
                        groundsHint: dismissForm.grounds,
                      }}
                      onGenerated={(text) =>
                        setDismissForm((f) => ({ ...f, grounds: text.slice(0, 8000) }))
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="bg-red-900/80 shadow-[0_0_18px_rgba(248,113,113,0.28)]"
                      onClick={() =>
                        void exportPdf(
                          buildDismissalNoticeHtml({
                            branding,
                            employeeName: dismissForm.employeeName || absForm.employeeName || "—",
                            employeeId: dismissForm.employeeId || absForm.employeeId || "—",
                            dateNotice: dismissForm.dateNotice,
                            grounds: dismissForm.grounds || "—",
                            dir,
                            locale: appLocale,
                          }),
                          "dismissal-notice"
                        )
                      }
                    >
                      <Download className="size-4" />
                      {t("hr.enterprise.pdfDismiss")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void exportWord(
                          buildDismissalNoticeHtml({
                            branding,
                            employeeName: dismissForm.employeeName || absForm.employeeName || "—",
                            employeeId: dismissForm.employeeId || absForm.employeeId || "—",
                            dateNotice: dismissForm.dateNotice,
                            grounds: dismissForm.grounds || "—",
                            dir,
                            locale: appLocale,
                          }),
                          "dismissal"
                        )
                      }
                    >
                      {t("hr.enterprise.wordExport")}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.rulesTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className={cn(
                  "min-h-[160px] w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 font-mono text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                )}
                value={rulesText}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRulesText(e.target.value)}
              />
              <div className="max-w-md">
                <AiGenerateButton
                  module="hrContract"
                  variant="outline"
                  className="border-fuchsia-300/70 bg-fuchsia-400/10 text-fuchsia-100 shadow-[0_0_22px_rgba(217,70,239,0.35)] hover:bg-fuchsia-300/20"
                  context={{
                    docKind: "internal_rules_polish",
                    rulesExcerpt: rulesText.slice(0, 4000),
                  }}
                  onGenerated={(text) => setRulesText(text.slice(0, 12000))}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label={t("auth.fullName")}
                  value={rulesAck.employeeName}
                  onChange={(v) => setRulesAck((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("tbl.empId")}
                  value={rulesAck.employeeId}
                  onChange={(v) => setRulesAck((f) => ({ ...f, employeeId: v }))}
                />
                <Field
                  label={t("hr.enterprise.ackDate")}
                  type="date"
                  value={rulesAck.date}
                  onChange={(v) => setRulesAck((f) => ({ ...f, date: v }))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                  onClick={() =>
                    void exportPdf(
                      buildInternalRulesAckHtml({
                        branding,
                        employeeName: rulesAck.employeeName || "—",
                        employeeId: rulesAck.employeeId || "—",
                        rulesExcerpt: rulesText,
                        ackDate: rulesAck.date,
                        dir,
                        locale: appLocale,
                      }),
                      "internal-rules-ack"
                    )
                  }
                >
                  <Download className="size-4" />
                  {t("hr.enterprise.pdfRules")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                  onClick={() =>
                    void exportWord(
                      buildInternalRulesAckHtml({
                        branding,
                        employeeName: rulesAck.employeeName || "—",
                        employeeId: rulesAck.employeeId || "—",
                        rulesExcerpt: rulesText,
                        ackDate: rulesAck.date,
                        dir,
                        locale: appLocale,
                      }),
                      "internal-rules"
                    )
                  }
                >
                  {t("hr.enterprise.wordExport")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.contractTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field
                  label={t("hr.enterprise.employer")}
                  value={contractCtx.employerName || defaultEmployer}
                  onChange={(v) => setContractCtx((f) => ({ ...f, employerName: v }))}
                />
                <Field
                  label={t("hr.enterprise.employee")}
                  value={contractCtx.employeeName}
                  onChange={(v) => setContractCtx((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("legalAi.field.nationalId")}
                  value={contractCtx.nationalId}
                  onChange={(v) => setContractCtx((f) => ({ ...f, nationalId: v }))}
                />
                <Field
                  label={t("hr.enterprise.jobTitle")}
                  value={contractCtx.jobTitle}
                  onChange={(v) => setContractCtx((f) => ({ ...f, jobTitle: v }))}
                />
                <Field
                  label={t("hr.labelSalaryMad")}
                  value={contractCtx.salaryGross}
                  onChange={(v) => setContractCtx((f) => ({ ...f, salaryGross: v }))}
                />
                <Field
                  label={t("hr.enterprise.trialMonths")}
                  value={contractCtx.trialMonths}
                  onChange={(v) => setContractCtx((f) => ({ ...f, trialMonths: v }))}
                />
                <div>
                  <Label>{t("hr.labelContractType")}</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
                    value={contractCtx.contractType}
                    onChange={(e) =>
                      setContractCtx((f) => ({ ...f, contractType: e.target.value }))
                    }
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                  </select>
                </div>
                <Field
                  label={t("hr.enterprise.workPlace")}
                  value={contractCtx.workPlace}
                  onChange={(v) => setContractCtx((f) => ({ ...f, workPlace: v }))}
                />
                <Field
                  label={t("hr.enterprise.hoursWeek")}
                  value={contractCtx.hours}
                  onChange={(v) => setContractCtx((f) => ({ ...f, hours: v }))}
                />
              </div>
              <AiGenerateButton
                module="hrContract"
                className="border-fuchsia-300/70 bg-fuchsia-400/10 text-fuchsia-100 shadow-[0_0_22px_rgba(217,70,239,0.35)] hover:bg-fuchsia-300/20"
                context={{
                  employer: contractCtx.employerName || defaultEmployer,
                  employee: contractCtx.employeeName,
                  nationalId: contractCtx.nationalId,
                  jobTitle: contractCtx.jobTitle,
                  salaryGross: contractCtx.salaryGross,
                  trialMonths: contractCtx.trialMonths,
                  contractType: contractCtx.contractType,
                  workPlace: contractCtx.workPlace,
                  hoursPerWeek: contractCtx.hours,
                }}
                onGenerated={(text) => setContractDraft(text)}
              />
              <textarea
                className={cn(
                  "min-h-[220px] w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm leading-relaxed text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                )}
                value={contractDraft}
                onChange={(e) => setContractDraft(e.target.value)}
                placeholder={t("hr.enterprise.contractPlaceholder")}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                  onClick={() =>
                    void exportPdf(
                      buildEmploymentContractHtml({
                        branding,
                        bodyText: contractDraft || t("hr.enterprise.contractEmpty"),
                        dir,
                        locale: appLocale,
                      }),
                      "employment-contract"
                    )
                  }
                >
                  <Download className="size-4" />
                  {t("hr.enterprise.pdfContract")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                  onClick={() =>
                    void exportWord(
                      buildEmploymentContractHtml({
                        branding,
                        bodyText: contractDraft || t("hr.enterprise.contractEmpty"),
                        dir,
                        locale: appLocale,
                      }),
                      "employment-contract"
                    )
                  }
                >
                  {t("hr.enterprise.wordExport")}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">{t("hr.enterprise.disclaimer")}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certs" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.certWorkTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(employees?.length > 0) && (
                <div className="relative">
                  <Label>{t("hr.searchEmployees")}</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input
                      className="pl-10"
                      value={employeeSearchQuery}
                      onChange={(e) => {
                        setEmployeeSearchQuery(e.target.value);
                        setShowEmployeeSearch(true);
                      }}
                      onFocus={() => setShowEmployeeSearch(true)}
                      placeholder={t("hr.searchPlaceholder")}
                    />
                    {employeeSearchQuery && (
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        onClick={() => {
                          setEmployeeSearchQuery("");
                          setShowEmployeeSearch(false);
                        }}
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                  {showEmployeeSearch && ((filteredEmployeesForSearch || []).length > 0) && (
                    <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl">
                      {(filteredEmployeesForSearch || []).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          className="w-full px-4 py-3 text-left text-sm hover:bg-slate-800 border-b border-slate-800 last:border-0"
                          onClick={() => {
                            applyEmployeePick(e.id);
                            setEmployeeSearchQuery("");
                            setShowEmployeeSearch(false);
                          }}
                        >
                          <div className="font-medium text-white">{e.name}</div>
                          <div className="text-xs text-slate-400">
                            {t("tbl.empId")}: {e.employee_id} | {t("hr.labelWorkNumber")}: {e.work_number}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label={t("auth.fullName")}
                  value={certWork.employeeName}
                  onChange={(v) => setCertWork((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("tbl.empId")}
                  value={certWork.employeeId}
                  onChange={(v) => setCertWork((f) => ({ ...f, employeeId: v }))}
                />
                <Field
                  label={t("tbl.role")}
                  value={certWork.role}
                  onChange={(v) => setCertWork((f) => ({ ...f, role: v }))}
                />
                <Field
                  label={t("hr.enterprise.hireDate")}
                  type="date"
                  value={certWork.hireDate}
                  onChange={(v) => setCertWork((f) => ({ ...f, hireDate: v }))}
                />
                <Field
                  label={t("hr.labelContractEndOptional")}
                  type="date"
                  value={certWork.endDate}
                  onChange={(v) => setCertWork((f) => ({ ...f, endDate: v }))}
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.labelMaritalStatus")}
                      value={certWork.maritalStatus}
                      onChange={(v) => setCertWork((f) => ({ ...f, maritalStatus: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertWork((f) => ({ ...f, maritalStatus: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.labelWorkDays")}
                      value={certWork.workDays}
                      onChange={(v) => setCertWork((f) => ({ ...f, workDays: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertWork((f) => ({ ...f, workDays: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                  onClick={() =>
                    void exportPdf(
                      buildWorkCertificateHtml({
                        branding,
                        employeeName: certWork.employeeName || "—",
                        employeeId: certWork.employeeId || "—",
                        role: certWork.role || "—",
                        hireDate: certWork.hireDate || "—",
                        endDate: certWork.endDate || undefined,
                        maritalStatus: certWork.maritalStatus || undefined,
                        workDays: certWork.workDays || undefined,
                        dir,
                        locale: appLocale,
                      }),
                      "work-certificate"
                    )
                  }
                >
                  <Download className="size-4" />
                  {t("hr.enterprise.pdfWorkCert")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                  onClick={() =>
                    void exportWord(
                      buildWorkCertificateHtml({
                        branding,
                        employeeName: certWork.employeeName || "—",
                        employeeId: certWork.employeeId || "—",
                        role: certWork.role || "—",
                        hireDate: certWork.hireDate || "—",
                        endDate: certWork.endDate || undefined,
                        maritalStatus: certWork.maritalStatus || undefined,
                        workDays: certWork.workDays || undefined,
                        dir,
                        locale: appLocale,
                      }),
                      "work-certificate"
                    )
                  }
                >
                  {t("hr.enterprise.wordExport")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.certSalaryTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="w-full md:max-w-md">
                  <Label>{t("hr.importTitle")}</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      ref={salaryFileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleSalaryFileImport}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => salaryFileInputRef.current?.click()}
                    >
                      <FileText className="size-4 mr-2" />
                      {t("hr.importFile")}
                    </Button>
                    {importFileStatus && (
                      <span className="text-xs text-cyan-200 self-center">{importFileStatus}</span>
                    )}
                  </div>
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <div className="rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-500/15 via-slate-950/80 to-emerald-500/10 p-4">
                <div className="grid gap-3 lg:grid-cols-[120px_1fr_auto] lg:items-end">
                  <div className="flex h-24 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/10 p-2">
                    {branding.logoDataUrl?.startsWith("data:image") ? (
                      <img src={branding.logoDataUrl} alt="" className="max-h-20 max-w-full object-contain" />
                    ) : (
                      <ImagePlus className="size-8 text-cyan-200" />
                    )}
                  </div>
                  <Field
                    label={t("hr.enterprise.companyName")}
                    value={branding.companyName}
                    onChange={(companyName) => setBranding((current) => ({ ...current, companyName }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="gap-2" onClick={() => logoInputRef.current?.click()}>
                      <ImagePlus className="size-4" />
                      {t("hr.enterprise.uploadLogo")}
                    </Button>
                    <Button type="button" className="gap-2 bg-emerald-400 text-emerald-950 hover:bg-emerald-300" disabled={savingBranding} onClick={() => void saveBranding()}>
                      {savingBranding ? t("common.processing") : t("common.save")}
                    </Button>
                  </div>
                </div>
                {brandingStatus && <p className="mt-3 text-xs text-emerald-100">{brandingStatus}</p>}
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Field
                  label={t("auth.fullName")}
                  value={certSalary.employeeName}
                  onChange={(v) => setCertSalary((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("tbl.empId")}
                  value={certSalary.employeeId}
                  onChange={(v) => setCertSalary((f) => ({ ...f, employeeId: v }))}
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.labelWorkNumber")}
                      value={certSalary.workNumber}
                      onChange={(v) => setCertSalary((f) => ({ ...f, workNumber: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, workNumber: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.labelCin")}
                      value={certSalary.nationalId}
                      onChange={(v) => setCertSalary((f) => ({ ...f, nationalId: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, nationalId: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.labelMaritalStatus")}
                      value={certSalary.maritalStatus}
                      onChange={(v) => setCertSalary((f) => ({ ...f, maritalStatus: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, maritalStatus: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.labelWorkDays")}
                      value={certSalary.workDays}
                      onChange={(v) => setCertSalary((f) => ({ ...f, workDays: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, workDays: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.labelCity")}
                      value={certSalary.city}
                      onChange={(v) => setCertSalary((f) => ({ ...f, city: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, city: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.labelAddress")}
                      value={certSalary.address}
                      onChange={(v) => setCertSalary((f) => ({ ...f, address: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, address: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={locale.startsWith("ar") ? "القسم / المصلحة" : "Département"}
                      value={certSalary.department}
                      onChange={(v) => setCertSalary((f) => ({ ...f, department: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, department: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={locale.startsWith("ar") ? "الأفراد تحت الكفالة (IGR/CNSS)" : "Personnes à charge (IGR/CNSS)"}
                      value={certSalary.igreCnssDependents}
                      onChange={(v) => setCertSalary((f) => ({ ...f, igreCnssDependents: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, igreCnssDependents: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={locale.startsWith("ar") ? "ساعات العمل اليومية" : "Heures journalières"}
                      type="number"
                      value={certSalary.dailyHours}
                      onChange={(v) => setCertSalary((f) => ({ ...f, dailyHours: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, dailyHours: "8" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={locale.startsWith("ar") ? "ثمن الساعة العادية" : "Taux horaire"}
                      value={certSalary.hourlyRate}
                      onChange={(v) => setCertSalary((f) => ({ ...f, hourlyRate: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, hourlyRate: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.enterprise.hireDate")}
                      type="date"
                      value={certSalary.hireDate}
                      onChange={(v) => setCertSalary((f) => ({ ...f, hireDate: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, hireDate: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={locale.startsWith("ar") ? "نهاية عقد العمل" : "Fin de contrat"}
                      type="date"
                      value={certSalary.contractEndDate}
                      onChange={(v) => setCertSalary((f) => ({ ...f, contractEndDate: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setCertSalary((f) => ({ ...f, contractEndDate: "" }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-3">
                  <div className="text-xs text-cyan-200">
                    {locale.startsWith("ar") ? "الأقدمية" : "Ancienneté"}: {tenureDisplay.display}
                  </div>
                  <div className="text-xs text-cyan-300 mt-1">
                    {locale.startsWith("ar") ? "نسبة منحة الأقدمية" : "Prime d'ancienneté"}: {seniorityPercentage}%
                  </div>
                </div>
                <Field
                  label={t("hr.enterprise.period")}
                  value={certSalary.period}
                  onChange={(v) => setCertSalary((f) => ({ ...f, period: v }))}
                  placeholder="2026-04"
                />
                <Field
                  label={t("hr.labelSalaryMad")}
                  value={certSalary.gross}
                  onChange={(v) => setCertSalary((f) => ({ ...f, gross: v }))}
                />
                <Field
                  label={t("hr.enterprise.paidLeave")}
                  value={certSalary.paidLeave}
                  onChange={(v) => setCertSalary((f) => ({ ...f, paidLeave: v }))}
                />
                <Field
                  label={t("hr.enterprise.overtime125")}
                  value={certSalary.overtime125}
                  onChange={(v) => setCertSalary((f) => ({ ...f, overtime125: v }))}
                />
                <Field
                  label={t("hr.enterprise.overtime150")}
                  value={certSalary.overtime150}
                  onChange={(v) => setCertSalary((f) => ({ ...f, overtime150: v }))}
                />
                <Field
                  label={t("hr.enterprise.overtime200")}
                  value={certSalary.overtime200}
                  onChange={(v) => setCertSalary((f) => ({ ...f, overtime200: v }))}
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      label={t("hr.enterprise.seniorityBonus")}
                      value={certSalary.seniorityBonus}
                      onChange={(v) => setCertSalary((f) => ({ ...f, seniorityBonus: v }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-6 border-cyan-300/50 text-cyan-300 hover:bg-cyan-500/20"
                    onClick={() => calculateSeniorityBonus()}
                    title={t("hr.enterprise.autoCalculate")}
                  >
                    <Percent className="size-4" />
                  </Button>
                </div>
                <Field
                  label={t("hr.enterprise.attendanceBonus")}
                  value={certSalary.attendanceBonus}
                  onChange={(v) => setCertSalary((f) => ({ ...f, attendanceBonus: v }))}
                />
                <Field
                  label={t("hr.enterprise.productivityBonus")}
                  value={certSalary.productivityBonus}
                  onChange={(v) => setCertSalary((f) => ({ ...f, productivityBonus: v }))}
                />
                <Field
                  label={t("hr.enterprise.cnss")}
                  value={certSalary.cnss}
                  onChange={(v) => setCertSalary((f) => ({ ...f, cnss: v }))}
                />
                <Field
                  label={t("hr.enterprise.amo")}
                  value={certSalary.amo}
                  onChange={(v) => setCertSalary((f) => ({ ...f, amo: v }))}
                />
                <Field
                  label={t("hr.enterprise.ipe")}
                  value={certSalary.ipe}
                  onChange={(v) => setCertSalary((f) => ({ ...f, ipe: v }))}
                />
                <Field
                  label={t("hr.enterprise.mutual")}
                  value={certSalary.mutual}
                  onChange={(v) => setCertSalary((f) => ({ ...f, mutual: v }))}
                />
                <Field
                  label={t("hr.enterprise.mutualId")}
                  value={certSalary.mutualId}
                  onChange={(v) => setCertSalary((f) => ({ ...f, mutualId: v }))}
                />
                <Field
                  label={t("hr.enterprise.advanceSalary")}
                  value={certSalary.advanceSalary}
                  onChange={(v) => setCertSalary((f) => ({ ...f, advanceSalary: v }))}
                />
              </div>
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm shadow-[0_0_28px_rgba(52,211,153,0.18)]">
                <div className="font-bold text-emerald-100">{t("hr.enterprise.autoDeductions")}</div>
                <div className="mt-2 grid sm:grid-cols-3 xl:grid-cols-6 gap-2 text-slate-200">
                  <span>{t("hr.enterprise.totalBrut")}: {salaryCalc.totalBrut.toFixed(2)} MAD</span>
                  <span>CNSS: {salaryCalc.cnss.toFixed(2)} MAD</span>
                  <span>AMO: {salaryCalc.amo.toFixed(2)} MAD</span>
                  <span>IPE: {salaryCalc.ipe.toFixed(2)} MAD</span>
                  <span>{t("hr.enterprise.totalCotisations")}: {salaryCalc.totalCotisations.toFixed(2)} MAD</span>
                  <span className="font-bold text-emerald-200">{t("hr.enterprise.netSalary")}: {salaryCalc.netSalary.toFixed(2)} MAD</span>
                </div>
              </div>

              {/* Accounting Reference Component - Article 350 */}
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <BookMarked className="size-5 text-orange-400" />
                  <h3 className="text-lg font-bold text-orange-400">
                    {locale.startsWith("ar") ? "المرجع المحاسبي والمدونة المغربية" : "Référence comptable & Code du travail"}
                  </h3>
                </div>
                <p className="text-sm text-slate-300 mb-4">
                  {locale.startsWith("ar")
                    ? "تُحدد منحة الأقدمية قانونياً في المغرب بناءً على الفئات التالية وفقاً للمادة 350"
                    : "La prime d'ancienneté est légalement déterminée au Maroc selon les catégories suivantes conformément à l'article 350"}
                </p>
                <div className="rounded-lg border border-orange-400/20 bg-orange-500/5 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-orange-500/10">
                      <tr>
                        <th className="p-3 text-right border-b border-orange-400/20 text-orange-300">
                          {locale.startsWith("ar") ? "الأقدمية" : "Ancienneté"}
                        </th>
                        <th className="p-3 text-right border-b border-orange-400/20 text-orange-300">
                          {locale.startsWith("ar") ? "النسبة" : "Taux"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-orange-400/10">
                        <td className="p-3 text-slate-200">
                          {locale.startsWith("ar") ? "أقل من سنتين" : "Moins de 2 ans"}
                        </td>
                        <td className="p-3 text-right font-medium text-orange-300">0%</td>
                      </tr>
                      <tr className="border-b border-orange-400/10">
                        <td className="p-3 text-slate-200">
                          {locale.startsWith("ar") ? "من سنتين إلى أقل من 5 سنوات" : "De 2 à moins de 5 ans"}
                        </td>
                        <td className="p-3 text-right font-medium text-orange-300">5%</td>
                      </tr>
                      <tr className="border-b border-orange-400/10">
                        <td className="p-3 text-slate-200">
                          {locale.startsWith("ar") ? "من 5 سنوات إلى أقل من 12 سنة" : "De 5 à moins de 12 ans"}
                        </td>
                        <td className="p-3 text-right font-medium text-orange-300">10%</td>
                      </tr>
                      <tr className="border-b border-orange-400/10">
                        <td className="p-3 text-slate-200">
                          {locale.startsWith("ar") ? "من 12 سنة إلى أقل من 20 سنة" : "De 12 à moins de 20 ans"}
                        </td>
                        <td className="p-3 text-right font-medium text-orange-300">15%</td>
                      </tr>
                      <tr className="border-b border-orange-400/10">
                        <td className="p-3 text-slate-200">
                          {locale.startsWith("ar") ? "من 20 سنة إلى أقل من 25 سنة" : "De 20 à moins de 25 ans"}
                        </td>
                        <td className="p-3 text-right font-medium text-orange-300">20%</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-200">
                          {locale.startsWith("ar") ? "25 سنة فما فوق" : "25 ans et plus"}
                        </td>
                        <td className="p-3 text-right font-medium text-orange-300">25%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">💡</span>
                    <p className="text-sm text-cyan-200">
                      {locale.startsWith("ar")
                        ? "نصيحة محاسبية احترافية: يتم احتساب اقتطاع الضمان الاجتماعي CNSS على الأجر الإجمالي ولكن بحد أقصى قدره 6000 درهم شهرياً، بينما يُحسب اقتطاع AMO بنسبة 2.26% على كامل الأجر دون سقف."
                        : "Conseil comptable professionnel: La cotisation CNSS est calculée sur le salaire brut mais avec un plafond maximum de 6000 MAD mensuels, tandis que la cotisation AMO est calculée à 2.26% sur l'intégralité du salaire sans plafond."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Professional Bilingual Bulletin de Paie */}
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 shadow-lg">
                <div className="mb-6 border-b border-slate-700 pb-4">
                  <h3 className="text-xl font-bold text-cyan-400 text-center">
                    {locale.startsWith("ar") ? "كشف الأجر / Bulletin de Paie" : "Bulletin de Paie / كشف الأجر"}
                  </h3>
                  <p className="text-center text-slate-400 text-sm mt-2">
                    {certSalary.period || locale.startsWith("ar") ? "الفترة: —" : "Période: —"}
                  </p>
                </div>

                {/* Employee Information */}
                <div className="mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">{locale.startsWith("ar") ? "الموظف:" : "Employé:"}</span>
                    <span className="ml-2 font-medium text-slate-200">{certSalary.employeeName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{locale.startsWith("ar") ? "رقم التسجيل:" : "Matricule:"}</span>
                    <span className="ml-2 font-medium text-slate-200">{certSalary.employeeId || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{locale.startsWith("ar") ? "رقم العمل:" : "Numéro de travail:"}</span>
                    <span className="ml-2 font-medium text-slate-200">{certSalary.workNumber || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{locale.startsWith("ar") ? "القسم:" : "Département:"}</span>
                    <span className="ml-2 font-medium text-slate-200">{certSalary.department || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{locale.startsWith("ar") ? "رقم الحساب (RIB):" : "RIB:"}</span>
                    <span className="ml-2 font-medium text-slate-200">{certSalary.rib || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{locale.startsWith("ar") ? "الأقدمية:" : "Ancienneté:"}</span>
                    <span className="ml-2 font-medium text-slate-200">{tenureDisplay.display}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{locale.startsWith("ar") ? "الأفراد تحت الكفالة:" : "Personnes à charge:"}</span>
                    <span className="ml-2 font-medium text-slate-200">{certSalary.igreCnssDependents || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{locale.startsWith("ar") ? "ساعات العمل اليومية:" : "Heures journalières:"}</span>
                    <span className="ml-2 font-medium text-slate-200">{certSalary.dailyHours || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{locale.startsWith("ar") ? "ثمن الساعة:" : "Taux horaire:"}</span>
                    <span className="ml-2 font-medium text-slate-200">{certSalary.hourlyRate || "—"}</span>
                  </div>
                </div>

                {/* Earnings Table */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-emerald-400 mb-2">
                    {locale.startsWith("ar") ? "الإيرادات / Revenus" : "Revenus / الإيرادات"}
                  </h4>
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="p-2 text-right border-b border-slate-700 text-slate-300">
                            {locale.startsWith("ar") ? "الوصف" : "Description"}
                          </th>
                          <th className="p-2 text-right border-b border-slate-700 text-slate-300">
                            {locale.startsWith("ar") ? "المبلغ (درهم)" : "Montant (MAD)"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            {locale.startsWith("ar") ? "الراتب الأساسي" : "Salaire de base"}
                          </td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.baseSalary.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            {locale.startsWith("ar") ? "منحة الأقدمية" : "Prime d'ancienneté"} ({seniorityPercentage}%)
                          </td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.seniorityBonus.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            {locale.startsWith("ar") ? "إجازات مدفوعة" : "Congés payés"}
                          </td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.paidLeave.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            {locale.startsWith("ar") ? "ساعات إضافية 125%" : "Heures supplémentaires 125%"}
                          </td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.overtime125.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            {locale.startsWith("ar") ? "ساعات إضافية 150%" : "Heures supplémentaires 150%"}
                          </td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.overtime150.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            {locale.startsWith("ar") ? "ساعات إضافية 200%" : "Heures supplémentaires 200%"}
                          </td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.overtime200.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            {locale.startsWith("ar") ? "منحة الحضور" : "Prime d'assiduité"}
                          </td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.attendanceBonus.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            {locale.startsWith("ar") ? "منحة الإنتاجية" : "Prime de productivité"}
                          </td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.productivityBonus.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-emerald-900/20">
                          <td className="p-2 font-bold text-emerald-400">
                            {locale.startsWith("ar") ? "الإجمالي / Total Brut" : "Total Brut / الإجمالي"}
                          </td>
                          <td className="p-2 text-right font-bold text-emerald-400">{salaryCalc.totalBrut.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Deductions Table */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-amber-400 mb-2">
                    {locale.startsWith("ar") ? "الاقتطاعات / Cotisations" : "Cotisations / الاقتطاعات"}
                  </h4>
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="p-2 text-right border-b border-slate-700 text-slate-300">
                            {locale.startsWith("ar") ? "الوصف" : "Description"}
                          </th>
                          <th className="p-2 text-right border-b border-slate-700 text-slate-300">
                            {locale.startsWith("ar") ? "النسبة" : "Taux"}
                          </th>
                          <th className="p-2 text-right border-b border-slate-700 text-slate-300">
                            {locale.startsWith("ar") ? "المبلغ (درهم)" : "Montant (MAD)"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            CNSS ({locale.startsWith("ar") ? "الصندوق الوطني للضمان الاجتماعي" : "Caisse Nationale"})
                          </td>
                          <td className="p-2 text-right text-slate-400">4.48%</td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.cnss.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            AMO ({locale.startsWith("ar") ? "التغطية الصحية الإجبارية" : "Assurance Maladie Obligatoire"})
                          </td>
                          <td className="p-2 text-right text-slate-400">2.26%</td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.amo.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="p-2 text-slate-200">
                            IPE ({locale.startsWith("ar") ? "صندوق المهنة" : "Caisse de métier"})
                          </td>
                          <td className="p-2 text-right text-slate-400">0.19%</td>
                          <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.ipe.toFixed(2)}</td>
                        </tr>
                        {salaryCalc.mutual > 0 && (
                          <tr className="border-b border-slate-800">
                            <td className="p-2 text-slate-200">
                              {locale.startsWith("ar") ? "التأمين التبادلي" : "Mutuelle"}
                            </td>
                            <td className="p-2 text-right text-slate-400">—</td>
                            <td className="p-2 text-right font-medium text-slate-200">{salaryCalc.mutual.toFixed(2)}</td>
                          </tr>
                        )}
                        <tr className="bg-amber-900/20">
                          <td className="p-2 font-bold text-amber-400">
                            {locale.startsWith("ar") ? "إجمالي الاقتطاعات / Total Cotisations" : "Total Cotisations / إجمالي الاقتطاعات"}
                          </td>
                          <td className="p-2"></td>
                          <td className="p-2 text-right font-bold text-amber-400">{salaryCalc.totalCotisations.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Net Salary */}
                <div className="rounded-lg border-2 border-cyan-500/50 bg-cyan-500/10 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-cyan-400">
                      {locale.startsWith("ar") ? "الراتب الصافي / Salaire Net" : "Salaire Net / الراتب الصافي"}
                    </span>
                    <span className="text-2xl font-bold text-cyan-300">{salaryCalc.netSalary.toFixed(2)} MAD</span>
                  </div>
                  {salaryCalc.advanceSalary > 0 && (
                    <div className="mt-2 pt-2 border-t border-cyan-500/30 text-sm">
                      <span className="text-slate-400">
                        {locale.startsWith("ar") ? "سلفة مستردة:" : "Salaire avancé:"}
                      </span>
                      <span className="ml-2 font-medium text-slate-200">-{salaryCalc.advanceSalary.toFixed(2)} MAD</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-sky-300/25 bg-sky-500/10 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 font-bold text-sky-100">
                      <MessageSquare className="size-4" />
                      {t("hr.enterprise.bridgeTitle")}
                    </p>
                    <p className="text-xs text-slate-400">{t("hr.enterprise.bridgeDesc")}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={isBridgeLoading} onClick={() => void loadBridgeData()}>
                    {isBridgeLoading ? t("common.processing") : t("barcode.refresh")}
                  </Button>
                </div>
                <div className="mb-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    {t("hr.enterprise.bridgeWorkers")}: {bridgeWorkers.length}
                  </span>
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    {t("hr.enterprise.bridgeInventory")}: {bridgeInventoryCount}
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-300">{t("hr.enterprise.bridgeSender")}</span>
                    <select className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white" value={bridgeSenderId} onChange={(event) => setBridgeSenderId(event.target.value)}>
                      {(bridgeWorkers || []).map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.full_name} · {worker.department}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-300">{t("hr.enterprise.bridgeRecipient")}</span>
                    <select className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white" value={bridgeRecipientId} onChange={(event) => setBridgeRecipientId(event.target.value)}>
                      {(bridgeWorkers || []).filter((worker) => worker.id !== bridgeSenderId).map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.full_name} · {worker.department}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <textarea
                  className="mt-3 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  value={bridgeBody}
                  onChange={(event) => setBridgeBody(event.target.value)}
                  placeholder={payrollBridgeSummary}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" className="gap-2 bg-sky-400 text-sky-950 hover:bg-sky-300" disabled={isBridgeSending || !bridgeSenderId || !bridgeRecipientId} onClick={() => void sendBridgeMessage()}>
                    <Send className="size-4" />
                    {isBridgeSending ? t("common.processing") : t("hr.enterprise.bridgeSend")}
                  </Button>
                  {bridgeStatus && <span className="text-xs text-sky-100">{bridgeStatus}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                  onClick={() =>
                    void exportPdf(
                      buildPayrollSlipHtml({
                        branding,
                        employeeName: certSalary.employeeName || "—",
                        employeeId: certSalary.employeeId || "—",
                        workNumber: certSalary.workNumber || undefined,
                        nationalId: certSalary.nationalId || undefined,
                        maritalStatus: certSalary.maritalStatus || undefined,
                        workDays: certSalary.workDays || undefined,
                        hireDate: certSalary.hireDate || undefined,
                        city: certSalary.city || undefined,
                        address: certSalary.address || undefined,
                        period: certSalary.period || "—",
                        ...salaryCalc,
                        dir,
                        locale: appLocale,
                      }),
                      "fiche-de-paie"
                    )
                  }
                >
                  <Download className="size-4" />
                  {t("hr.enterprise.salarySlipTitle")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                  onClick={exportSalaryExcel}
                >
                  <FileSpreadsheet className="size-4" />
                  Excel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                  onClick={() =>
                    void exportWord(
                      buildPayrollSlipHtml({
                        branding,
                        employeeName: certSalary.employeeName || "—",
                        employeeId: certSalary.employeeId || "—",
                        workNumber: certSalary.workNumber || undefined,
                        nationalId: certSalary.nationalId || undefined,
                        maritalStatus: certSalary.maritalStatus || undefined,
                        workDays: certSalary.workDays || undefined,
                        hireDate: certSalary.hireDate || undefined,
                        city: certSalary.city || undefined,
                        address: certSalary.address || undefined,
                        period: certSalary.period || "—",
                        ...salaryCalc,
                        dir,
                        locale: appLocale,
                      }),
                      "fiche-de-paie"
                    )
                  }
                >
                  {t("hr.enterprise.wordExport")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-purple-500/30 bg-purple-500/10 text-purple-100 hover:bg-purple-500/20"
                  onClick={savePayrollToArchive}
                >
                  <BookMarked className="size-4 mr-2" />
                  {locale.startsWith("ar") ? "حفظ في الأرشيف" : "Save to Archive"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Advisor Tab */}
        <TabsContent value="ai-advisor" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-5 text-purple-400" />
                {locale.startsWith("ar") ? "مستشار الذكاء الاصطناعي للأجور والتأمينات" : "AI Payroll & Insurance Advisor"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-sm">
                <p className="text-purple-200">
                  {locale.startsWith("ar")
                    ? "💡 مساعد ذكي متخصص في القوانين والمساطر المغربية للأجور والتأمينات الاجتماعية والتحويلات البنكية. اسأل أي سؤال بالعربية أو الفرنسية أو الإنجليزية أو الإسبانية."
                    : "💡 Smart assistant specialized in Moroccan payroll, social insurance, and banking regulations. Ask questions in Arabic, French, English, or Spanish."}
                </p>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 h-[400px] overflow-y-auto">
                {aiMessages.length === 0 && (
                  <div className="text-center text-slate-400 py-8">
                    <MessageSquare className="size-12 mx-auto mb-3 opacity-50" />
                    <p>{locale.startsWith("ar") ? "ابدأ المحادثة بطرح سؤال حول الأجور أو التأمينات" : "Start a conversation about payroll or insurance"}</p>
                  </div>
                )}
                {(aiMessages || []).map((msg, idx) => (
                  <div
                    key={idx}
                    className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}
                  >
                    <div
                      className={`inline-block max-w-[80%] rounded-xl p-3 ${
                        msg.role === "user"
                          ? "bg-cyan-500/20 text-cyan-100"
                          : "bg-purple-500/20 text-purple-100"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={aiChatEndRef} />
              </div>

              <div className="flex gap-2">
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder={locale.startsWith("ar") ? "اكتب سؤالك هنا..." : "Type your question here..."}
                  onKeyPress={(e) => e.key === "Enter" && !isAiLoading && handleAiMessage()}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAiMessage}
                  disabled={isAiLoading || !aiInput.trim()}
                  className="bg-purple-500/20 border-purple-500/30 text-purple-100 hover:bg-purple-500/30"
                >
                  {isAiLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
                <Button
                  type="button"
                  onClick={toggleRecording}
                  variant={isRecording ? "destructive" : "outline"}
                  className={isRecording ? "bg-red-500/20 border-red-500/30" : "border-purple-500/30 text-purple-100"}
                >
                  {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="size-5 text-emerald-400" />
                {locale.startsWith("ar") ? "مقارنة فترات كشوف الأجر" : "Payroll Period Comparison"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label>{locale.startsWith("ar") ? "الموظف" : "Employee"}</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
                    value={comparisonEmployee}
                    onChange={(e) => setComparisonEmployee(e.target.value)}
                  >
                    <option value="">{locale.startsWith("ar") ? "اختر الموظف" : "Select employee"}</option>
                    {(employees || []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{locale.startsWith("ar") ? "الفترة الأولى" : "Period 1"}</Label>
                  <Input
                    className="mt-1"
                    value={comparisonPeriod1}
                    onChange={(e) => setComparisonPeriod1(e.target.value)}
                    placeholder="2026-04"
                  />
                </div>
                <div>
                  <Label>{locale.startsWith("ar") ? "الفترة الثانية" : "Period 2"}</Label>
                  <Input
                    className="mt-1"
                    value={comparisonPeriod2}
                    onChange={(e) => setComparisonPeriod2(e.target.value)}
                    placeholder="2026-05"
                  />
                </div>
              </div>

              {comparisonEmployee && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="grid sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-slate-400">{locale.startsWith("ar") ? "تغير صافي الراتب" : "Net Change"}</div>
                      <div className="text-xl font-bold text-emerald-400">+690.25 DH</div>
                      <div className="text-xs text-emerald-300">{locale.startsWith("ar") ? "ارتفاع (+8.2%)" : "Increase (+8.2%)"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">{locale.startsWith("ar") ? "تغير الاقتطاعات" : "Deductions Change"}</div>
                      <div className="text-xl font-bold text-amber-400">+338.75 DH</div>
                      <div className="text-xs text-amber-300">{locale.startsWith("ar") ? "ارتفاع (+14.2%)" : "Increase (+14.2%)"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">{locale.startsWith("ar") ? "تغير الأجر الإجمالي" : "Gross Change"}</div>
                      <div className="text-xl font-bold text-cyan-400">+1,029.00 DH</div>
                      <div className="text-xs text-cyan-300">{locale.startsWith("ar") ? "ارتفاع (+9.5%)" : "Increase (+9.5%)"}</div>
                    </div>
                  </div>
                </div>
              )}

              {comparisonEmployee && (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/80">
                      <tr>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "العنصر" : "Item"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "الحالة" : "Status"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "التغيير %" : "Change %"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "التغيير (درهم)" : "Change (MAD)"}</th>
                        <th className="p-2 text-right">{comparisonPeriod2}</th>
                        <th className="p-2 text-right">{comparisonPeriod1}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-800">
                        <td className="p-2">{locale.startsWith("ar") ? "الراتب الأساسي" : "Base Salary"}</td>
                        <td className="p-2 text-slate-400">{locale.startsWith("ar") ? "ثابت" : "Constant"}</td>
                        <td className="p-2">0.0%</td>
                        <td className="p-2">0.00</td>
                        <td className="p-2">8,500.00 DH</td>
                        <td className="p-2">8,500.00 DH</td>
                      </tr>
                      <tr className="border-t border-slate-800">
                        <td className="p-2">{locale.startsWith("ar") ? "التعويضات" : "Allowances"}</td>
                        <td className="p-2 text-emerald-400">{locale.startsWith("ar") ? "ارتفاع +" : "Increase +"}</td>
                        <td className="p-2 text-emerald-400">+25.0%</td>
                        <td className="p-2 text-emerald-400">+300.00</td>
                        <td className="p-2">1,500.00 DH</td>
                        <td className="p-2">1,200.00 DH</td>
                      </tr>
                      <tr className="border-t border-slate-800">
                        <td className="p-2">{locale.startsWith("ar") ? "صافي الراتب" : "Net Salary"}</td>
                        <td className="p-2 text-emerald-400">{locale.startsWith("ar") ? "ارتفاع +" : "Increase +"}</td>
                        <td className="p-2 text-emerald-400">+8.2%</td>
                        <td className="p-2 text-emerald-400">+690.25</td>
                        <td className="p-2">9,122.35 DH</td>
                        <td className="p-2">8,432.10 DH</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4">
                <div className="flex items-start gap-2">
                  <span className="text-lg">💡</span>
                  <p className="text-sm text-cyan-200">
                    {locale.startsWith("ar")
                      ? "يساعدك هذا الجدول في اكتشاف تغير التكاليف ومصادر تعديل أجر الموظف. أي فارق في الأجر الأساسي أو التعويضات يظهر تأثيره تلقائياً في الاقتطاعات الإلزامية ونسب الـ IGR المقابلة."
                      : "This table helps you discover cost changes and sources of employee salary modifications. Any difference in base salary or allowances automatically affects mandatory deductions and corresponding IGR rates."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts Monitoring Tab */}
        <TabsContent value="contracts" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-5 text-orange-400" />
                {locale.startsWith("ar") ? "لوحة متابعة العقود (60 يوماً)" : "Contract Monitoring Dashboard (60 days)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="size-5 text-orange-400" />
                  <span className="font-bold text-orange-200">
                    {locale.startsWith("ar") ? "تنبيهات اقتراب نهاية العقود" : "Contract Expiration Alerts"}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/20">
                    <div>
                      <div className="font-medium text-orange-100">عادل الفاسي</div>
                      <div className="text-sm text-orange-300">EMP-001 (CD456789)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-orange-400 font-bold">{locale.startsWith("ar") ? "بعد 12 يوم" : "12 days left"}</div>
                      <div className="text-sm text-orange-300">2026-07-20</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/20">
                    <div>
                      <div className="font-medium text-red-100">يوسف الناصري</div>
                      <div className="text-sm text-red-300">EMP-005 (JB112233)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-red-400 font-bold">{locale.startsWith("ar") ? "بعد 7 يوم" : "7 days left"}</div>
                      <div className="text-sm text-red-300">2026-07-15</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/80">
                    <tr>
                      <th className="p-2 text-right">{locale.startsWith("ar") ? "الموظف" : "Employee"}</th>
                      <th className="p-2 text-right">{locale.startsWith("ar") ? "نوع العقد" : "Contract Type"}</th>
                      <th className="p-2 text-right">{locale.startsWith("ar") ? "تاريخ البداية" : "Start Date"}</th>
                      <th className="p-2 text-right">{locale.startsWith("ar") ? "تاريخ النهاية" : "End Date"}</th>
                      <th className="p-2 text-right">{locale.startsWith("ar") ? "الأيام المتبقية" : "Days Left"}</th>
                      <th className="p-2 text-right">{locale.startsWith("ar") ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(employees || []).slice(0, 5).map((e) => (
                      <tr key={e.id} className="border-t border-slate-800">
                        <td className="p-2">{e.name}</td>
                        <td className="p-2">{e.contract_type}</td>
                        <td className="p-2">{e.start_date}</td>
                        <td className="p-2">{e.contract_end || "—"}</td>
                        <td className="p-2">{e.contract_end ? "30" : "—"}</td>
                        <td className="p-2">
                          {e.contract_end ? (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">
                              {locale.startsWith("ar") ? "نشط" : "Active"}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs">
                              CDI
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Transfer Tab */}
        <TabsContent value="bank" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="size-5 text-green-400" />
                {locale.startsWith("ar") ? "توليد أمر تحويل بنكي جماعي" : "Bank Transfer Batch Generation"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
                <p className="text-green-200">
                  {locale.startsWith("ar")
                    ? "💡 قم بتحديد الموظفين لتوليد ملف جاهز للتحويل البنكي الجماعي (RIB). يتم استخدام صافي الراتب من آخر شهادة أجر محفوظة. يمكنك تصفية حسب البنك والبحث عن الموظف وتصدير كـ CSV, Excel, أو PDF."
                    : "💡 Select employees to generate a file ready for batch bank transfer (RIB). Uses net salary from latest saved payroll. Filter by bank, search employees, and export as CSV, Excel, or PDF."}
                </p>
              </div>

              {/* Bank Filter and Search */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Label>{locale.startsWith("ar") ? "تصفية حسب البنك:" : "Filter by Bank:"}</Label>
                  <Input
                    className="flex h-10 rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm w-64"
                    list="bank-options"
                    placeholder={locale.startsWith("ar") ? "اختر أو اكتب اسم البنك" : "Select or type bank name"}
                    value={selectedBankFilter === "all" ? "" : selectedBankFilter}
                    onChange={(e) => setSelectedBankFilter(e.target.value || "all")}
                  />
                  <datalist id="bank-options">
                    <option value="all">{locale.startsWith("ar") ? "جميع البنوك" : "All Banks"}</option>
                    {uniqueBanks.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <Label>{locale.startsWith("ar") ? "البحث عن موظف:" : "Search Employee:"}</Label>
                  <Input
                    className="flex h-10 rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
                    placeholder={locale.startsWith("ar") ? "رقم العميل، رقم البطاقة، أو الاسم" : "Customer ID, CIN, or Name"}
                    value={bankTransferSearchQuery}
                    onChange={(e) => setBankTransferSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-emerald-900/30 to-cyan-900/30">
                    <tr>
                      <th className="p-3 text-right bg-emerald-500/10">
                        <input
                          type="checkbox"
                          checked={selectedForTransfer.size === filteredEmployeesForTransfer.length && filteredEmployeesForTransfer.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedForTransfer(new Set(filteredEmployeesForTransfer.map((e) => e.id)));
                            } else {
                              setSelectedForTransfer(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="p-3 text-right bg-emerald-500/10 text-emerald-300">{locale.startsWith("ar") ? "الموظف" : "Employee"}</th>
                      <th className="p-3 text-right bg-emerald-500/10 text-emerald-300">{locale.startsWith("ar") ? "رقم الحساب (RIB)" : "RIB"}</th>
                      <th className="p-3 text-right bg-emerald-500/10 text-emerald-300">{locale.startsWith("ar") ? "صافي الراتب" : "Net Salary"}</th>
                      <th className="p-3 text-right bg-emerald-500/10 text-emerald-300">{locale.startsWith("ar") ? "البنك" : "Bank"}</th>
                      <th className="p-3 text-right bg-emerald-500/10 text-emerald-300">{locale.startsWith("ar") ? "المدينة" : "City"}</th>
                      <th className="p-3 text-right bg-emerald-500/10 text-emerald-300">{locale.startsWith("ar") ? "رقم البطاقة" : "CIN"}</th>
                      <th className="p-3 text-right bg-emerald-500/10 text-emerald-300">{locale.startsWith("ar") ? "رقم الموظف" : "Employee ID"}</th>
                      <th className="p-3 text-right bg-emerald-500/10 text-emerald-300">{locale.startsWith("ar") ? "الإجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredEmployeesForTransfer || []).map((e) => {
                      const draft = transferDrafts[e.id] || {};
                      const sortedPayroll = payrollArchives
                        .filter((p) => p.employeeId === e.employee_id)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      const latestPayroll = sortedPayroll[0];
                      const netSalary = draft.netSalary || latestPayroll?.netSalary || e.salary;
                      return (
                        <tr key={e.id} className="border-t border-slate-800 hover:bg-slate-800/50 transition-colors">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedForTransfer.has(e.id)}
                              onChange={() => {
                                const newSet = new Set(selectedForTransfer);
                                if (newSet.has(e.id)) {
                                  newSet.delete(e.id);
                                } else {
                                  newSet.add(e.id);
                                }
                                setSelectedForTransfer(newSet);
                              }}
                            />
                          </td>
                          <td className="p-3 font-medium text-white">{e.name}</td>
                          <td className="p-3">
                            <Input
                              className="h-8 bg-slate-900/50 border-slate-700 text-xs"
                              value={draft.rib !== undefined ? draft.rib : (e.rib || "")}
                              onChange={(ev) =>
                                setTransferDrafts((prev) => ({
                                  ...prev,
                                  [e.id]: { ...draft, rib: ev.target.value },
                                }))
                              }
                              placeholder={locale.startsWith("ar") ? "رقم الحساب" : "RIB"}
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              className="h-8 bg-slate-900/50 border-slate-700 text-xs w-24"
                              type="number"
                              value={draft.netSalary || netSalary || ""}
                              onChange={(ev) =>
                                setTransferDrafts((prev) => ({
                                  ...prev,
                                  [e.id]: { ...draft, netSalary: parseFloat(ev.target.value) || 0 },
                                }))
                              }
                              placeholder="MAD"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              className="h-8 bg-slate-900/50 border-slate-700 text-xs"
                              value={draft.bank_name !== undefined ? draft.bank_name : (e.bank_name || "")}
                              onChange={(ev) =>
                                setTransferDrafts((prev) => ({
                                  ...prev,
                                  [e.id]: { ...draft, bank_name: ev.target.value },
                                }))
                              }
                              placeholder={locale.startsWith("ar") ? "اسم البنك" : "Bank Name"}
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              className="h-8 bg-slate-900/50 border-slate-700 text-xs"
                              value={draft.city || e.city || ""}
                              onChange={(ev) =>
                                setTransferDrafts((prev) => ({
                                  ...prev,
                                  [e.id]: { ...draft, city: ev.target.value },
                                }))
                              }
                              placeholder={locale.startsWith("ar") ? "المدينة" : "City"}
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              className="h-8 bg-slate-900/50 border-slate-700 text-xs"
                              value={draft.national_id || e.national_id || ""}
                              onChange={(ev) =>
                                setTransferDrafts((prev) => ({
                                  ...prev,
                                  [e.id]: { ...draft, national_id: ev.target.value },
                                }))
                              }
                              placeholder={locale.startsWith("ar") ? "رقم البطاقة" : "CIN"}
                            />
                          </td>
                          <td className="p-3 text-slate-400">{e.employee_id}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-cyan-500/20 border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/30 h-8 px-2"
                                onClick={() => {
                                  setTransferDrafts((prev) => {
                                    const { [e.id]: _, ...rest } = prev;
                                    return rest;
                                  });
                                }}
                              >
                                <RotateCcw className="size-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-emerald-500/20 border-emerald-500/30 text-emerald-100 hover:bg-emerald-500/30 h-8 px-2"
                                onClick={() => {
                                  const currentDraft = transferDrafts[e.id] || {};
                                  setTransferDrafts((prev) => ({
                                    ...prev,
                                    [e.id]: {
                                      rib: currentDraft.rib !== undefined ? currentDraft.rib : e.rib,
                                      netSalary: currentDraft.netSalary !== undefined ? currentDraft.netSalary : (latestPayroll?.netSalary || e.salary),
                                      bank_name: currentDraft.bank_name !== undefined ? currentDraft.bank_name : e.bank_name,
                                      city: currentDraft.city !== undefined ? currentDraft.city : e.city,
                                      national_id: currentDraft.national_id !== undefined ? currentDraft.national_id : e.national_id,
                                    },
                                  }));
                                  alert(locale.startsWith("ar") ? "تم حفظ البيانات بنجاح" : "Data saved successfully");
                                }}
                              >
                                <Check className="size-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={generateBankTransferCsv}
                  disabled={selectedForTransfer.size === 0}
                  className="bg-green-500/20 border-green-500/30 text-green-100 hover:bg-green-500/30"
                >
                  <FileSpreadsheet className="size-4 mr-2" />
                  CSV
                </Button>
                <Button
                  type="button"
                  onClick={generateBankTransferExcel}
                  disabled={selectedForTransfer.size === 0}
                  className="bg-emerald-500/20 border-emerald-500/30 text-emerald-100 hover:bg-emerald-500/30"
                >
                  <FileSpreadsheet className="size-4 mr-2" />
                  Excel
                </Button>
                <Button
                  type="button"
                  onClick={() => void generateBankTransferPdf()}
                  disabled={selectedForTransfer.size === 0}
                  className="bg-cyan-500/20 border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/30"
                >
                  <Download className="size-4 mr-2" />
                  PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedForTransfer(new Set());
                    setTransferDrafts({});
                    setBankTransferSearchQuery("");
                  }}
                >
                  {locale.startsWith("ar") ? "إلغاء التحديد" : "Clear Selection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Archive Tab */}
        <TabsContent value="archive" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookMarked className="size-5 text-purple-400" />
                {locale.startsWith("ar") ? "أرشيف شهادات الأجر" : "Payroll Archive"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-sm">
                <p className="text-purple-200">
                  {locale.startsWith("ar")
                    ? "💡 يتم حفظ جميع شهادات الأجر هنا مع إمكانية المعاينة والتعديل والحذف والتصدير."
                    : "💡 All payroll certificates are saved here with preview, edit, delete, and export capabilities."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-blue-500/20 border-blue-500/30 text-blue-100 hover:bg-blue-500/30"
                  onClick={(e) => {
                    e.preventDefault();
                    exportArchivesToCsv();
                  }}
                >
                  <FileSpreadsheet className="size-4 mr-2" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-500/20 border-green-500/30 text-green-100 hover:bg-green-500/30"
                  onClick={exportArchivesToExcel}
                >
                  <FileSpreadsheet className="size-4 mr-2" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-red-500/20 border-red-500/30 text-red-100 hover:bg-red-500/30"
                  onClick={exportArchivesToPdf}
                >
                  <FileText className="size-4 mr-2" />
                  PDF
                </Button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    onChange={importArchivesFromFile}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-orange-500/20 border-orange-500/30 text-orange-100 hover:bg-orange-500/30"
                  >
                    <Upload className="size-4 mr-2" />
                    {locale.startsWith("ar") ? "استيراد" : "Import"}
                  </Button>
                </div>
                {selectedArchives.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-purple-500/20 border-purple-500/30 text-purple-100 hover:bg-purple-500/30"
                      onClick={bulkExportArchives}
                    >
                      <Download className="size-4 mr-2" />
                      {locale.startsWith("ar") ? "تصدير جماعي" : "Bulk Export"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/30"
                      onClick={bulkDeleteArchives}
                    >
                      <Trash2 className="size-4 mr-2" />
                      {locale.startsWith("ar") ? "حذف جماعي" : "Bulk Delete"}
                    </Button>
                  </>
                )}
              </div>

              {payrollArchives.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <BookMarked className="size-12 mx-auto mb-3 opacity-50" />
                  <p>{locale.startsWith("ar") ? "لا توجد شهادات أجر محفوظة" : "No saved payroll certificates"}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/80">
                      <tr>
                        <th className="p-2 text-center w-10">
                          <input
                            type="checkbox"
                            checked={selectedArchives.size === payrollArchives.length && payrollArchives.length > 0}
                            onChange={toggleSelectAll}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "الموظف" : "Employee"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "الفترة" : "Period"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "صافي الراتب" : "Net Salary"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "التاريخ" : "Date"}</th>
                        <th className="p-2 text-right">{locale.startsWith("ar") ? "الإجراءات" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollArchives.map((archive) => (
                        <tr key={archive.id} className="border-t border-slate-800">
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedArchives.has(archive.id)}
                              onChange={() => toggleArchiveSelection(archive.id)}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="p-2">{archive.employeeName}</td>
                          <td className="p-2">{archive.period}</td>
                          <td className="p-2">{archive.netSalary.toFixed(2)} MAD</td>
                          <td className="p-2">{new Date(archive.date).toLocaleDateString()}</td>
                          <td className="p-2">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-cyan-500/20 border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/30"
                                onClick={() => {
                                  setPreviewData(archive);
                                  setShowPreviewModal(true);
                                }}
                              >
                                {locale.startsWith("ar") ? "معاينة" : "Preview"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-amber-500/20 border-amber-500/30 text-amber-100 hover:bg-amber-500/30"
                                onClick={() => {
                                  setEditingArchive(archive);
                                  setShowEditModal(true);
                                }}
                              >
                                {locale.startsWith("ar") ? "تعديل" : "Edit"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-emerald-500/20 border-emerald-500/30 text-emerald-100 hover:bg-emerald-500/30"
                                onClick={() => {
                                  const data = archive.data;
                                  void exportPdf(
                                    buildPayrollSlipHtml({
                                      branding,
                                      employeeName: String(data.employeeName || "—"),
                                      employeeId: String(data.employeeId || "—"),
                                      workNumber: data.workNumber ? String(data.workNumber) : undefined,
                                      nationalId: data.nationalId ? String(data.nationalId) : undefined,
                                      maritalStatus: data.maritalStatus ? String(data.maritalStatus) : undefined,
                                      workDays: data.workDays ? String(data.workDays) : undefined,
                                      hireDate: data.hireDate ? String(data.hireDate) : undefined,
                                      city: data.city ? String(data.city) : undefined,
                                      address: data.address ? String(data.address) : undefined,
                                      period: String(data.period || "—"),
                                      baseSalary: Number(data.baseSalary) || 0,
                                      paidLeave: Number(data.paidLeave) || 0,
                                      overtime125: Number(data.overtime125) || 0,
                                      overtime150: Number(data.overtime150) || 0,
                                      overtime200: Number(data.overtime200) || 0,
                                      seniorityBonus: Number(data.seniorityBonus) || 0,
                                      attendanceBonus: Number(data.attendanceBonus) || 0,
                                      productivityBonus: Number(data.productivityBonus) || 0,
                                      cnss: Number(data.cnss) || 0,
                                      amo: Number(data.amo) || 0,
                                      ipe: Number(data.ipe) || 0,
                                      mutual: Number(data.mutual) || 0,
                                      advanceSalary: Number(data.advanceSalary) || 0,
                                      totalBrut: Number(data.totalBrut) || 0,
                                      totalCotisations: Number(data.totalCotisations) || 0,
                                      netSalary: Number(data.netSalary) || 0,
                                      dir,
                                      locale: appLocale,
                                    }),
                                    "fiche-de-paie"
                                  );
                                }}
                              >
                                <Download className="size-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/30"
                                onClick={() => {
                                  setPayrollArchives((prev) => prev.filter((a) => a.id !== archive.id));
                                  // Also remove from localStorage - isolated per user
                                  try {
                                    const userKey = user?.id ? `payrollArchives_${user.id}` : "payrollArchives";
                                    const existingArchives = JSON.parse(localStorage.getItem(userKey) || "[]");
                                    const updatedArchives = existingArchives.filter((a: any) => a.id !== archive.id);
                                    localStorage.setItem(userKey, JSON.stringify(updatedArchives));
                                  } catch (e) {
                                    console.error("Failed to delete from localStorage:", e);
                                  }
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {locale.startsWith("ar") ? "معاينة شهادة الأجر" : "Payroll Certificate Preview"}
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-emerald-500/20 border-emerald-500/30 text-emerald-100 hover:bg-emerald-500/30"
                  onClick={() => {
                    const data = previewData.data;
                    void exportPdf(
                      buildPayrollSlipHtml({
                        branding,
                        employeeName: String(data.employeeName || "—"),
                        employeeId: String(data.employeeId || "—"),
                        workNumber: data.workNumber ? String(data.workNumber) : undefined,
                        nationalId: data.nationalId ? String(data.nationalId) : undefined,
                        maritalStatus: data.maritalStatus ? String(data.maritalStatus) : undefined,
                        workDays: data.workDays ? String(data.workDays) : undefined,
                        hireDate: data.hireDate ? String(data.hireDate) : undefined,
                        city: data.city ? String(data.city) : undefined,
                        address: data.address ? String(data.address) : undefined,
                        period: String(data.period || "—"),
                        baseSalary: Number(data.baseSalary) || 0,
                        paidLeave: Number(data.paidLeave) || 0,
                        overtime125: Number(data.overtime125) || 0,
                        overtime150: Number(data.overtime150) || 0,
                        overtime200: Number(data.overtime200) || 0,
                        seniorityBonus: Number(data.seniorityBonus) || 0,
                        attendanceBonus: Number(data.attendanceBonus) || 0,
                        productivityBonus: Number(data.productivityBonus) || 0,
                        cnss: Number(data.cnss) || 0,
                        amo: Number(data.amo) || 0,
                        ipe: Number(data.ipe) || 0,
                        mutual: Number(data.mutual) || 0,
                        advanceSalary: Number(data.advanceSalary) || 0,
                        totalBrut: Number(data.totalBrut) || 0,
                        totalCotisations: Number(data.totalCotisations) || 0,
                        netSalary: Number(data.netSalary) || 0,
                        dir,
                        locale: appLocale,
                      }),
                      "fiche-de-paie"
                    );
                  }}
                >
                  <Download className="size-4 mr-2" />
                  {locale.startsWith("ar") ? "تحميل PDF" : "Download PDF"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewData(null);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">{locale.startsWith("ar") ? "الموظف:" : "Employee:"}</span>
                  <span className="ml-2 font-medium text-white">{previewData.employeeName}</span>
                </div>
                <div>
                  <span className="text-slate-400">{locale.startsWith("ar") ? "الفترة:" : "Period:"}</span>
                  <span className="ml-2 font-medium text-white">{previewData.period}</span>
                </div>
                <div>
                  <span className="text-slate-400">{locale.startsWith("ar") ? "صافي الراتب:" : "Net Salary:"}</span>
                  <span className="ml-2 font-medium text-emerald-400">{previewData.netSalary.toFixed(2)} MAD</span>
                </div>
                <div>
                  <span className="text-slate-400">{locale.startsWith("ar") ? "التاريخ:" : "Date:"}</span>
                  <span className="ml-2 font-medium text-white">{new Date(previewData.date).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="p-2 text-right">{locale.startsWith("ar") ? "الوصف" : "Description"}</th>
                      <th className="p-2 text-right">{locale.startsWith("ar") ? "المبلغ (درهم)" : "Amount (MAD)"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-800">
                      <td className="p-2">{locale.startsWith("ar") ? "الراتب الأساسي" : "Base Salary"}</td>
                      <td className="p-2 text-right">{previewData.data.baseSalary?.toFixed(2) || "0.00"}</td>
                    </tr>
                    <tr className="border-t border-slate-800">
                      <td className="p-2">{locale.startsWith("ar") ? "منحة الأقدمية" : "Seniority Bonus"}</td>
                      <td className="p-2 text-right">{previewData.data.seniorityBonus?.toFixed(2) || "0.00"}</td>
                    </tr>
                    <tr className="border-t border-slate-800">
                      <td className="p-2">{locale.startsWith("ar") ? "إجمالي الإيرادات" : "Total Earnings"}</td>
                      <td className="p-2 text-right font-bold text-emerald-400">{previewData.data.totalBrut?.toFixed(2) || "0.00"}</td>
                    </tr>
                    <tr className="border-t border-slate-800">
                      <td className="p-2">{locale.startsWith("ar") ? "الاقتطاعات" : "Deductions"}</td>
                      <td className="p-2 text-right font-bold text-amber-400">{previewData.data.totalCotisations?.toFixed(2) || "0.00"}</td>
                    </tr>
                    <tr className="border-t border-slate-800 bg-cyan-500/10">
                      <td className="p-2 font-bold text-cyan-400">{locale.startsWith("ar") ? "الراتب الصافي" : "Net Salary"}</td>
                      <td className="p-2 text-right font-bold text-cyan-400">{previewData.data.netSalary?.toFixed(2) || "0.00"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingArchive && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {locale.startsWith("ar") ? "تعديل شهادة الأجر" : "Edit Payroll Certificate"}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingArchive(null);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">{locale.startsWith("ar") ? "الموظف" : "Employee"}</Label>
                  <Input
                    className="mt-1 bg-slate-900/50 border-slate-700"
                    value={editingArchive.employeeName}
                    onChange={(e) => setEditingArchive({ ...editingArchive, employeeName: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm">{locale.startsWith("ar") ? "الفترة" : "Period"}</Label>
                  <Input
                    className="mt-1 bg-slate-900/50 border-slate-700"
                    value={editingArchive.period}
                    onChange={(e) => setEditingArchive({ ...editingArchive, period: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
                <h4 className="text-sm font-semibold text-purple-200 mb-3">
                  {locale.startsWith("ar") ? "حساب الأجر الأساسي" : "Base Salary Calculation"}
                </h4>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "ثمن الساعة" : "Hourly Rate"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.hourlyRate || ""}
                      onChange={(e) => {
                        const hourlyRate = Number(e.target.value) || 0;
                        setEditingArchive({ 
                          ...editingArchive, 
                          data: { ...editingArchive.data, hourlyRate }
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "ساعات يومية" : "Daily Hours"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.dailyHours || ""}
                      onChange={(e) => {
                        const dailyHours = Number(e.target.value) || 0;
                        setEditingArchive({ 
                          ...editingArchive, 
                          data: { ...editingArchive.data, dailyHours }
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "أيام العمل" : "Work Days"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.workDays || ""}
                      onChange={(e) => {
                        const workDays = Number(e.target.value) || 0;
                        setEditingArchive({ 
                          ...editingArchive, 
                          data: { ...editingArchive.data, workDays }
                        });
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">{locale.startsWith("ar") ? "الراتب الأساسي" : "Base Salary"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1 bg-slate-900/50 border-slate-700"
                    value={editingArchive.data.baseSalary || ""}
                    onChange={(e) => setEditingArchive({ 
                      ...editingArchive, 
                      data: { ...editingArchive.data, baseSalary: Number(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div>
                  <Label className="text-sm">{locale.startsWith("ar") ? "منحة الأقدمية" : "Seniority Bonus"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1 bg-slate-900/50 border-slate-700"
                    value={editingArchive.data.seniorityBonus || ""}
                    onChange={(e) => setEditingArchive({ 
                      ...editingArchive, 
                      data: { ...editingArchive.data, seniorityBonus: Number(e.target.value) || 0 }
                    })}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <h4 className="text-sm font-semibold text-amber-200 mb-3">
                  {locale.startsWith("ar") ? "الساعات الإضافية" : "Overtime Hours"}
                </h4>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "125%" : "125%"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.overtime125 || ""}
                      onChange={(e) => setEditingArchive({ 
                        ...editingArchive, 
                        data: { ...editingArchive.data, overtime125: Number(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "150%" : "150%"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.overtime150 || ""}
                      onChange={(e) => setEditingArchive({ 
                        ...editingArchive, 
                        data: { ...editingArchive.data, overtime150: Number(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "200%" : "200%"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.overtime200 || ""}
                      onChange={(e) => setEditingArchive({ 
                        ...editingArchive, 
                        data: { ...editingArchive.data, overtime200: Number(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">{locale.startsWith("ar") ? "منحة الحضور" : "Attendance Bonus"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1 bg-slate-900/50 border-slate-700"
                    value={editingArchive.data.attendanceBonus || ""}
                    onChange={(e) => setEditingArchive({ 
                      ...editingArchive, 
                      data: { ...editingArchive.data, attendanceBonus: Number(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div>
                  <Label className="text-sm">{locale.startsWith("ar") ? "منحة الإنتاجية" : "Productivity Bonus"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1 bg-slate-900/50 border-slate-700"
                    value={editingArchive.data.productivityBonus || ""}
                    onChange={(e) => setEditingArchive({ 
                      ...editingArchive, 
                      data: { ...editingArchive.data, productivityBonus: Number(e.target.value) || 0 }
                    })}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <h4 className="text-sm font-semibold text-red-200 mb-3">
                  {locale.startsWith("ar") ? "الاقتطاعات" : "Deductions"}
                </h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">CNSS</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.cnss || ""}
                      onChange={(e) => setEditingArchive({ 
                        ...editingArchive, 
                        data: { ...editingArchive.data, cnss: Number(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">AMO</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.amo || ""}
                      onChange={(e) => setEditingArchive({ 
                        ...editingArchive, 
                        data: { ...editingArchive.data, amo: Number(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">IPE</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.ipe || ""}
                      onChange={(e) => setEditingArchive({ 
                        ...editingArchive, 
                        data: { ...editingArchive.data, ipe: Number(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "متبادل" : "Mutual"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.mutual || ""}
                      onChange={(e) => setEditingArchive({ 
                        ...editingArchive, 
                        data: { ...editingArchive.data, mutual: Number(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "سلفة" : "Advance Salary"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 bg-slate-900/50 border-slate-700"
                      value={editingArchive.data.advanceSalary || ""}
                      onChange={(e) => setEditingArchive({ 
                        ...editingArchive, 
                        data: { ...editingArchive.data, advanceSalary: Number(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "إجمالي الأجر" : "Gross Salary"}</Label>
                    <div className="mt-1 p-2 bg-slate-900/50 border border-slate-700 rounded text-cyan-400 font-semibold">
                      {editingArchive.data.totalBrut?.toFixed(2) || "0.00"} MAD
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">{locale.startsWith("ar") ? "إجمالي الاقتطاعات" : "Total Deductions"}</Label>
                    <div className="mt-1 p-2 bg-slate-900/50 border border-slate-700 rounded text-amber-400 font-semibold">
                      {editingArchive.data.totalCotisations?.toFixed(2) || "0.00"} MAD
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm">{locale.startsWith("ar") ? "صافي الأجر" : "Net Salary"}</Label>
                    <div className="mt-1 p-2 bg-slate-900/50 border border-slate-700 rounded text-emerald-400 font-semibold text-lg">
                      {editingArchive.data.netSalary?.toFixed(2) || "0.00"} MAD
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-emerald-400 text-emerald-950 shadow-[0_0_18px_rgba(52,211,153,0.45)] hover:bg-emerald-300"
                  onClick={() => updateArchive(editingArchive)}
                >
                  {locale.startsWith("ar") ? "حفظ التغييرات" : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingArchive(null);
                  }}
                >
                  {locale.startsWith("ar") ? "إلغاء" : "Cancel"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        {...(type === "date" || type === "time" || type === "datetime-local"
          ? { lang: "en", dir: "ltr" }
          : {})}
      />
    </div>
  );
}

export default HrEnterpriseSuite;
