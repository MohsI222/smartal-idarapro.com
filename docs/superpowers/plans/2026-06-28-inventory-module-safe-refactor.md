# Inventory Module Safe Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `InventoryPosModule.tsx` safely into smaller units without changing outward behavior, database behavior, auth behavior, or existing platform flows.

**Architecture:** Keep `src/pages/modules/InventoryPosModule.tsx` as the route entry point, then extract pure helpers, focused UI sections, and shared inventory-specific types into `src/features/inventory/*`. Preserve all existing API contracts, translations, and user-visible flows.

**Tech Stack:** React 19, TypeScript, Vite, existing UI components, current backend APIs, current i18n layer

---

### Task 1: Create inventory feature structure

**Files:**
- Create: `src/features/inventory/types.ts`
- Create: `src/features/inventory/constants.ts`
- Modify: `src/pages/modules/InventoryPosModule.tsx`

- [ ] **Step 1: Write the failing check**

Expected failure after import wiring attempt: TypeScript should complain if `Product`, `Invoice`, `RETAIL_TYPES`, `UNIT_KINDS`, or `QUICK_UNITS` are imported before the new files exist.

- [ ] **Step 2: Create shared types**

Move these definitions into `src/features/inventory/types.ts`:
- `Product`
- `Invoice`
- `DraftLine`
- `ProductionBomItem`
- `InventorySourceRow`
- `ProductWritePayload`
- response types used only by inventory module

- [ ] **Step 3: Create shared constants**

Move these definitions into `src/features/inventory/constants.ts`:
- `RETAIL_TYPES`
- `UNIT_KINDS`
- `INV_TABS`
- `QUICK_UNITS`
- `IMPORT_FALLBACK_INDEX`
- `IMPORT_HEADER_ALIASES`

- [ ] **Step 4: Rewire imports**

Update `src/pages/modules/InventoryPosModule.tsx` to import the moved types/constants and remove local duplicates.

- [ ] **Step 5: Verify behavior remains unchanged**

Check that no API call names, translation keys, or route wiring changed.


### Task 2: Extract pure import and parsing helpers

**Files:**
- Create: `src/features/inventory/import-helpers.ts`
- Modify: `src/pages/modules/InventoryPosModule.tsx`

- [ ] **Step 1: Write the failing check**

Expected failure after import wiring attempt: TypeScript should complain if these helper functions are imported before the helper file exists.

- [ ] **Step 2: Move pure helper functions**

Extract these pure functions:
- `piecesPerQuickUnit`
- `textCell`
- `normalizeHeader`
- `findHeaderIndex`
- `parseNumberCell`
- `parseIntCell`
- `parseDateCell`
- `normalizeRetailType`
- `normalizeUnitKind`
- `normalizeLookupText`
- `inventoryRowFromSupabase`
- `inventoryRowFromProduct`
- `parseInventoryImportRows`

- [ ] **Step 3: Keep signatures stable**

Do not change parameter names or return shapes unless required by extraction. Preserve current behavior.

- [ ] **Step 4: Rewire module imports**

Replace local definitions in `InventoryPosModule.tsx` with imports from `src/features/inventory/import-helpers.ts`.

- [ ] **Step 5: Verify critical flows**

Manually review that import, OCR fallback parsing, search normalization, and stock row mapping still use the same values and defaults.


### Task 3: Extract export builders

**Files:**
- Create: `src/features/inventory/export-helpers.ts`
- Modify: `src/pages/modules/InventoryPosModule.tsx`

- [ ] **Step 1: Write the failing check**

Expected failure after import wiring attempt: TypeScript should complain if export helper imports are unresolved.

- [ ] **Step 2: Extract export preparation logic**

Move row/header preparation logic for:
- stock PDF/Word/Excel
- invoices PDF/Word/Excel

Keep the actual side-effecting export calls in the module if needed, but extract the table/header/row builders first.

- [ ] **Step 3: Preserve naming and output**

Keep the same file naming patterns:
- `inventory-${Date.now()}`
- `inventory-stock-${Date.now()}`
- `invoices-${Date.now()}`

- [ ] **Step 4: Rewire calls**

Update the module to call the extracted builders while preserving `runExport(...)`.

- [ ] **Step 5: Verify no functional drift**

Confirm the same translation keys, same column order, and same document metadata are still used.


### Task 4: Extract dashboard UI sections

**Files:**
- Create: `src/features/inventory/components/InventoryDashboardSection.tsx`
- Create: `src/features/inventory/components/InventoryProductionSection.tsx`
- Modify: `src/pages/modules/InventoryPosModule.tsx`

- [ ] **Step 1: Write the failing check**

Expected failure after import wiring attempt: module imports for the new dashboard section components should be unresolved before files are created.

- [ ] **Step 2: Extract inventory dashboard section**

Move the UI for:
- activity selector and save button
- export/import controls
- add product card
- stock table
- add stock card

- [ ] **Step 3: Extract production and messaging section**

Move the UI for:
- production inventory search/BOM area
- production requests and logistics queue
- internal messaging panel

- [ ] **Step 4: Pass explicit props only**

Do not move shared app state into a new global store. Keep data flow explicit through props and callbacks.

- [ ] **Step 5: Verify safety boundaries**

Ensure nothing in the extracted components touches auth, admin, or database code directly outside the existing calls already used by the module.


### Task 5: Extract POS UI section

**Files:**
- Create: `src/features/inventory/components/InventoryPosSection.tsx`
- Modify: `src/pages/modules/InventoryPosModule.tsx`

- [ ] **Step 1: Write the failing check**

Expected failure after import wiring attempt: unresolved component import before the file exists.

- [ ] **Step 2: Move POS UI**

Extract the full `TabsContent value="pos"` UI into `InventoryPosSection.tsx`, including:
- barcode area
- AI/OCR action area
- quick list
- current unit preview
- draft list
- totals/editor controls

- [ ] **Step 3: Preserve keyboard and scanner behavior**

Keep keyboard navigation, quick selection logic, barcode callbacks, and OCR callbacks connected exactly as before.

- [ ] **Step 4: Keep dialogs wired**

Any calculator, stock prompt, or supporting dialog must remain connected through props/state from the main module.

- [ ] **Step 5: Verify no visible change**

Review the extracted JSX for identical translation keys, classes, and handlers.


### Task 6: Reduce module to orchestrator

**Files:**
- Modify: `src/pages/modules/InventoryPosModule.tsx`

- [ ] **Step 1: Remove duplicated inline helpers**

Delete any local helpers that were already extracted.

- [ ] **Step 2: Keep orchestration only**

The module should retain:
- route-level auth/module guard
- local state ownership
- async action handlers
- composition of dashboard/POS/barcode/credit sections

- [ ] **Step 3: Preserve current tabs and flow**

Do not change:
- `invTab`
- search param handling
- loading guard
- locked-state guard

- [ ] **Step 4: Review imports**

Remove unused imports and ensure no circular dependency is introduced.

- [ ] **Step 5: Final verification**

Confirm the module still exports `InventoryPosModule` from the same path and remains the same route target.


### Task 7: Safe verification pass

**Files:**
- Review only: `src/pages/modules/InventoryPosModule.tsx`
- Review only: `src/features/inventory/**/*.ts`
- Review only: `src/features/inventory/components/**/*.tsx`

- [ ] **Step 1: Check protected boundaries**

Verify no changes were made to:
- auth flows
- admin flows
- registration/login pages
- server database files

- [ ] **Step 2: Check critical platform flows by code review**

Verify the refactor did not alter contracts for:
- inventory import
- inventory export
- stock add
- POS sale batch
- barcode resolution
- OCR item application
- production request creation
- message sending and attachment download

- [ ] **Step 3: Check for accidental behavior change**

Review defaults, fallback values, and translation keys for accidental drift.

- [ ] **Step 4: Commit**

Use a conservative commit message after review, for example:

```bash
git add src/pages/modules/InventoryPosModule.tsx src/features/inventory
git commit -m "refactor: split inventory module safely"
```

- [ ] **Step 5: Prepare user handoff**

Summarize:
- which files changed
- what was structurally improved
- what remained intentionally untouched
