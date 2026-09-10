# HR Team & Payroll Enrichment Design

**Date:** 2026-06-28

**Scope:** `HR / Team` and `Enterprise HR suite / Salary & social attestations` only.

**Goal:** Enrich employee data management and payroll certificate workflows without changing unrelated modules, while preserving current HR capabilities and all five supported UI languages.

---

## Context

The current HR implementation is split between:

- `src/pages/modules/HrModule.tsx`
  - team list
  - add employee form
  - employee row editing
  - HR exports
- `src/components/hr/HrEnterpriseSuite.tsx`
  - attendance
  - internal rules
  - employment contract
  - work certificate
  - salary/social attestation form

Current employee records are too limited for the requested workflows. The present employee shape only stores:

- `name`
- `employee_id`
- `role`
- `salary`
- `contract_type`
- `contract_end`

This is not enough to support:

- richer employee profiles
- search by work number
- import of multiple employees from Excel/PDF
- payroll form auto-fill from employee records
- accurate salary certificate rendering with all requested identity/work fields

The backend currently exposes:

- `GET /api/hr/employees`
- `POST /api/hr/employees`
- `PATCH /api/hr/employees/:id`

There is no visible delete route yet, and no import/search-focused workflow yet.

---

## Requested outcomes

The design must implement all of the following without dropping any current HR behavior:

### Team section

Add these employee fields:

- full name
- CIN / national ID
- employee ID
- work number
- employee start date
- birth date
- marital status
- role
- job title / center / category
- uniform color
- city
- full address
- salary
- contract type
- contract end

Add these capabilities:

- save new employee correctly
- edit employee correctly
- delete employee correctly
- search employee by name or work number
- show full employee result after search
- import multiple employees from Excel
- import multiple employees from PDF
- load imported employees into a review list before final save

### Salary & social attestation section

Add:

- search by employee name or employee number / work number
- click a search result to auto-fill the salary certificate
- import Excel/PDF into salary certificate form
- auto-fill salary certificate fields from imported file
- direct linkage to saved employee records and newly added employee fields

Required additional salary-certificate fields:

- employee start date
- work number
- birth date
- marital status
- role / title / category
- uniform color
- worked days in the month
- city
- full address

### Export layout constraint

This is a strict requirement:

- the salary certificate export must **not** render as 3 pages
- it must render as either:
  - a single page, or
  - front/back only (`recto/verso`, maximum 2 pages)

The export layout must remain readable and professional in supported languages, especially Arabic/French mixed content.

---

## Recommended approach

Recommended implementation style: **safe expansion inside current HR module with focused extraction helpers/components**.

This means:

- keep `HrModule.tsx` as the route entry point
- keep `HrEnterpriseSuite.tsx` as the enterprise HR document hub
- extract only the new employee profile, import/search, and payroll autofill logic into small HR-specific helpers/components

This approach is recommended because it:

- minimizes risk to the rest of the platform
- preserves current routing and existing HR tabs
- supports testable, isolated additions
- avoids a large architectural rewrite during a sensitive business-flow enhancement

---

## Architecture

### 1. Data model expansion

The employee model will be expanded in both frontend and backend to include:

- `national_id`
- `work_number`
- `start_date`
- `birth_date`
- `marital_status`
- `job_title`
- `category`
- `uniform_color`
- `city`
- `full_address`

The existing fields remain unchanged:

- `id`
- `name`
- `employee_id`
- `role`
- `salary`
- `contract_type`
- `contract_end`

#### Compatibility rule

All new fields must be nullable or default-safe in storage so existing employee rows continue to load without migration failures.

---

### 2. Backend changes

Files expected to change:

- `server/schema.sql`
- `server/index.ts`

Required backend work:

1. Extend `hr_employees` schema with new columns.
2. Update `GET /api/hr/employees` to return all new fields.
3. Update `POST /api/hr/employees` to accept and validate the new fields.
4. Update `PATCH /api/hr/employees/:id` to edit all new fields.
5. Add `DELETE /api/hr/employees/:id`.

#### Search handling

Search may stay client-side initially if the dataset remains moderate, but the API payload must return enough fields for search and payroll linking.

#### Import handling

The import parsing itself should remain frontend-driven for review-first UX. Final persistence must happen only after user confirmation.

---

## Frontend design

### 1. Team tab

The current compact add-employee card will become a structured form with grouped sections:

#### Identity

- full name
- CIN
- employee ID
- work number

#### Personal

- birth date
- marital status
- city
- full address

#### Work profile

- role
- job title
- category / center
- uniform color
- start date
- salary
- contract type
- contract end

#### Actions

- save employee
- clear/reset form
- import Excel
- import PDF
- search by name/work number

### Search UX

The Team tab will include:

- one search input
- one explicit search button
- search by:
  - employee name
  - work number

Results will appear in a focused result list/card. Selecting a result will:

- show all employee information
- allow edit
- allow delete
- allow loading the employee into the editable row/list area

### Import UX

#### Excel import

Expected behavior:

- upload one Excel file
- parse multiple employees
- map known columns using alias matching
- show a draft preview table
- allow final save after review

#### PDF import

Expected behavior:

- upload one PDF file that may contain several employees
- extract text
- split records using repeatable employee markers
- produce draft employee rows
- allow correction before final save

#### Safety rule

Imported employees must **not** be saved to the database automatically before review.

---

### 2. Employee list and editing

The existing editable employee table stays, but expands with the new fields.

The updated list must support:

- inline edit
- save row
- delete row
- view/search result selection

Because many columns will be added, the employee display should move toward one of these patterns:

- horizontally scrollable table with compact inputs, or
- condensed list rows with expandable detail panel

Recommended choice: **scrollable table + selected employee detail panel**.

Reason:

- preserves the current table behavior
- avoids a disruptive visual rewrite
- remains manageable for many fields

---

### 3. Salary & social attestation section

File expected to change:

- `src/components/hr/HrEnterpriseSuite.tsx`

The salary certificate form will be extended so it can be filled from:

- a selected saved employee
- a search result
- imported Excel data
- imported PDF data

#### New payroll-linked fields

Add to salary certificate form:

- employee name
- employee ID
- work number
- start date
- birth date
- marital status
- role
- job title
- category
- uniform color
- city
- full address
- days worked in month

#### Search UX inside salary certificate

Add:

- search input
- search button
- search results list

Supported lookup keys:

- employee name
- employee ID
- work number

Selecting a result auto-fills the payroll form using the employee record as source of truth.

#### Import UX inside salary certificate

Add:

- import Excel button
- import PDF button

Behavior:

- parse uploaded file
- map fields to salary certificate
- fill visible inputs immediately
- do not freeze or block the form if some optional fields are missing

When import data conflicts with a saved employee selection, the UI should prefer:

1. explicit imported values for payroll numeric fields
2. saved employee values for identity/profile fields unless the import clearly contains newer values

To avoid ambiguity in the first implementation, identity/profile fields should default to:

- selected employee data, if user selected an employee
- imported values, if no employee was selected

---

## Certificate layout design

The salary certificate export must be redesigned for layout discipline.

### Hard export rule

The salary/social certificate output must be:

- one page if content fits, or
- two pages maximum (`front/back`)

It must never spill to 3 pages.

### Practical rendering strategy

To achieve this safely:

1. Use a compact two-column identity/work grid.
2. Keep payroll numeric summary in a dense structured block.
3. Limit verbose explanatory paragraphs.
4. Move secondary notes to a short footer block.
5. If still too long, use a strict front/back layout:
   - page 1: identity + employment profile + key payroll fields
   - page 2: deductions + summary + signatures/notes

### Export priority

Recommended export policy:

- prefer one-page layout for common cases
- automatically fall back to two-page front/back layout when fields overflow
- never allow an uncontrolled third page

---

## Translation requirements

File expected to change:

- `src/i18n/strings.ts`

All newly added labels, errors, states, and import/search actions must be added for all supported languages already present in the platform.

This includes:

- field labels
- buttons
- search empty states
- import progress and validation messages
- delete confirmations
- payroll certificate section labels

No user-visible English-only fallback should remain for the new HR additions.

---

## Validation and safety

### Required validations

For employee save:

- name required
- employee ID required
- work number required
- salary must be numeric and non-negative if filled

For imports:

- ignore fully empty rows
- keep partially parsed rows as editable drafts
- deduplicate by `employee_id` and `work_number` where possible

For salary certificate:

- days worked in month must be numeric and bounded to a realistic range
- deductions and totals must stay non-negative

### Non-goals

This task must not:

- change auth flows
- change payment/subscription logic
- alter other business modules
- redesign unrelated HR tabs

---

## Testing and verification

Minimum verification set:

1. Add employee with all new fields.
2. Edit existing employee with all new fields.
3. Delete employee.
4. Search employee by name.
5. Search employee by work number.
6. Import multiple employees from Excel and review before save.
7. Import multiple employees from PDF and review before save.
8. Load employee into salary certificate from search.
9. Import salary data from Excel into certificate.
10. Import salary data from PDF into certificate.
11. Verify automatic payroll totals remain correct.
12. Export salary certificate and confirm output uses 1 page or front/back only.
13. Verify translations across supported languages.
14. Run typecheck and production build.
15. Verify in local browser without breaking unrelated HR functionality.

---

## Implementation boundaries

Expected touch points:

- `src/pages/modules/HrModule.tsx`
- `src/components/hr/HrEnterpriseSuite.tsx`
- new HR helper/types/components under `src/features/hr/` or equivalent focused paths
- `src/i18n/strings.ts`
- `server/schema.sql`
- `server/index.ts`

This work should preserve:

- current route path
- current HR tab structure
- current export capabilities

while extending the employee and payroll workflows requested above.
