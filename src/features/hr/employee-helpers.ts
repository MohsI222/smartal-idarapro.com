import type { HrEmployeeDraft, HrEmployeeRecord, HrEnterprisePrefill } from "./types";

function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function normalizeText(value: string): string {
  return normalizeDigits(String(value || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeDate(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  return raw;
}

function normalizeAmount(value: unknown): number {
  const raw = String(value ?? "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  return Number(raw) || 0;
}

export function createEmptyHrEmployeeDraft(): HrEmployeeDraft {
  return {
    name: "",
    employee_id: "",
    work_number: "",
    national_id: "",
    role: "",
    salary: 0,
    work_days: 0,
    contract_type: "CDI",
    contract_end: null,
    start_date: "",
    birth_date: "",
    marital_status: "",
    uniform_color: "",
    city: "",
    address: "",
    rib: "",
    bank_name: "",
    // حقول الأجور المتقدمة
    hourly_rate: 0,
    daily_hours: 8,
    currency: "MAD",
    overtime_125_hours: 0,
    overtime_150_hours: 0,
    overtime_200_hours: 0,
    attendance_bonus: 0,
    productivity_bonus: 0,
    deductions: 0,
    deductions_percentage: 0,
    gross_salary: 0,
    net_salary: 0,
  };
}

function pickHeaderKey(header: unknown): keyof HrEmployeeDraft | null {
  const key = normalizeText(String(header || ""));
  if (!key) return null;
  if (/(^| )full ?name|^name$|^nom$|الاسم/.test(key)) return "name";
  if (/employee.?id|matricule|numero de travail|num de travail|رقم العمل/.test(key)) return "employee_id";
  if (/work.?number|numero de travail|رقم العمل/.test(key)) return "work_number";
  if (/national.?id|cin|carte nationale|البطاقة الوطنية/.test(key)) return "national_id";
  if (/^role$|fonction|job|poste|الدور|المنصب/.test(key)) return "role";
  if (/salary|salaire|الراتب/.test(key)) return "salary";
  if (/work.?days|jours? de travail|jours travailles|ايام العمل|أيام العمل/.test(key)) return "work_days";
  if (/contract.?type|type de contrat|نوع العقد/.test(key)) return "contract_type";
  if (/contract.?end|fin de contrat|نهاية العقد/.test(key)) return "contract_end";
  if (/start.?date|hire.?date|date d.?embauche|تاريخ البداية|تاريخ التوظيف/.test(key)) return "start_date";
  if (/birth|naissance|ازدياد/.test(key)) return "birth_date";
  if (/marital|familiale|situation|الحالة العائلية/.test(key)) return "marital_status";
  if (/uniform|couleur|بدلة|color/.test(key)) return "uniform_color";
  if (/^city$|ville|المدينة/.test(key)) return "city";
  if (/^address$|adresse|العنوان/.test(key)) return "address";
  if (/rib|banque|رقم الحساب|رقم الحساب البنكي/.test(key)) return "rib";
  if (/bank.?name|nom de la banque|اسم البنك/.test(key)) return "bank_name";
  return null;
}

function assignDraftValue(
  draft: HrEmployeeDraft,
  field: keyof HrEmployeeDraft,
  value: unknown
): void {
  const numericFields: (keyof HrEmployeeDraft)[] = [
    "salary", "work_days",
    "hourly_rate", "daily_hours",
    "overtime_125_hours", "overtime_150_hours", "overtime_200_hours",
    "attendance_bonus", "productivity_bonus",
    "deductions", "deductions_percentage",
    "gross_salary", "net_salary"
  ];
  
  if (numericFields.includes(field)) {
    (draft as any)[field] = normalizeAmount(value);
    return;
  }
  if (field === "contract_end") {
    draft.contract_end = normalizeDate(value) || null;
    return;
  }
  if (field === "start_date" || field === "birth_date") {
    (draft as any)[field] = normalizeDate(value);
    return;
  }
  (draft as any)[field] = String(value ?? "").trim();
}

function finalizeDraft(draft: HrEmployeeDraft): HrEmployeeDraft {
  const employeeId = draft.employee_id || draft.work_number;
  const workNumber = draft.work_number || draft.employee_id;
  return {
    ...createEmptyHrEmployeeDraft(),
    ...draft,
    employee_id: employeeId,
    work_number: workNumber,
    contract_type: draft.contract_type || "CDI",
    contract_end: draft.contract_end || null,
  };
}

export function filterHrEmployees(rows: HrEmployeeRecord[], query: string): HrEmployeeRecord[] {
  const needle = normalizeText(query);
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.name, row.employee_id, row.work_number, row.role, row.city, row.address]
      .map(normalizeText)
      .some((value) => value.includes(needle))
  );
}

export function parseHrImportRows(rows: unknown[][]): HrEmployeeDraft[] {
  if (!rows.length) return [];
  const [headerRow, ...bodyRows] = rows;
  const headerMap = headerRow.map((cell) => pickHeaderKey(cell));
  return bodyRows
    .map((row) => {
      const draft = createEmptyHrEmployeeDraft();
      headerMap.forEach((field, index) => {
        if (!field) return;
        assignDraftValue(draft, field, row[index]);
      });
      return finalizeDraft(draft);
    })
    .filter((row) => row.name.trim().length > 0);
}

export function parseHrDocumentText(text: string): HrEmployeeDraft {
  const draft = createEmptyHrEmployeeDraft();
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(/[:：]/);
    if (parts.length < 2) continue;
    const field = pickHeaderKey(parts[0]);
    if (!field) continue;
    assignDraftValue(draft, field, parts.slice(1).join(":").trim());
  }
  return finalizeDraft(draft);
}

export function buildEnterpriseEmployeePrefill(employee: HrEmployeeRecord): HrEnterprisePrefill {
  return {
    absenceEmployee: {
      employeeName: employee.name,
      employeeId: employee.employee_id,
    },
    contract: {
      employeeName: employee.name,
      workNumber: employee.work_number,
      nationalId: employee.national_id,
      maritalStatus: employee.marital_status,
      jobTitle: employee.role,
      salaryGross: String(employee.salary),
      workPlace: employee.city,
    },
    workCertificate: {
      employeeName: employee.name,
      employeeId: employee.employee_id,
      workNumber: employee.work_number,
      nationalId: employee.national_id,
      maritalStatus: employee.marital_status,
      role: employee.role,
      hireDate: employee.start_date,
      city: employee.city,
      address: employee.address,
      workDays: String(employee.work_days),
    },
    payroll: {
      employeeName: employee.name,
      employeeId: employee.employee_id,
      workNumber: employee.work_number,
      nationalId: employee.national_id,
      maritalStatus: employee.marital_status,
      workDays: String(employee.work_days),
      hireDate: employee.start_date,
      gross: String(employee.salary),
      city: employee.city,
      address: employee.address,
    },
  };
}

export function calculateSalary(employee: HrEmployeeDraft): HrEmployeeDraft {
  const {
    hourly_rate,
    daily_hours,
    work_days,
    overtime_125_hours,
    overtime_150_hours,
    overtime_200_hours,
    attendance_bonus,
    productivity_bonus,
    deductions,
    deductions_percentage,
  } = employee;

  // حساب الأجر الأساسي: ثمن الساعة × عدد الساعات اليومية × عدد أيام العمل
  const baseSalary = hourly_rate * daily_hours * work_days;

  // حساب الساعات الإضافية
  const overtime125 = hourly_rate * 1.25 * overtime_125_hours;
  const overtime150 = hourly_rate * 1.50 * overtime_150_hours;
  const overtime200 = hourly_rate * 2.00 * overtime_200_hours;

  // حساب الأجر الإجمالي
  const grossSalary = baseSalary + overtime125 + overtime150 + overtime200 + attendance_bonus + productivity_bonus;

  // حساب الاقتطاعات
  const deductionAmount = deductions + (grossSalary * deductions_percentage / 100);

  // حساب صافي الداء
  const netSalary = grossSalary - deductionAmount;

  return {
    ...employee,
    gross_salary: Math.round(grossSalary * 100) / 100,
    net_salary: Math.round(netSalary * 100) / 100,
  };
}
