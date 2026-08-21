export type HrEmployeeRecord = {
  id: string;
  name: string;
  employee_id: string;
  work_number: string;
  national_id: string;
  role: string;
  salary: number;
  work_days: number;
  contract_type: string;
  contract_end: string | null;
  start_date: string;
  birth_date: string;
  marital_status: string;
  uniform_color: string;
  city: string;
  address: string;
  rib: string;
  bank_name: string;
  // حقول الأجور المتقدمة
  hourly_rate: number;
  daily_hours: number;
  currency: string;
  overtime_125_hours: number;
  overtime_150_hours: number;
  overtime_200_hours: number;
  attendance_bonus: number;
  productivity_bonus: number;
  deductions: number;
  deductions_percentage: number;
  gross_salary: number;
  net_salary: number;
};

export type HrEmployeeDraft = Omit<HrEmployeeRecord, "id">;

export type HrEnterprisePrefill = {
  absenceEmployee: {
    employeeName: string;
    employeeId: string;
  };
  contract: {
    employeeName: string;
    workNumber: string;
    nationalId: string;
    maritalStatus: string;
    jobTitle: string;
    salaryGross: string;
    workPlace: string;
  };
  workCertificate: {
    employeeName: string;
    employeeId: string;
    workNumber: string;
    nationalId: string;
    maritalStatus: string;
    role: string;
    hireDate: string;
    city: string;
    address: string;
    workDays: string;
  };
  payroll: {
    employeeName: string;
    employeeId: string;
    workNumber: string;
    nationalId: string;
    maritalStatus: string;
    workDays: string;
    hireDate: string;
    gross: string;
    city: string;
    address: string;
  };
};
