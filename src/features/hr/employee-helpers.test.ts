import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEnterpriseEmployeePrefill,
  filterHrEmployees,
  parseHrDocumentText,
  parseHrImportRows,
} from "./employee-helpers";
import type { HrEmployeeRecord } from "./types";

const employee: HrEmployeeRecord = {
  id: "e1",
  name: "Omar Alaoui",
  employee_id: "EMP-001",
  work_number: "١٢٣٤",
  national_id: "AB123456",
  role: "Responsable RH",
  salary: 6500,
  work_days: 26,
  contract_type: "CDI",
  contract_end: null,
  start_date: "2024-02-01",
  birth_date: "1993-06-15",
  marital_status: "Marié",
  uniform_color: "Bleu marine",
  city: "Casablanca",
  address: "Hay Hassani",
};

test("filterHrEmployees matches by name, work number and city with normalized digits", () => {
  const employees: HrEmployeeRecord[] = [
    employee,
    {
      ...employee,
      id: "e2",
      name: "Sara Bennani",
      employee_id: "EMP-002",
      work_number: "2002",
      city: "Rabat",
    },
  ];

  assert.deepEqual(filterHrEmployees(employees, "1234").map((row) => row.id), ["e1"]);
  assert.deepEqual(filterHrEmployees(employees, "casablanca").map((row) => row.id), ["e1"]);
  assert.deepEqual(filterHrEmployees(employees, "sara").map((row) => row.id), ["e2"]);
  assert.equal(filterHrEmployees(employees, "").length, 2);
});

test("parseHrImportRows maps multilingual spreadsheet headers into normalized employee drafts", () => {
  const rows = [
    [
      "Full Name",
      "Numéro de travail",
      "Start date",
      "Date de naissance",
      "Situation familiale",
      "Role",
      "Couleur uniforme",
      "City",
      "Address",
      "Salaire",
      "Jours de travail",
    ],
    [
      "Nadia Idrissi",
      "RH-77",
      "2024/03/10",
      "1996-01-03",
      "Célibataire",
      "Assistante RH",
      "Noir",
      "Agadir",
      "Quartier Salam",
      "5200,5",
      "24",
    ],
  ];

  assert.deepEqual(parseHrImportRows(rows), [
    {
      name: "Nadia Idrissi",
      employee_id: "RH-77",
      work_number: "RH-77",
      national_id: "",
      role: "Assistante RH",
      salary: 5200.5,
      work_days: 24,
      contract_type: "CDI",
      contract_end: null,
      start_date: "2024-03-10",
      birth_date: "1996-01-03",
      marital_status: "Célibataire",
      uniform_color: "Noir",
      city: "Agadir",
      address: "Quartier Salam",
    },
  ]);
});

test("parseHrDocumentText extracts employee data from key-value PDF text", () => {
  const text = `
Nom: Salma El Fassi
Numéro de travail: RH-104
CIN: CD998877
Fonction: Responsable paie
Date d'embauche: 2022-09-01
Date de naissance: 1991-04-12
Situation familiale: Mariée
Ville: Marrakech
Adresse: Gueliz
Salaire: 7300
Jours de travail: 25
  `.trim();

  assert.deepEqual(parseHrDocumentText(text), {
    name: "Salma El Fassi",
    employee_id: "RH-104",
    work_number: "RH-104",
    national_id: "CD998877",
    role: "Responsable paie",
    salary: 7300,
    work_days: 25,
    contract_type: "CDI",
    contract_end: null,
    start_date: "2022-09-01",
    birth_date: "1991-04-12",
    marital_status: "Mariée",
    uniform_color: "",
    city: "Marrakech",
    address: "Gueliz",
  });
});

test("buildEnterpriseEmployeePrefill reuses extended employee profile across HR documents", () => {
  assert.deepEqual(buildEnterpriseEmployeePrefill(employee), {
    absenceEmployee: {
      employeeName: "Omar Alaoui",
      employeeId: "EMP-001",
    },
    contract: {
      employeeName: "Omar Alaoui",
      workNumber: "١٢٣٤",
      nationalId: "AB123456",
      maritalStatus: "Marié",
      jobTitle: "Responsable RH",
      salaryGross: "6500",
      workPlace: "Casablanca",
    },
    workCertificate: {
      employeeName: "Omar Alaoui",
      employeeId: "EMP-001",
      workNumber: "١٢٣٤",
      nationalId: "AB123456",
      maritalStatus: "Marié",
      role: "Responsable RH",
      hireDate: "2024-02-01",
      city: "Casablanca",
      address: "Hay Hassani",
    },
    payroll: {
      employeeName: "Omar Alaoui",
      employeeId: "EMP-001",
      workNumber: "١٢٣٤",
      nationalId: "AB123456",
      maritalStatus: "Marié",
      workDays: "26",
      gross: "6500",
    },
  });
});
