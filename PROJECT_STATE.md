# Project State - Business Management Platform (Energy Solutions)

**Company:** Shanvi Enterprises · **Vertical:** ENERGY_SOLUTIONS
**Last updated:** Phase 13 completion
**Status:** **ENERGY MVP v1.0 - FEATURE COMPLETE / FROZEN / READY FOR CONTROLLED SHANVI UAT**

## Version Control

- **Version:** Energy MVP v1.0
- **Git initialized:** Phase 13 (this working copy had no version-control history before)
- **Baseline commit:** `395521d6fcd9c28772385e997dd0c9c64568c841` ("Energy MVP v1.0 - UAT baseline")
- **Baseline tag:** `v1.0.0` (annotated - "Energy Solutions MVP v1.0 - Ready for Shanvi UAT")
- **Branch:** `main`
- **Remote:** none configured - this is a local-only repository; no push, no GitHub repo, no CI/CD was set up (out of scope for this phase)
- **Deployment:** **not deployed anywhere.** This baseline exists locally only.

`v1.0.0` is the frozen UAT baseline - see the Freeze Rule in `MVP_BASELINE.md`. Bug fixes found during UAT get their own commits (and, once several accumulate or a fix is significant, a new patch tag such as `v1.0.1`); new feature requests go into `POST_MVP_BACKLOG.md`, never into this baseline.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, Auth, Company/Tenant, Roles & Permissions | ✅ Complete |
| 2 | Parties - Clients, Vendors, Contacts, Addresses, Documents, Notes | ✅ Complete |
| 3 | Products & Inventory (stock ledger, serials) | ✅ Complete |
| 4 | Energy Quotations (revisions, PDF) | ✅ Complete |
| 5 | Sales Orders + Energy Invoicing | ✅ Complete |
| 6 | Customer Payments + Receivables + Customer Ledger + Reminders | ✅ Complete |
| 7 | Purchasing + Vendor Payables + Vendor Payments + Vendor Ledger | ✅ Complete |
| 8 | Energy Projects + Site + Installation Management | ✅ Complete |
| 9 | Warranty + AMC + Maintenance/Service Management | ✅ Complete |
| 10 | Expenses + Profitability + Management Reporting | ✅ Complete |
| 11 | (Folded into Phase 12 - no separate audit phase was run beforehand) | - |
| 12 | MVP Freeze + Production Handoff + Shanvi UAT prep | ✅ Complete |
| 13 | Git Initialization + Energy MVP v1.0 Baseline | ✅ Complete |

Every phase was implemented, tested (Playwright + typecheck/lint/build), and left with test fixtures cleaned up. No phase was auto-advanced without an explicit new phase prompt.

## Architecture (stable across all phases)

- **Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Prisma 6.19.3 pinned (7/8-rc have breaking driver-adapter changes) on SQLite.
- **Auth:** custom JWT session via `jose`, cookie-based, `src/lib/auth/`. `src/app/proxy.ts` (Next 16's renamed middleware) gates all `(app)` routes.
- **Tenant model:** every business record carries `companyId`; every query/action is scoped by `session.companyId` from `requireSession()`/`getSession()`. No cross-tenant query has ever been written without this filter.
- **Party model:** one `Party` table for both Clients and Vendors (`type` discriminator), reused everywhere - see `src/lib/core/parties/`.
- **Roles & permissions:** `src/lib/core/roles.ts` (8 fixed roles) + `src/lib/core/permissions.ts`. Two layers: coarse `canAccessModule` (nav visibility) and fine-grained per-action functions (`canManageX` / `canCancelX` per module), never hardcoded role checks in business logic.
- **Numbering:** one generic sequence generator, `src/lib/core/numbering.ts` (`nextDocumentNumber`), backing every document series: `QTN-`, `SO-`, `EINV-`, `EPAY-`, `VPO-`, `PREC-`, `VINV-`, `VPAY-`, `PRJ-`, `INS-`, `EQP-`, `WAR-`, `AMC-`, `SR-`, `MNT-`, `EXP-`.
- **Reporting/profitability principle (Phase 10):** every figure shown on the Dashboard, `/reports`, and `/finance/profitability` is computed live via Prisma `aggregate`/`groupBy` from Invoice/VendorInvoice/Payment/VendorPayment/Expense/ProjectItem rows at request time - nothing is stored as a precomputed dashboard/profit number (no `ProjectProfit`/`MonthlyProfit`/`DashboardMetric` model exists). All profit/margin language is deliberately "Estimated"/"Operational", never "Net Profit" or a statutory accounting term.
- **Computed-status pattern (Phase 9):** `Warranty`/`AMC` never let a user type "Active"/"Expiring Soon"/"Expired" - those are always derived live from `startDate`/`endDate` (`computeWarrantyStatus`/`computeAmcStatus`), the same "never store what can be derived" discipline used for Invoice's "Overdue" badge since Phase 5. Only the terminal `CANCELLED` (and `COMPLETED`/`DRAFT` for AMC) is ever written by a user action.
- **Operational ledger pattern (new in Phase 8):** alongside the financial-ledger pattern (money fields recomputed from allocations), Phase 8 introduced the same discipline for *operational* counters - `src/lib/energy/projects/ledger.ts` recomputes `ProjectItem.assignedQuantity`/`installedQuantity` from actual `SerialNumber` rows for serial-tracked products (never a direct increment for those), and `assertProjectCompletable()` is the single gate used both by the manual "mark project completed" action and by automatic completion-on-installation.
- **Money math:** `src/lib/energy/shared/pricing.ts` - `round2`, `calculateLineItem`, `calculateDocumentTotals`, shared by every document type (Quotation, Sales Order, Invoice, Purchase Order, Vendor Invoice). All amounts are `Float` columns rounded to 2dp at every write - no raw float math reaches storage.
- **Shared UI infra:** `src/components/shared/line-items-editor.tsx`, `form-fields.ts` (zod helpers), `print-button.tsx` (native `window.print()`, no PDF library) - reused by every document type's form/print view instead of being reimplemented per module.
- **Inventory ledger:** `src/lib/energy/inventory/ledger.ts` - `applyStockMovement` is the *only* code path allowed to mutate `InventoryBalance`; every stock change (sales reservation, purchase receiving, adjustments) goes through it and leaves a `StockMovement` row.
- **Financial ledger pattern:** established in Phase 6, reused in Phase 7 - a document's derived money fields (`paidAmount`, `outstandingAmount`, `status`) are *never* set directly; a dedicated `ledger.ts` per domain (`payments/ledger.ts`, `vendor-payments/ledger.ts`) recomputes them from the actual allocation rows every time, inside the same transaction as the write that changed them.
- **Audit:** `src/lib/core/audit.ts` (`recordAudit`), append-only `AuditLog`, used by every create/status-change/cancel action across all phases.
- **Document/print pattern:** print routes live outside the `(app)` layout group (e.g. `src/app/purchase/vendor-invoices/[id]/print`) so they render without the sidebar; reuse the one shared `PrintButton`.
- **PDF:** no PDF library anywhere - every "Print/PDF" action is the browser's native print dialog on a purpose-built print view.

## Database schema (cumulative)

Core (Phase 1-2): `Company`, `User`, `Party`, `PartyContact`, `PartyAddress`, `PartyNote`, `Document`, `AuditLog`.
Inventory (Phase 3): `Category`, `Brand`, `Unit`, `Location`, `Product`, `InventoryBalance`, `StockMovement`, `SerialNumber`.
Energy sales (Phase 4-5): `NumberSequence`, `Quotation` + `QuotationLineItem`, `SalesOrder` + `SalesOrderLineItem`, `Invoice` + `InvoiceLineItem`.
Customer financials (Phase 6): `Payment`, `PaymentAllocation`, `PaymentReminder`.
Purchasing/vendor financials (Phase 7): `PurchaseOrder` + `PurchaseOrderLineItem`, `PurchaseReceipt` + `PurchaseReceiptLineItem`, `VendorInvoice` + `VendorInvoiceLineItem`, `VendorPayment`, `VendorPaymentAllocation`.
Energy projects (Phase 8): `ProjectSite`, `EnergyProject`, `ProjectItem`, `ProjectMilestone`, `Installation`, `InstallationItem`. Plus a nullable `SerialNumber.projectId` FK (reusing the existing `SerialNumber.status` enum values `ASSIGNED`/`INSTALLED` that were already anticipated in Phase 3), `SalesOrder.projects` reverse relation, `User.managedProjects`/`User.technicianInstallations` reverse relations.
Warranty/AMC/Service (Phase 9): `InstalledEquipment`, `Warranty`, `AMC`, `ServiceRequest`, `MaintenanceVisit`, `ServicePartUsage`. Plus a nullable `Invoice.amcId` FK (mirrors the existing `salesOrderId`/`quotationId` nullable-FK pattern on Invoice) and a nullable reverse `SerialNumber.installedEquipment` relation.
Expenses/Reporting (Phase 10): `ExpenseCategory`, `Expense` (nullable `vendorId`/`projectId`/`siteId` FKs). No other new models - profitability/reporting is entirely computed from existing tables, per the spec's explicit "do not store calculated dashboard metrics" instruction.
Post-baseline (see "GST-Compliant Tax Invoice Layout" below): `Company` gained a statutory/print profile (`gstin`, `pan`, address fields, `phone`, `email`, bank detail fields - all optional); `Product` gained `hsnCode` (optional).

Migrations are additive only; nothing has been dropped or renamed across phases.

## Phase 7 detail (most recent)

**Business flow implemented:** Vendor → Purchase Order → Stock Receipt → Vendor Invoice → Payable → Vendor Payment → Allocation → Vendor Ledger.

**Key architectural decisions:**
- `PurchaseOrder`/`VendorInvoice`/`VendorPayment`/`VendorPaymentAllocation` are **separate concrete models** from their customer-side counterparts (`SalesOrder`/`Invoice`/`Payment`/`PaymentAllocation`), not a shared polymorphic table - consistent with this codebase's established pattern of one concrete model per document type. What *is* shared: the code patterns (ledger recompute, allocation validation, numbering, pricing, line-items UI), and literally shared code where the data is identical (`PAYMENT_MODES`, ageing-bucket logic re-exported from `payments/types.ts` into `vendor-payments/types.ts`).
- PO does **not** affect stock or payables on its own - confirmed by design and by test. Only `PurchaseReceipt` (via `applyStockMovement` with `STOCK_IN`) touches inventory; only `VendorInvoice` creates a payable; only `VendorPayment` reduces it.
- `PurchaseOrderLineItem.receivedQuantity` is a cached field recomputed from `PurchaseReceiptLineItem` rows (mirrors `Invoice.paidAmount`'s recompute pattern) - never incremented directly. Pending = quantity − receivedQuantity, always derived.
- PO status lifecycle: `DRAFT → SENT → CONFIRMED →` (auto) `PARTIALLY_RECEIVED →` (auto) `FULLY_RECEIVED → CLOSED`, with `CANCELLED` reachable only from `DRAFT/SENT/CONFIRMED` - structurally impossible to cancel once any receiving has happened (not in the transitions map).
- Vendor Invoice status (`DRAFT/UNPAID/PARTIALLY_PAID/PAID/CANCELLED`) is recomputed from `VendorPaymentAllocation` rows only, mirroring customer Invoice exactly. "Overdue" is never a stored status - it's a computed badge (due date passed + balance > 0), same as the customer side.
- Vendor Ledger uses **opposite debit/credit semantics** from the Customer Ledger, matching standard liability accounting: Vendor Invoice = Credit (increases what we owe), Vendor Payment = Debit (reduces it), a cancelled payment posts a reversing Credit. Customer side: Invoice = Debit, Payment = Credit.
- Vendor Invoice creation supports both "from a Purchase Order" (copies line items as a snapshot) and standalone (for non-stock vendor bills) - no separate "from receipt" flow was built (a receipt-level partial-invoicing flow was judged out of scope for this MVP; PO-based invoicing already covers the common case).

**New permissions:** `canManagePurchaseOrders`/`canCancelPurchaseOrders`, `canReceivePurchases`, `canManageVendorInvoices`/`canCancelVendorInvoices`, `canManageVendorPayments`/`canCancelVendorPayments` (`src/lib/core/permissions.ts`). Cancellation stays Owner/Admin-only everywhere, matching the established convention.

**Nav changes:** added "Purchase Receipts" and renamed "Payments Made" label to "Vendor Payments" under the Purchase section; implemented the previously-placeholder Finance → Payables and Finance → Vendor Ledger pages (Vendor Ageing was folded into the Payables page as a bucket filter, matching how Receivables handled ageing in Phase 6 - no separate nav item).

**Vendor 360:** `party-detail-view.tsx` now branches on `type === "VENDOR"` for a "Purchase Orders" tab (new) plus vendor-scoped "Invoices"/"Payments"/"Outstanding"/"Ledger" tabs (same tab keys as the customer side, different data source) and a Vendor Summary card (Total Purchases, Total Invoiced, Total Paid, Total Outstanding, Overdue, Advance Balance) on Overview.

**Dashboard:** added Purchase Orders card (total/draft/confirmed/partially received/awaiting receipt) and Vendor Payables card (total payable, overdue, upcoming 7-day, partially paid/unpaid counts, vendor payments this month, top payable vendors); the existing "Payables" placeholder stat tile now shows the real total.

**Testing:** 38-check Playwright suite covering the full PO → receive (partial + full) → vendor invoice → payment (full/partial/multiple/advance/allocation/cancellation) → ledger → Vendor 360 → Payables → dashboard → permissions → tenant-isolation chain, plus a regression smoke pass over every Phase 1–6 page. All fixtures cleaned up afterward. `tsc --noEmit`, `npm run lint`, `npm run build` all pass clean.

**Known limitation:** editing/removing a single existing allocation without cancelling the whole payment isn't supported on either side (customer or vendor) - only adding more allocations, or cancelling the payment entirely. This is a deliberate scope boundary carried over from Phase 6, not a gap introduced in Phase 7.

## Phase 8 detail (most recent)

**Business flow implemented:** Customer → Quotation → Sales Order → Project → Site → Equipment (Scope Items) → Installation → Completion.

**Key architectural decisions:**
- `EnergyProject` normally originates from a **confirmed Sales Order** (`createProjectFromSalesOrderAction`), which snapshots the SO's line items into `ProjectItem` rows (never a live/duplicated reference) - validated: SO must not be `DRAFT`/`CANCELLED`, and a SO can only ever have one linked project. A standalone `createProjectAction` also exists for projects with no SO (e.g. pure service/installation work), matching the spec's allowance for both paths while making the SO path the recommended one (surfaced via a "Create Project" section on the Sales Order detail page).
- `ProjectSite` is a reusable per-customer address book - no GPS/location fields, as instructed - linked to `EnergyProject` (optional `siteId`) and to `Installation` independently, so a project can move between sites is *not* supported but multiple projects can share one site.
- **No duplicate inventory system.** `ProjectItem.assignedQuantity`/`installedQuantity` are cache fields, but for serial-tracked products they are *always* recomputed from `SerialNumber` rows (`recomputeSerialProjectItemCounters` in `projects/ledger.ts`) - never manually incremented. Non-serial products use direct-but-capped increments (validated against `requiredQuantity`/`assignedQuantity`) since there is no serial row to recount for them; this is a deliberate, documented simplification. "Reserved" is never a separate number - it's read from the existing `SalesOrder.stockReserved` boolean.
- `SerialNumber` already had `ASSIGNED`/`INSTALLED` status values anticipated since Phase 3 with no consumer - Phase 8 is the first phase to use them, via the new nullable `SerialNumber.projectId` FK. No new serial-status values were added.
- **Project completion is a gate, not a button.** `assertProjectCompletable()` throws `ProjectRuleError` unless every `ProjectItem.installedQuantity === requiredQuantity` and every `ProjectMilestone.status` is `COMPLETED` or `SKIPPED`. It is called from two places: `setProjectStatusAction` (manual, when target status is `COMPLETED` - surfaces the error to the user) and `completeInstallationAction` (automatic, wrapped in try/catch - an installation completes successfully even if the project isn't fully done yet; the project just silently stays at its current status until the last installation clears the gate).
- **Commercial figures are never duplicated.** `getProjectCommercialSummary()` reads `SalesOrder.grandTotal` and live `Invoice` rows (excluding `CANCELLED`) on every render - no `Project.contractValue`/`Project.paidAmount` field exists in the schema.
- **Documents reused, not rebuilt.** Project documents use the existing generic `Document` model (`entityType: "PROJECT"`) and the existing `DocumentsSection` component and `/api/parties/documents/[documentId]` download route - confirmed (not assumed) that route only filters by `companyId`, requiring zero code changes to support the new entity type.
- **Milestones are a fixed flat list**, no dependency graph: `DEFAULT_MILESTONES` (7 named milestones) auto-seeded on project creation, each independently settable to Pending/In Progress/Completed/Skipped.
- Installation checklist is a JSON blob (`Installation.checklistJson`) following the same pattern as `Quotation.technicalConfigJson` from Phase 4 - not a new normalized table, per the spec's "simple checklist" instruction.

**New permissions:** `canManageProjects`/`canCancelProjects`, `canManageSites`, `canManageInstallations` (`src/lib/core/permissions.ts`). Project/Site management is Owner/Admin + Project Manager; Installation management additionally allows the Installation Team role; cancellation is Owner/Admin-only, matching the established convention.

**Nav changes:** Projects section expanded from `[Projects, Installations]` to `[Projects, Sites, Installations]`.

**Integrations:**
- Sales Order detail page: new "Project" section (existing linked project badge, or a "Create Project" button gated on SO status + `canManageProjects`).
- Client 360 (`party-detail-view.tsx`): three new tabs for `type === "CLIENT"` - Projects, Sites (with an "Add Site" shortcut into the site-create form, customer preset via `?customerId=`), Equipment (installed equipment derived live from `ProjectItem.installedQuantity > 0`, never a separate list).
- Dashboard: new "Projects & Installations" card (Active Projects, Due Soon, Installations Scheduled, Installations In Progress, Completed, Sites Under Execution) plus the previously-placeholder "Active Projects" stat tile now shows a real count.

**Testing:** 30-check Playwright suite covering project creation (both from-SO and standalone), status transitions, milestone lifecycle, scope-item assignment (serial and non-serial), installation creation/checklist/completion, project auto-completion gating (both the "not yet eligible" and "now eligible" cases), Site CRUD, Client 360 integration, Sales Order integration, dashboard counts, permissions, and tenant isolation. Two test-script bugs were found and fixed during this pass (a `<select>` option text leaking into `.innerText()` scoping, and a case-sensitive regex missed by a `text-uppercase` CSS class on a dashboard label) - both confirmed via direct DB inspection to be test-script issues, not app bugs, before fixing. All fixtures cleaned up afterward. A follow-up 24-route regression smoke pass over every Phase 1–7 page (logged in as Owner) confirmed no regressions. `tsc --noEmit`, `npm run lint`, `npm run build` all pass clean (47/47 routes generated).

**Known limitations:**
- Non-serial `ProjectItem` assignment/installation quantities are tracked as direct validated counters, not derived from any row-level source of truth (unlike serial-tracked items) - acceptable since there's no natural "unit" row to count for bulk/non-serialized materials, but it means a manual DB edit could theoretically desync them from reality in a way serial tracking can't.
- A project can be linked to at most one Sales Order and vice versa (no many-to-many); a project with multiple related SOs (e.g. a follow-on SO for spares) is out of scope.
- No project cost/P&L, no GPS/site-location, no dependency graph between milestones, no technician mobile app, no notification system beyond what already existed - all per explicit spec exclusions.

## Phase 9 detail (most recent)

**Business flow implemented:** Installation → Installed Equipment → Warranty / AMC → Service Request → Maintenance Visit → (chargeable) Energy Invoice.

**Key architectural decisions:**
- **Installed Equipment is the new registry anchor**, created *only* by `completeInstallationAction` (`installations/actions.ts`) - one row per serial for serial-tracked products (quantity 1, `serialNumberId` set) and one row per `InstallationItem` batch otherwise. It is never a second source of stock/serial truth: it just labels what `SerialNumber`/`ProjectItem` already recorded as installed, for after-sales tracking.
- **Status is computed, not typed**, for Warranty and AMC. `computeWarrantyStatus`/`computeAmcStatus` derive `NOT_STARTED`/`ACTIVE`/`EXPIRING_SOON`/`EXPIRED` live from stored dates (30-day default threshold) every time they're rendered or queried - mirroring the established "Overdue" computed-badge pattern from Invoices (Phase 5) and Vendor Invoices (Phase 7). Only `CANCELLED` (and AMC's `DRAFT`/`COMPLETED`) are ever written by a user action.
- **AMC has no equipment-join table.** A contract covers a customer (optionally scoped to one site/project); "is this equipment under an active AMC?" is answered by `findActiveAmcForCustomer()` matching on customer + site, not a stored per-equipment flag - deliberately simple, per the spec's "do not build a rules engine" instruction.
- **Service Request snapshots coverage at creation time** (`warrantyStatusAtRequest`/`amcStatusAtRequest`) - the same point-in-time-snapshot pattern as `PaymentReminder.outstandingAtReminder` from Phase 6, so a later warranty/AMC expiry never rewrites what staff saw when the request was logged.
- **Financial boundary respected exactly as specified.** `createInvoiceFromServiceRequestAction` builds a normal DRAFT `Invoice` (parts consumed on linked Maintenance Visits + an optional flat service charge line) and stores the link as `ServiceRequest.invoiceId` - there is no `ServiceInvoice`/`ServiceReceivable`/`ServiceLedger` model. Once issued, it flows through the exact same Receivables/Customer Payment/Customer Ledger machinery as every other invoice (verified in testing).
- **Inventory boundary respected exactly as specified.** `completeMaintenanceVisitAction` consumes parts via the existing `applyStockMovement` (`STOCK_OUT`, reference = visit number, reason `SERVICE_PART_CONSUMPTION`) and records a `ServicePartUsage` row pointing at the resulting `StockMovement` - no second inventory ledger, and insufficient stock surfaces as the existing `StockRuleError`.
- **Service Request status is mostly automatic.** Assigning a request from `OPEN` auto-advances it to `ASSIGNED`; scheduling a Maintenance Visit against an `OPEN`/`ASSIGNED` request auto-advances it to `SCHEDULED`. `RESOLVED` is reachable only through a dedicated action that requires a non-empty resolution note - never a bare status-change button (spec section 27).
- **Maintenance checklist** is a flat `{key: boolean}` JSON blob (`MaintenanceVisit.checklistJson`), same pattern as `Installation.checklistJson` from Phase 8 - not a normalized checklist-items table.
- **AMC visit counters are never stored.** `visitsUsed`/`visitsRemaining` are computed at read time by counting `MaintenanceVisit` rows with `status: COMPLETED` linked to the AMC - the same "operational ledger, recompute from source of truth" discipline as Phase 8's project completion counters.

**New permissions:** `canManageInstalledEquipment`, `canManageWarranties`, `canManageAmcs`, `canManageServiceRequests`/`canAssignServiceRequests`, `canManageMaintenanceVisits`/`canCompleteMaintenanceVisits` (`src/lib/core/permissions.ts`) - all role-based, reusing the existing `PROJECT_MANAGER`/`SERVICE_MAINTENANCE`/`INSTALLATION_TEAM` roles from Phase 8's role set (no new roles added; `SERVICE_MAINTENANCE`'s module access already anticipated `service`+`warranty` since Phase 1).

**Nav changes:** "Warranty" converted from a single link into a group (Installed Equipment, Warranties); "Service" gained a third item (Maintenance) alongside the existing Service Requests/AMC placeholders.

**Integrations:**
- Customer 360 (`party-detail-view.tsx`): Equipment tab upgraded from the old `ProjectItem`-derived list to the real Installed Equipment registry (with status badges); two new tabs - Warranty & AMC, Service.
- Project detail: new "Warranty & Service" tab - read-only, relationship-driven (equipment/warranties/AMCs/post-installation service requests for that project), never duplicates the underlying records.
- Site detail: extended with Installed Equipment, Warranties, AMC Contracts, Open Service Requests, and Maintenance History sections.
- Dashboard: new "Warranty, AMC & Service" card (Open Service Requests, High/Critical, Resolved This Month, Maintenance Scheduled/Overdue, Active AMCs, AMCs Expiring Soon, Active Warranties, Warranties Expiring Soon).
- Maintenance list page doubles as the spec's "Upcoming Work" and "Maintenance Due" views via a tab toggle (`?view=schedule|all`) rather than three separate pages - the schedule view highlights overdue visits in place.

**Testing:** a full Playwright suite driven through the real UI end-to-end - confirmed Sales Order → Project (via "Create Project") → Site → scope assignment (serial + quantity) → Installation → completion (verifying `InstalledEquipment` auto-creation, including a real bug caught and fixed: `productCode` was never populated on the new registry rows) → Warranty creation/status → AMC creation/activation → Service Request creation with coverage snapshot → assignment (auto-status) → Maintenance Visit scheduling (auto-status) → completion with part consumption (verified stock reduced, `StockMovement`/`ServicePartUsage` created and linked) → resolution (with required note) → chargeable invoice creation → invoice issued → verified in Receivables and Customer Ledger. Followed by Customer 360/Project/Site/Dashboard integration checks, RBAC checks (SALES nav hides Service/Warranty; SERVICE_MAINTENANCE can access both and act on records), and a full cross-tenant isolation sweep (5 direct-URL detail-page attempts + 4 list-page attempts, all correctly blocked/empty for a second company). A handful of false test failures were diagnosed and fixed along the way (a generic `button[type="submit"]` selector matching the app-shell's logout button instead of the form's own submit button, and `page.waitForURL()` resolving trivially when already on the matching URL) - all confirmed via direct DB inspection to be test-script issues, not app bugs. Finished with a 28-route regression smoke pass over every Phase 1–8 page (no regressions) and full fixture/second-tenant cleanup. `tsc --noEmit`, `npm run lint`, `npm run build` all pass clean.

**Known limitations:**
- No notification system was added (none existed to reuse, per spec instruction) - "expiring soon"/"maintenance due" surface only as operational list views (Warranties/AMC list filters, the Maintenance schedule tab), not push/email/in-app alerts.
- Warranty/AMC "Document/reference" is a plain text field, not a file upload - kept intentionally simple; the existing Document infrastructure was reused for Project documents but not extended here to avoid scope creep on an already-large phase.
- AMC coverage is customer/site-level only (no equipment-level AMC join table) - a contract cannot exclude a specific piece of equipment from its coverage.
- Non-serial equipment quantities on `InstalledEquipment` are per-installation-batch snapshots, not further reconciled if equipment is later partially replaced/removed (status changes are equipment-level, not quantity-level).

## Phase 10 detail (most recent)

**Business flow implemented:** Expense capture (with approval + minimal payment tracking) → management-level Reports/Profitability layer computed live from Sales/Purchases/Collections/Payables/Expenses/Project data, with a Dashboard summary and CSV export for the highest-value views.

**Key architectural decisions:**
- **No general ledger, no computed-metric tables.** `Expense`/`ExpenseCategory` are the only two new models. Every Sales/Purchases/Collections/Payables/Expense/Profitability figure anywhere in the app (Dashboard, `/reports`, `/finance/profitability`, Project's Profitability tab) is computed on read via Prisma `aggregate`/`groupBy`/targeted queries - there is no `ProjectProfit`, `MonthlyProfit`, or `DashboardMetric` row anywhere, per the spec's explicit instruction.
- **Two distinct, deliberately different profitability methodologies, both labelled "Estimated":**
  - *Company-wide* (Dashboard, Purchase-vs-Sales trend, Reports): `Estimated Gross Profit = Sales (invoiced) − Purchases (vendor invoiced) − Expenses (approved/paid)`. This is the simpler, more defensible aggregate view - it never tries to trace which specific purchased units were consumed.
  - *Project-level* (Project's Profitability tab, Profitability-by-Project/-Customer reports): `Estimated Profit = Invoiced Revenue − (Material Cost + Service Part Cost + Project Expenses)`, where **Material Cost = installed quantity × `Product.purchasePrice`** - deliberately using *installed*, not required or purchased, quantity, so buying 100 units but only installing 40 on a given project never inflates that project's cost (verified in testing - see Financial Validation below).
  - The two are intentionally not reconciled against each other; each is documented and labelled for what it actually measures.
- **No new product-cost field.** `Product.purchasePrice` (existing since Phase 3) is reused as-is for material cost estimation. There is no weighted-average/FIFO/batch costing in this codebase, so project/customer profitability is explicitly labelled "Estimated / Operational" everywhere it appears, with an inline note explaining the simplification - never presented as statutory accounting profit.
- **Expense is a lightweight lifecycle, not a second payment ledger.** `status` (`DRAFT → APPROVED → PAID/CANCELLED`) mirrors Invoice/VendorInvoice's pattern; `PAID` is only ever reached once `paidAmount` (incremented directly by `recordExpensePaymentAction`, capped at `grandTotal`) reaches the total - never a bare button. "Partially Paid" is a computed overlay badge, not a stored status, the same pattern as Invoice's "Overdue" badge. A `PAID` expense can never be cancelled (historical record preserved, per spec).
- **Payment mode is reused, not reinvented.** `Expense.paymentMode` uses the exact `PAYMENT_MODES`/`PAYMENT_MODE_LABELS` constants from `energy/payments/types.ts` (Phase 6) rather than a new enum.
- **Expense categories are a real configurable master**, following the exact `Category`/`Brand`/`Unit` pattern from Settings (Phase 3) - same `MasterDataManager` component reused verbatim, added as a new Settings tab.
- **No double counting, verified explicitly (spec section 49):** a Vendor Invoice is counted once, as a Purchase; a Vendor Payment reduces the Payable but is never re-summed into Purchases; a Customer Payment is Collections, never additional Sales; an unpaid Invoice/Vendor Invoice still contributes to Receivables/Payables but never to Collections/Vendor-Payments-this-month. All four scenarios were driven end-to-end in testing (see below).
- **One shared period resolver** (`src/lib/energy/reporting/period.ts`, `resolvePeriodRange`) backs the Dashboard's period selector, the Reports hub, and (implicitly) Profitability filters - Today/This Week/This Month/Last Month/This Quarter/This Year/Custom, so there is exactly one date-range implementation in the app.
- **Reports hub reuses rather than duplicates.** The `/reports` page's Collections and Purchases tabs link out to the existing Receivables/Payables pages (Phase 6/7) instead of rebuilding ageing/ledger views; "Project Summary" links to the existing `/projects` list. Only genuinely new aggregate views (Sales/Customer Sales, Vendor Purchases, Expense by Category/Project, Service/Maintenance activity) were built fresh.
- **CSV export** is a single `/api/reports/export` route handler (`type=sales|purchases|expenses|receivables|payables|project-profitability`) that calls the exact same query functions the on-screen reports use - never a separate export-specific query path, so the export can't drift from what's displayed. No report-designer, no Excel format - CSV only, per the "do not build a complicated report designer" instruction.
- **Sensitive financials are permission-gated**, not just nav-hidden: `canViewProfitability`/`canViewFinancialDashboard` (Owner/Admin + Accounts only) gate the Profitability page/tab content and the Dashboard's "Business Performance" card and monthly trend table - verified that SALES sees "Access restricted" / no card, while ACCOUNTS sees full content (matches the existing Settings-page access-restriction pattern, since this codebase's convention is nav-hiding + in-page permission checks rather than route-level middleware blocking).

**New permissions:** `canManageExpenses`, `canApproveExpenses`, `canCancelExpenses` (Owner/Admin + Accounts manage; Owner/Admin-only approve/cancel, mirroring every other maker-checker gate in this codebase), `canViewProfitability`, `canViewFinancialDashboard` (Owner/Admin + Accounts only).

**Nav changes:** Finance section gained "Profitability"; the pre-existing "Expenses" placeholder is now fully implemented; the pre-existing "Reports" top-level placeholder is now a real hub with six report categories.

**Integrations:**
- Project detail: new "Profitability" tab (permission-gated) with Commercial/Estimated Costs/Estimated Result sections exactly per spec's example layout; Overview tab gained a "Project Expenses" total (derived live, with a "Log Expense" shortcut for permitted roles).
- Site detail: new "Site Expenses" section (derived live from `Expense.siteId`).
- Dashboard: "Total Sales" stat tile (previously a placeholder) now shows real period-scoped sales; new "Business Performance" card (Sales/Collections/Purchases/Expenses/Estimated Gross Profit/Margin, period-selectable); new "Purchase vs Sales - Last 6 Months" trend table; new "Expenses" card (this month/year, unpaid count, top categories) - all reusing the existing dashboard card visual pattern.
- Documents: Expense attachments reuse the generic `Document` model (`entityType: "EXPENSE"`) and the existing `DocumentsSection`/download route unmodified.

**Testing:** a full Playwright + direct-DB-verification suite (60 checks across 5 stages) built on a hand-computed financial scenario (Sales Order/Invoice ₹67,260 with a ₹40,000 partial customer payment; Vendor Invoice ₹94,400 purchasing 10 panels + 1 inverter; Project installing only 1 inverter + 4 of those panels) - verified: (1) Project Profitability tab shows the exact expected revenue/material-cost/profit figures, confirming installed-quantity-based costing (not purchased-quantity); (2) Dashboard and Reports independently show the correct Sales/Purchases/Collections figures for the same underlying data; (3) full Expense lifecycle (draft → approve → partial payment → full payment → PAID, with Partially Paid badge and no-cancel-when-paid enforced) and its effect on Project Expenses/Profitability; (4) recording a full Vendor Payment against the ₹94,400 Vendor Invoice reduces Payables to zero and adds ₹94,400 to "Vendor Payments this month" **without** changing the ₹94,400 Purchases figure - directly proving no double-counting (spec scenarios C/D); (5) all six Reports categories render, and all six CSV export types return `text/csv`; (6) RBAC (SALES restricted from Profitability/financial dashboard/expense creation; ACCOUNTS has full access but cannot approve); (7) full cross-tenant isolation sweep (a second company could not reach any Phase 10 record by direct URL or see it in any list/report/dashboard). One test-script arithmetic error was caught and corrected (a premature expected-profit figure computed before expenses existed) - confirmed via manual recalculation, not an app bug. Finished with a 32-route regression pass over every Phase 1–9 page - no regressions. `tsc --noEmit`, `npm run lint`, `npm run build` all pass clean. All fixtures and the second tenant were cleaned up afterward.

**Financial validation (spec Step 7 scenarios):**
- **Scenario A** (Sales/Cost/Expense consistency): confirmed - Project Profitability showed revenue ₹67,260, cost ₹51,000 (material ₹44,000 + expenses ₹7,000), profit ₹16,260, matching hand calculation exactly.
- **Scenario B** (unpaid customer invoice): the ₹27,260 still-outstanding portion of the invoice contributed to Receivables but the Collections figure only ever showed the ₹40,000 actually paid - never the invoice total.
- **Scenario C** (unpaid vendor invoice): the full ₹94,400 contributed to Purchases and Payables while unpaid; Vendor Payments this month was ₹0 until a payment was actually recorded.
- **Scenario D** (vendor payment): recording the ₹94,400 vendor payment reduced Payables to ₹0 and set Vendor Payments this month to ₹94,400, while Purchases remained unchanged at ₹94,400 - no double count.
- **Scenario E** (unused inventory): the vendor invoice purchased 10 panels but the project only installed 4 - material cost correctly used 4 × ₹6,000 = ₹24,000, not 10 × ₹6,000 = ₹60,000.

**Known limitations:**
- No weighted-average/FIFO/batch inventory costing exists in this codebase (Phase 3 never built one) - material cost is `installedQuantity × Product.purchasePrice`, a single-price-point estimate. If a product's purchase price changes over time, historical project cost will not reflect the price actually paid for that specific batch. This is documented in code comments and clearly labelled "Estimated" in every UI surface that shows it.
- Vendor Invoices/Purchase Orders have no direct Project link in the schema, so a project's "Direct Cost" cannot include vendor-invoice-level costs directly - only material cost (via installed `ProjectItem` quantities), consumed service parts, and linked Expenses. A vendor invoice for materials not yet installed on any project is correctly excluded from any project's cost, but also cannot be manually attributed to one without going through inventory installation first.
- Customer profitability's "cost" is the sum of that customer's own projects' costs - a shared/overhead expense not linked to any project or customer is not attributed to any customer profitability figure (by design - attributing overhead would require an allocation policy this phase deliberately does not invent).
- The monthly trend table is capped at 12 months and issues one aggregate query per metric per month (bounded, not a full table scan, but not pre-aggregated either) - acceptable for the expected data volumes of a single-company MVP, flagged here if it ever needs to scale further.
- CSV export covers the six report types the spec explicitly prioritized; it does not cover every report visible in the Reports hub (e.g. Service/Maintenance activity has no export yet).

## Explicitly out of scope (per every phase's own instructions - do not build unless a future phase asks)

Pharma vertical, full general-ledger/double-entry accounting, Chart of Accounts, Journal Entries, Trial Balance, Balance Sheet, formal P&L accounting, GST return filing, TDS, payroll, bank reconciliation, statutory accounting/accounting periods, payment gateways, WhatsApp/SMS integration, full CRM/helpdesk/call-center systems, technician mobile app, GPS tracking/route optimization, advanced workforce scheduling, automatic AMC renewal, subscription billing engine, complex warranty claim adjudication, manufacturer/vendor warranty portals, IoT monitoring/real-time solar telemetry, automatic fault detection, advanced AI diagnosis/forecasting, advanced procurement workflows (requisition/approval chains, supplier bidding), Credit/Debit Notes, multi-currency (accounting), balance sheet/cash-flow-statement engines, a new inventory costing engine, advanced BI/data warehouse, complex report designer, manufacturing, advanced inventory/WMS.

## Phase 12 detail (most recent) - MVP Freeze + Production Handoff + Shanvi UAT

**Objective:** freeze the Energy MVP feature scope and prepare it for a controlled Shanvi Enterprises UAT/pilot. Not a feature phase - no new business functionality was added except one genuine defect fix found during final smoke testing.

**MVP freeze:** the feature scope is now frozen as documented in `MVP_BASELINE.md`. New features require an explicit new phase; only P0/P1/P2 defect fixes and security/data-integrity/production-readiness changes are allowed from here on.

**New/updated documents:**
- `MVP_BASELINE.md` - frozen scope, included modules, workflows, architecture, data-ownership rules, financial disclaimer.
- `PRODUCTION_RUNBOOK.md` - deployment, rollback, backup/recovery, monitoring, emergency response, initial production configuration (including the opening-inventory/opening-balance procedures).
- `SHANVI_UAT_CHECKLIST.md` - business-user-facing UAT scenarios and acceptance table (not technical).
- `POST_MVP_BACKLOG.md` - every explicitly-out-of-scope idea, so future requests have somewhere to go besides "build it now."
- `README.md` - fully rewritten from the untouched `create-next-app` boilerplate it still was; now documents the actual stack, setup, environment variables, migrations, and deployment.
- `.env.example` - already existed and was already accurate (`DATABASE_URL`, `SESSION_SECRET`); expanded with explanatory comments.

**Credentials & secrets audit:** searched the full source tree for API keys/tokens/hardcoded secrets - found none outside of `prisma/seed.ts`'s intentional shared development password (defined once in that file, deliberately not repeated in any documentation - see `prisma/seed.ts` itself for the value, used only by the 8 role-based dev login accounts). `SESSION_SECRET` is a 65-character value already set in `.env` (never printed, never committed - `.env` has always been git-ignored) with a runtime guard (`src/lib/auth/session.ts`) refusing to start if it's missing or under 16 characters. `prisma/seed.ts` now also refuses to run when `NODE_ENV=production` unless `ALLOW_DEV_SEED=true` is explicitly set, so a stray `npm run db:seed` can't plant the shared-password accounts in a production database. No test/debug/reset API routes exist - the only two API routes (`/api/parties/documents/[id]`, `/api/reports/export`) both require a valid session and are tenant-scoped.

**Source control audit:** this working copy is **not a Git repository** (confirmed via `git status` - "not a git repository"). This means there is no commit history, no `.gitignore` enforcement has ever actually applied, and nothing has been "committed" in the traditional sense - the `.gitignore` file present is ready for when this is initialized, and was reviewed (it correctly excludes `.env*` except `.env.example`, `/prisma/dev.db*`, `/storage/`, build artifacts). **Before real deployment, initialize Git, make an initial commit, and verify `git status` shows a clean tree with no secrets staged**, since none of this has been exercised yet.

**Database migration readiness:** verified by running `prisma migrate deploy` against a brand-new empty SQLite file - all 10 migrations applied cleanly in order with zero errors, and `prisma/seed.ts` ran cleanly against that same fresh database afterward. Migrations remain additive-only across the project's whole history.

**Demo data audit and cleanup:** distinguished three categories in the working database: (1) **System seed data** - the `Company` row, all 8 role-based `User` accounts, and the Category/Brand/Unit/Location reference master data from `prisma/seed.ts` (kept - this is genuine reusable reference data, and the app needs at least one login to be usable); (2) **Demo data** - a fully worked example (customer "Greenfield Textiles Pvt Ltd", vendor "SolarTech Distributors", 3 products, a Sales Order/Invoice/Payment, a Vendor Invoice/Payment, a Project/Site/Installation/Installed Equipment, a Warranty/AMC/Service Request/Maintenance Visit, 2 Expenses) that had been seeded in an earlier session to demonstrate the working app - removed entirely, including a Quotation (QTN-0001) found against the demo customer that appears to have been created by a human exploring the demo build rather than by the seed script; (3) **Real Shanvi business data** - none exists yet (pre-launch). Also cleared: the accumulated development/test `AuditLog` history (611 entries total across this cleanup and the later final-smoke-test cleanup - none of it real business activity) and reset every `NumberSequence` counter to zero, so Shanvi's first real Sales Order, Invoice, Purchase Order, etc. will each correctly start at `-0001` instead of continuing from development's internal counters.

**Final End-to-End smoke test:** drove the complete chain through the real UI with a fresh, hand-computed scenario: Customer -> Quotation (Draft -> Sent -> Approved) -> Sales Order (confirmed, stock reserved) -> Purchase Order (confirmed, partially then fully received into inventory) -> Vendor Invoice (issued) -> Vendor Payment (payable reduced to zero, purchases figure unchanged - no double count) -> Project (created from the Sales Order) -> Equipment Assignment -> Installation (completed, Installed Equipment registry populated) -> Invoice (issued) -> Customer Payment (two payments, 60%/40% split, exact Invoice-Payment=Outstanding reconciliation at each step) -> Warranty -> AMC (activated) -> Service Request (assigned) -> Maintenance Visit (scheduled, completed) -> Service Request resolved -> Expense (linked to the project, approved) -> Project Profitability (correctly reflecting the new expense). All steps passed (33 checks across 3 stages). Followed by a dedicated tenant-isolation sweep (a second company could not reach any of the above records by direct URL, and its own dashboard showed none of the first tenant's figures - 11/11 checks passed) and RBAC spot checks (SALES correctly restricted from Profitability and Settings). Finished with a 33-route full regression sweep (every Phase 1-10 page plus a logged-out-redirects-to-login check) - all passed. All smoke-test fixtures and the second tenant were removed afterward, along with the audit log/number-sequence noise they generated, leaving the database in the same pristine state as after the demo-data cleanup.

**Bug found and fixed during final smoke testing:** the AMC creation form (`src/lib/energy/amc/schema.ts`) rejected submission whenever "Billing Frequency" was left at its blank default option - the `<select>` submits an empty string, not an absent field, and `z.enum(...).optional()` only treats `undefined` as unset, so Zod reported "Invalid option" for the empty string. Fixed with a `z.preprocess` step normalizing `""` to `undefined` before the enum check (the same pattern already used by every other optional text field via `optionalTrimmed`). This was the only occurrence of this exact pattern anywhere in the codebase (confirmed by search). Classified P1 (an important workflow - creating an AMC without immediately picking a billing frequency - was completely blocked), fixed immediately per the freeze policy, and re-verified end-to-end afterward.

**Em-dash cleanup (unrelated small request folded into this session):** replaced the em-dash character ("-") with a plain hyphen throughout every user-facing string and code comment-adjacent line in `src/` (218 occurrences across 88 files) and across the top-level documentation files, since it read as an AI-generated writing tell. Source-code line comments (`//`) were intentionally left untouched, since they're not user-facing. Verified with `tsc --noEmit`, `npm run lint`, and `npm run build` after the change.

**Known limitations (carried forward, see `MVP_BASELINE.md` for the full list):** no weighted-average/FIFO inventory costing; no direct Vendor-Invoice-to-Project link; no bulk data import; no automated backups (documented as the operator's responsibility in `PRODUCTION_RUNBOOK.md`); not a Git repository yet.

**Deployment status:** **the application has NOT been deployed to any production or staging environment.** Everything above (build, migrations, smoke test) was run and verified locally. "Production-ready" (this document's assessment) is a distinct claim from "deployed to production" (has not happened) - see `PRODUCTION_RUNBOOK.md` before that step.

## Phase 13 detail

Phase 13 established version control for the first time. This working copy had no Git history
before this phase - `git status` at the start showed "not a git repository."

**Git initialization**: `git init`, default branch renamed to `main`. No remote was added, no
GitHub repository was created, and nothing was pushed anywhere - this is a local-only repository,
exactly as scoped.

**`.gitignore` review**: the existing file (from Phase 12) was already solid. Hardened further
with explicit `*.db` / `*.db-journal` patterns (belt-and-suspenders alongside the exact
`/prisma/dev.db` path) so a stray database file created anywhere by mistake is still excluded, and
confirmed `.env*` / `!.env.example`, `/storage/`, IDE metadata, logs, and build artifacts were all
already covered.

**Security pre-commit check**: before committing, every staged file was reviewed (not just
`git add .` blindly) and cross-checked against the explicit exclusion list (`.env`, production
secrets, API keys, DB credentials, private keys, real passwords, local DB files, generated
secrets, sensitive logs, temp files, inappropriate IDE/OS files, `node_modules`, build artifacts).
One real finding: the literal development password from `prisma/seed.ts` had been quoted directly
in `PRODUCTION_RUNBOOK.md` and `PROJECT_STATE.md` during Phase 12's documentation pass, which
violates the rule that the password may live only in `prisma/seed.ts` itself. Found by diffing
staged content for the password string before committing; fixed by rewording both documents to
reference "the shared password documented in `prisma/seed.ts`" instead of quoting it, then
re-verified with the same search that only `prisma/seed.ts` still contains it. No other excluded
category was found in the staged set - `node_modules/`, `.next/`, `prisma/dev.db`, and `.env` were
all correctly ignored and never staged.

**Application re-verification** (no functionality was changed to make the commit "clean" - this
was a re-run of existing checks, not new fixes): `tsc --noEmit`, `npm run lint`, and `npm run
build` all passed clean, matching Phase 12's results. No regression was found, so no code changes
were needed for this phase beyond the two documentation edits above.

**Commit and tag**: a single commit was created containing the entire reviewed working tree
(405 files, 47999 insertions) with message `Energy MVP v1.0 - UAT baseline`, followed by an
annotated tag `v1.0.0` ("Energy Solutions MVP v1.0 - Ready for Shanvi UAT") pointing at that
commit. `git status` immediately after tagging showed a clean working tree with nothing to commit.
See the Version Control section above for the exact commit hash.

**Versioning policy going forward** (for whoever picks up after UAT): this is a local-only
repository on a single `main` branch. `v1.0.0` is frozen - do not move the tag or amend the
baseline commit. Bug fixes during UAT become their own commits (e.g. `fix: correct customer
payment allocation`); once enough fixes accumulate, or a fix is significant enough to warrant
re-baselining, tag a new patch version (`v1.0.1`, then `v1.0.2`, ...). A small approved
improvement that isn't a bug fix would be `v1.1.0`. A major scope change (e.g. a second vertical,
a rewritten costing engine) would be `v2.0.0`. New feature ideas go into `POST_MVP_BACKLOG.md`
first, not directly into a commit.

No remote was configured, no GitHub repository was created or connected, nothing was pushed, and
no deployment/CI-CD/hosting/database/production-infrastructure change was made in this phase -
all explicitly out of scope per the phase instructions.

## Post-baseline change: GST-compliant Tax Invoice layout

Landed as a normal commit on top of `v1.0.0` (not amending the tag) - the first real change since the
baseline, driven by a concrete UAT need: the Sales Invoice print view (`/sales/invoices/[id]/print`)
didn't resemble a standard Indian GST tax invoice, and the `Company` model had nowhere to even store a
GSTIN, address, or bank details (this gap was previously deferred as "Company profile editing" in
`POST_MVP_BACKLOG.md`).

- **Schema (additive)**: `Company` gained a statutory/print profile - `gstin`, `pan`, address fields,
  `phone`, `email`, and bank detail fields, all optional. `Product` gained an optional `hsnCode`
  (HSN for goods / SAC for services).
- **Settings -> Company** now has an editable form for the new `Company` fields (Owner/Admin only),
  replacing the old "Company profile ... planned for a later phase" placeholder.
- **Product form** gained an HSN/SAC Code field (create, edit, and detail view).
- **`src/lib/energy/shared/amount-in-words.ts`** (new): converts a rupee amount to words using Indian
  numbering (Lakh/Crore, not Million/Billion) - needed for the invoice's "Amount Chargeable (in words)"
  and "Tax Amount (in words)" lines.
- **Invoice print view rewritten** to the classic bordered Tally-style tax invoice layout: seller
  details + invoice metadata grid, Consignee/Buyer boxes, line items with HSN/SAC and per-unit rate,
  a CGST+SGST or IGST tax-summary row per distinct tax rate (grouped, not blended, so a mix of e.g. 12%
  and 18% items shows two separate rows), an HSN/SAC tax summary table, amounts in words, and a
  bank-details/PAN/declaration/signatory footer. CGST+SGST vs IGST is decided by comparing the
  company's and client's `state` fields (same state -> CGST+SGST split in half; different -> IGST;
  either missing -> defaults to CGST+SGST) - this is a **display-time computation only**, not a new
  stored field or a change to any existing tax calculation; `Invoice`/`InvoiceLineItem`'s
  `taxAmount`/`grandTotal` are untouched. Fields the reference layout has but this app has no model for
  (e-Way Bill No., dispatch/transport details, gross/net weight) were intentionally left out rather than
  shown as permanently-blank placeholders.
- Verified against a real quotation -> sales order -> invoice chain, in the browser, both for a
  different-state buyer (IGST split, multiple tax rates) and, via a temporary before/after state edit
  restored immediately after, a same-state buyer (CGST+SGST split) - both matched the expected math by
  hand. `tsc --noEmit`, `npm run lint`, and `npm run build` all pass clean.
- Only the Sales Invoice print view was changed. Vendor Invoice, Purchase Order, Sales Order, and
  Quotation print views still use their earlier, simpler layout - revisit them the same way if asked.
- Follow-up fix: the invoice's signatory footer plus a lack of explicit `@page` sizing let the last
  few lines spill onto an otherwise-empty second page for some print margin settings. Fixed with
  `@page { size: A4; margin: 10mm }` (globals.css, `@media print`), tighter footer spacing, and
  `print:break-inside-avoid` on the tables/footer grid. Verified with a real PDF export
  (`page.pdf({ preferCSSPageSize: true })`) - single page now. Chrome's print-dialog "Headers and
  footers" option is outside the page's own control.

## Post-baseline change: Solar Quotation print layout

Same driver as the invoice change above - a real reference document (a company's own on-grid/off-grid
solar "project report" proposal) was used to restyle the Quotation print view
(`/sales/quotations/[id]/print`), for `ON_GRID_SOLAR`/`OFF_GRID_SOLAR`/`HYBRID_SOLAR` types specifically.

- **`Company` gained `website` and `tagline`** (both optional, additive migration) - shown on the
  quotation's letterhead header alongside the address/GSTIN/bank fields added for the invoice work.
- **`Quotation.technicalConfigJson`** (an existing free-form JSON blob - Phase 4 already anticipated
  needing this) gained more keys for solar: manufacturer/warranty/specification per component
  (`moduleManufacturer`, `moduleWarranty`, `inverterManufacturer`, `inverterSpecification`,
  `inverterWarranty`, `batteryManufacturer`, `batterySpecification`, `batteryWarranty`,
  `windSpeedResistance`, `mountingWarranty`, `installationIncluded`, `installationExcluded`,
  `transportationCost`) - no schema change needed, since this field was always meant to hold
  exactly this kind of flexible per-quotation-type spec sheet.
- **Print view rewritten** to a letterhead-style proposal layout: company letterhead, ref/date,
  customer address block with a "Dear Sir/Madam" salutation, a boxed system summary (capacity /
  module / battery / transportation / price / validity), the existing line-items table, then four
  separate spec tables (Solar PV Module, Inverter/PCU, Battery - hidden for `ON_GRID_SOLAR`,
  Mounting Structure) plus Installation Included/Excluded lists, Payment Terms, Delivery & Warranty,
  Terms & Conditions, and a Bank Details/signature footer. DG-type quotations keep the old flat
  key/value technical dump (out of scope this round - the two reference documents were both solar).
  Deliberately did **not** hardcode the reference company's own marketing/legal boilerplate (vision
  and mission paragraphs, specific warranty/force-majeure clauses) into the app's source - that's
  this one tenant's copy, not a structural requirement, and belongs in `Company.defaultQuotationTerms`
  (already designed to be snapshotted per quotation) if they want to paste it in themselves.
- Verified in the browser for both `OFF_GRID_SOLAR` (with a Battery section) and `ON_GRID_SOLAR`
  (Battery section correctly absent) using realistic values from the reference documents.
  `tsc --noEmit`, `npm run lint`, and `npm run build` all pass clean. This is a naturally multi-section
  document (matching the multi-page reference), so - unlike the invoice - no attempt was made to force
  it onto one printed page; `print:break-inside-avoid` was still added to the spec tables/summary
  box/footer so a page break (if one occurs) doesn't land mid-table.
- Two follow-up polish fixes landed as their own commits: the system-summary box left an empty padded
  gap and an awkward "…SYSTEM" suffix for non-power-system quotation types (fixed to hide the empty
  grid and only append "SYSTEM" for solar/DG/battery-inverter types); the "Technical Details" heading
  rendered even with zero technical data filled in (fixed to hide the whole section, not just the
  tables under it, when empty).

## Post-baseline change: On-Grid Solar proposal content (Phase A)

A large, explicit "audit first, then implement Phase A only" request (a second reference document,
the on-grid twin of the off-grid one used for the invoice/quotation layout work above). Delivered a
written architecture audit + gap analysis + file-level plan before touching any code, per the user's
explicit "do not code yet" instruction; user chose "keep browser print" (no server-side PDF dependency)
and "Phase A only" (no product-master linkage, no structured payment-milestone table) from two
`AskUserQuestion` prompts before implementation began.

- **Schema (additive)**: `Company.proposalContentJson` (company-wide default narrative) and two new
  `Quotation` columns - `billingAddressText` (snapshot, mirrors `Invoice.billingAddressText` exactly)
  and `proposalContentJson` (per-quotation snapshot of the company default, independently editable
  afterward - same pattern as the existing `termsAndConditions`/`defaultQuotationTerms` pair).
  `technicalConfigJson` gained three more keys (`projectType`, `areaAvailable`, `siteSurveyStatus` -
  "Design Inputs") with no schema change, since that field already exists exactly for this purpose.
- **`src/lib/energy/quotations/proposal-content.ts`** (new, deliberately *not* `"use client"`): the
  `ProposalContentValues` type and `parseProposalContent()` parser, callable from server components.
  A real bug was caught and fixed here during testing: these were first defined inside the
  `"use client"` `proposal-content-fields.tsx`, which crashed every server component that tried to
  call `parseProposalContent()` directly ("Attempted to call parseProposalContent() from the server") -
  a client-module export can be used as a component/prop from a server component, never invoked as a
  plain function. Moved to a plain module; the client component now imports the type from it.
- **`src/components/quotations/proposal-content-fields.tsx`** (new, shared): Company Introduction,
  Vision/Mission/How We Perceive Ourselves, and six named clauses (Delivery/Inspection/Cancellation/
  Demurrage/Warranty/Force Majeure) - one component reused by both Settings -> Company (company-wide
  defaults) and the Quotation form (per-quotation override, pre-filled from those defaults).
- **Quotation print view**: added the client's billing address, a "Company Introduction" paragraph
  and "Our Corporate Philosophy" section (Vision/Mission/How We Perceive Ourselves - shown for any
  quotation type, not just solar, since this narrative content isn't equipment-specific), a "Design
  Inputs" table inside Technical Details (solar-gated, alongside the existing spec tables), the six
  named clauses under Terms & Conditions (rendered above the existing free-text field, not replacing
  it), and "Amount in Words" under the Grand Total (reusing the `amountInWords()` helper already built
  for the invoice work - this had been missed in the first quotation-layout pass).
- **Pagination fixes found during visual QA** (a full PDF export of a realistic `ON_GRID_SOLAR`
  quotation - "Mr. Navneet Singh", 555 Wp x 18 modules, 10 kW inverter, per the user's test-data
  spec): the bank-details/signature footer's `print:break-inside-avoid` pushed the *entire* block to
  an otherwise near-blank trailing page when it didn't quite fit the remaining space on the page
  before it; removed that block-level guard and applied a tighter one to just the small "Bank
  Details" paragraph group instead. Separately, the "Technical Details" heading was getting orphaned
  alone at the bottom of a page with all its content starting the next page; fixed with
  `print:break-after-avoid` on that heading and on "Our Corporate Philosophy".
- **Regression-tested** the full existing conversion chain end-to-end after these changes: Quotation
  (Duplicate, Create Revision - both correctly carry the two new fields forward) -> approve -> Create
  Sales Order -> Confirm -> Create Invoice -> Mark as Issued. One real thing this surfaced along the
  way: confirming the test Sales Order initially failed with a genuine, pre-existing, correct
  application error ("insufficient stock") because earlier test data in this same session had already
  reserved all available stock of the test products - not a regression, just this session's demo data
  needing a top-up (`Stock In`) before the chain could be re-verified end to end. The resulting
  invoice's own print view (CGST/SGST split, totals) was double-checked and is unaffected by any of
  this work.
- **Known limitations / explicitly deferred** (see the audit's Gap Analysis for the full reasoning):
  Company Introduction/Philosophy/named clauses are free text, not a rich template system; no
  product-master-linked spec snapshotting or wattage-vs-capacity mismatch warning; no structured,
  percentage-validated payment-milestone table (still a single free-text `paymentTerms` field); no
  multi-bank-account support; the CGST/SGST/IGST tax breakdown built for the Invoice print view was
  **not** ported to the Quotation print view, which still shows one blended "GST / Tax" figure - out
  of this round's agreed Phase A scope, flagged rather than silently included or silently skipped.
  (The "no separate cover/branding pages" limitation noted here originally no longer applies to
  Solar quotations - see the 8-page rewrite immediately below; it still applies to every other
  quotation type, which keeps the compact continuous layout.)

## Post-baseline change: 8-page Solar proposal layout (literal reference reproduction)

A third, much stricter round on the same reference material: the user explicitly asked for a
*literal* visual reproduction of the on-grid reference document's page-by-page structure (repeated
letterhead, forced page breaks, an 8-page flow), not the "structural reference only" interpretation
the two rounds above used - and explicitly required a written analysis before any code, which was
delivered and confirmed via two `AskUserQuestion` prompts before implementation.

- **Forensic finding #1**: the reference `.doc` has **no embedded logo images anywhere** - verified
  two ways (converting to `.docx` and inspecting for image relationships: none; scanning the raw
  binary for PNG signatures: found 9, every one a ~1-2KB generic Word "embedded object" placeholder
  icon, not a brand mark). Its letterhead is plain formatted text. The user chose text-only for the
  "Kirloskar" side (no fabricated trademark graphic); the existing `public/logo.png` (Shanvi
  Enterprises "SE" mark, already used in the sidebar/login page) is used on the cover page.
- **Forensic finding #2**: the source's "8 pages" are mostly a Word pagination artifact - the same
  letterhead block repeats ~7 times through the raw text, which is what actually produces the page
  count, not 8 deliberately-designed unique pages. Confirmed and reproduced deliberately: the new
  layout repeats a `Letterhead` component at the top of pages 2-8.
- **`quotation-print-view.tsx` now branches by type**: `ON_GRID_SOLAR` / `OFF_GRID_SOLAR` /
  `HYBRID_SOLAR` render a new `EightPageSolarProposal` (forced `print:break-before-page` per section:
  cover / letterhead-only branding page / intro letter / corporate philosophy / commercial+payment+
  bank / terms & conditions / design inputs+technical details / installation included+excluded).
  Every other quotation type is completely unaffected - still the compact continuous layout from the
  previous two rounds (verified by re-screenshotting the existing `EQUIPMENT_SUPPLY` test quotation).
  No schema changes - reuses every field added in the Phase A round above.
- Forced page breaks use plain CSS (`break-before: page`, Tailwind `break-before-page`) - fully
  supported by Chrome in both interactive print and headless PDF export, so this still required
  **zero new dependencies**, consistent with the browser-print architecture used everywhere else in
  the app. This is a different CSS property from repeated running headers/page-numbers (which do
  need a new PDF engine and which the user already chose to skip in the prior round) - forcing a
  page break at a specific element doesn't have that limitation.
- A `PageDivider` (`print:hidden`) marks where each forced break falls in the on-screen preview only,
  so it's easy to see the page plan while editing without affecting the printed/PDF output.
- Verified with a full 8-page PDF export of the real `Navneet Singh` / 10 kW / 555 Wp x 18 / 10 kW
  test quotation from the prior rounds (including its revision, to confirm the snapshot fields still
  carry through): all 8 pages present, correct dynamic title ("10 kW ON-GRID", never the reference's
  own erroneous "20 KW"), no clipping/overlap, letterhead correctly repeated, logo correctly placed
  only on the cover.

## Post-baseline change: real letterhead artwork on every page

Immediate follow-up to the 8-page rewrite above: the user supplied the company's actual letterhead
file (`Shanvi_letter head.pdf`) and its constituent images, and asked for that exact artwork - not a
reconstructed text header - on every page of the quotation, not just the cover.

- **`public/quotation-letterhead.png`** (new asset): extracted directly from the supplied PDF with
  PyMuPDF (`page.get_images()` + `doc.extract_image()`) at full quality (2544x3296 PNG) - the whole
  letterhead turned out to be a single flattened image (logo top-left, "Kirloskar" mark top-right,
  decorative copper/teal ribbon bottom-right all baked into one picture, not three separate
  assets), confirmed by inspecting `page.get_images(full=True)` and finding exactly one image on
  the page. Used as-is; nothing was redrawn or recreated.
  Company text info (name/tagline/address/email/phone/website) isn't part of the artwork, so it's
  still rendered as text underneath it, per page.
- **`LetterheadPage`** (replaces the old text-only `Letterhead` component): a full physical page -
  `backgroundSize: 100% 100%` over a `minHeight: 277mm` box (A4 content height after the existing
  10mm `@page` margins) - with padding tuned to clear the artwork's logo band (top) and ribbon
  (bottom): 40mm top / 35mm bottom, reached after two rounds of visual tuning (see below). Used on
  every page of both the 8/9-page Solar layout *and* the compact continuous layout for every other
  quotation type - the user asked for it applied to "the entire quotation," not just Solar.
- **Two real overflow bugs found and fixed during visual QA** (both the same failure shape: a
  `LetterheadPage`'s content exceeded the ~200mm usable height once top+bottom clearance is
  subtracted from 277mm, so the overflow spilled onto a fresh physical page with **no background at
  all** - CSS doesn't repeat a `background-image` across a forced page break, it only fills the one
  box it's attached to):
  1. On the Solar layout, Page 5 (commercial box + full line-items table + totals + payment terms +
     bank details + signature) was too dense for one page. Fixed by giving Bank Details + signature
     their own explicit page (now page 6; subsequent pages renumbered 7/8/9) rather than letting it
     overflow uncontrolled - consistent with the "controlled page breaks, not accidental overflow"
     principle the whole layout is built on.
  2. The same shape of bug hit the compact (non-Solar) layout too, which wraps its entire body in a
     single `LetterheadPage` with no internal page divisions - even a short quotation's trailing
     "Standard terms and conditions apply." line spilled onto an unstyled page. Fixed the same way:
     Bank Details + signature moved to their own dedicated `LetterheadPage`.
  3. A third, smaller issue: the artwork's logo already has "SHANVI ENTERPRISES" text baked into it,
     and the separately-rendered text heading directly beneath it initially sat too close (30mm
     top padding) - visually crowded/near-overlapping, confirmed via a close-up screenshot crop, not
     just the full-page PDF thumbnail. Fixed by increasing top padding to 40mm.
- Bottom padding was iteratively reduced (was 62mm from a rough estimate of the ribbon's extent in
  the source image, down to 35mm) once it became clear 62mm's estimate was too conservative -
  verified after each reduction that the ribbon still never visually touches content on any of the
  11 total pages checked (9 Solar + 2 compact) across this round.
- **Known limitation, explicitly accepted rather than solved**: this is a fundamentally static,
  CSS-only layout (per the standing "no new PDF dependency" decision) - a `LetterheadPage` whose
  *own* content is long enough to exceed ~200mm (e.g., an unusually long Terms & Conditions or a
  large BOQ) can still overflow onto an unstyled trailing page. The two known instances of this were
  fixed by moving Bank Details to its own page; a future instance in some other section would need
  the same manual treatment - there's no general fix within this architecture.

## Post-baseline change: Diesel Generator (DG) proposal layout

Follow-up round using a real dealer proposal (`CPCB-4 (57 to 160) KVA (2).doc`, a channel-partner
DG quotation) as the reference, for the existing `DIESEL_GENERATOR` quotation type - which
previously had no dedicated print layout and fell back to a generic key/value dump of whatever was
in `technicalConfigJson`.

- **Forensic reading of the reference** (`strings -n 6` on the legacy `.doc`, same toolchain as the
  Solar rounds): a formal cover letter followed by 9 numbered Annexures (Our Promise, Salient
  Features, Investment Details, Commercial T&C with 12 clauses, Warranty Terms, Service Networks,
  Customer Solution Centre, Authorized Dealer Certificate, Company Profile). Also found the same
  kind of internal inconsistency seen in the earlier on-grid reference ("20 KW" title vs. "10 kW"
  body): this DG reference's Subject line says "125 kVA" while its own Investment Details line item
  says "160 kVA." Confirms, again, that neither value may ever be hardcoded - capacity is always
  read from the quotation's own `technicalConfigJson`.
- **`technical-config-section.tsx`**: the DG field set was expanded from a flat, thin set (capacity,
  model, fuel type, AMF/sync/installation, warranty, notes) to a structured one matching what the
  reference document actually describes a DG line item as ("KIRLOSKAR 160 kVA 3Phase DG set with
  Engine Model 6K1080ETA4G1 & coupled with KG-make Alternator Water Cooled with Standard Panel,
  Acoustic Enclosure & Base frame"). Added under a "DG Set" heading: `dgManufacturer`, `phase`,
  `emissionNorm`, `alternatorMake`, `coolingType`, `panelType`, `enclosureType` (existing
  `dgCapacityKva`/`dgModel`/`fuelType`/`warranty` kept). Added two new free-text multi-line fields,
  `dgFeatures` ("Salient Features") and `dgTermsOfSupply` ("Terms of Supply"), mirroring the
  existing `installationIncluded`/`installationExcluded` free-text pattern from the Solar section
  rather than inventing a new mechanism.
- **`quotation-print-view.tsx`**: added a third top-level layout branch, `DgProposal`, alongside the
  existing `EightPageSolarProposal` (for `isSolar`) and the compact continuous layout (everything
  else). `DIESEL_GENERATOR` quotations now always render `DgProposal` and never reach the compact
  layout, so the old DG-specific generic key/value dump branch (and the now-fully-unused `labelize`
  helper it depended on) was deleted rather than left dead.
- **`DgProposal` structure** - 6 letterhead-branded pages, all reusing the same `LetterheadPage` /
  `BankDetailsBlock` / `SpecTable` / `MultilineList` / `standardClauses` / `proposal.introduction`
  infrastructure built for Solar (no parallel architecture):
  1. Cover letter - Ref No./Date, customer address, Subject (the quotation's own free-text
     `subject` field - not auto-generated, since the reference's subject line is itself
     free-form prose), `proposal.introduction`, closing signature.
  2. Salient Features (conditional on `config.dgFeatures`).
  3. Investment Details - reuses the existing line-items table/totals/amount-in-words rather than
     inventing new commercial fields, plus Terms of Supply (conditional) and Payment Terms.
  4. Bank Details + signature, given its **own dedicated page from the start** this time (not
     discovered as a bug and fixed after the fact, as with Solar) - applying the lesson learned
     twice already in this project: a commercial/line-items page plus bank details reliably
     overflows a single `LetterheadPage`.
  5. Commercial Terms & Conditions - reuses the same 6 named clauses + `termsAndConditions`
     catch-all as Solar's T&C page, rather than building the reference's 12 distinct clause types
     as new structured fields.
  6. Technical Details - a `SpecTable` of all the DG fields plus the Requirements block (AMF/
     synchronization/installation).
  Deliberately **not built**: pages for the reference's purely marketing/graphic Annexures (Our
  Promise, Service Networks, Customer Solution Centre, Authorized Dealer Certificate, Company
  Profile) - none of them have corresponding dynamic data in the system, and building them would
  mean hardcoding Kirloskar-specific marketing copy as if it were the application's own content,
  which the user's own principle from the earlier Kirloskar-logo round already ruled out.
- **Verification**: `npx tsc --noEmit`, `npm run lint`, and `npm run build` all clean. Created a
  real end-to-end `DIESEL_GENERATOR` test quotation (QTN-0013) via Playwright using the reference's
  actual values (KIRLOSKAR, 160 kVA, 3 Phase, CPCB IV+, engine model 6K1080ETA4G1, KG-make
  alternator, Water Cooled, Standard Panel, Acoustic Enclosure, "2 years or 5000 hours, whichever is
  earlier"), exported a real 6-page PDF, and read every page: letterhead correctly repeated on all
  6 pages, no clipping/overlap/overflow anywhere, dynamic capacity/manufacturer correctly reflected
  in the Subject line and Technical Details, no unstyled trailing pages. Also re-exported one
  existing Solar quotation (9 pages, unaffected) and one existing compact-layout `EQUIPMENT_SUPPLY`
  quotation (2 pages, unaffected) to confirm no regression from the new branch.

## Post-baseline change: DG-specific commercial terms, warranty annexure, and certificate page

Follow-up round to the DG proposal layout above, prompted by re-sharing the same 3 reference
documents (On-Grid, Off-Grid, CPCB DG) for a fresh verification pass. The verification found 3/3
PASS on structure/dynamic-data/print-quality, but flagged 2 known, already-logged content gaps in
the DG layout - the user asked to close both, plus add the reference's Annexure 8 certificate page.

- **Forensic finding on the certificate**: the reference's "Annexure 8: Authorized dealer
  certificate" contains almost no reproducible text - just a heading, the company's GSTIN, and an
  `EMBED AcroExch.Document.7` OLE object with placeholder text "INSERT YOUR LOGO" next to it. Carved
  the embedded object directly out of the raw `.doc` binary (found via a `%PDF-` signature scan of
  the file, same byte-scanning technique used for the earlier logo forensics) and rendered it - it
  turned out to be nothing more than a close-up photo of the same Shanvi Enterprises logo already
  baked into `quotation-letterhead.png`, not a distinct certificate artwork. So there is no separate
  image asset to extract for this page (unlike the letterhead itself); the certificate is
  functionally just a certifying statement plus the already-present letterhead/GSTIN.
- **New `technical-config-section.tsx` fields**, all under the existing DG-only branch:
  - "Warranty & Service": `dgFreeServiceChecks` (single-line) and `dgWarrantyConditions`
    (multi-line bullet list) - richer than the single `warranty` field, matching the reference's
    separate Annexure 5 (manufacturer warranty duration + free service-check entitlement + a
    standard-conditions bullet list).
  - "Commercial Terms & Conditions (DG-specific)": 12 new `dgTc*` textareas (Prices / Freight &
    Transit Insurance / GST / Delivery / Payment Terms / Offer Validity / Statutory Variations /
    Exclusions / Installation & Commissioning / Force Majeure / Storage & Interest Charges /
    Arbitration), matching the reference's Annexure 4 clause-for-clause. Placeholders are drawn from
    the reference's own clause wording since these are generic commercial/legal boilerplate (not
    manufacturer marketing copy), but every field starts empty and only what the user actually types
    is ever rendered.
  - "Authorized Dealer / Channel Partner Certificate": one `dgCertificateText` free-text field for
    the certifying statement itself (e.g. "This is to certify that [Company] is an Authorized
    Channel Partner of [Manufacturer]...") - kept free-text and user-editable rather than
    synthesized, consistent with the standing "don't hardcode brand-specific claims" principle,
    since only the company itself can state who it's actually an authorized dealer for.
- **`DgProposal` changes** in `quotation-print-view.tsx`:
  - Page 5 (Commercial Terms & Conditions) now renders the 12 new `dgTc*` fields (numbered 1-12,
    matching the reference) instead of reusing the 6 generic Solar-shared `standardClauses`. Falls
    back to `standardClauses` only if none of the 12 DG-specific fields are filled, so quotations
    created before this round still show something rather than an empty section.
  - New Page 6, "Warranty Terms & Conditions": a dynamically-composed manufacturer-warranty sentence
    (never hardcodes a manufacturer name - reads `config.dgManufacturer`), the free-service-checks
    line, and a bulleted Standard Conditions list.
  - Page 7 is the pre-existing Technical Details page, renumbered (was Page 6).
  - New Page 8 (last page), "Authorized Channel Partner Certificate": renders `dgCertificateText`
    plus the company's GSTIN. Gated on `dgCertificateText` being filled, so it's entirely optional.
- **Verification**: `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean. Updated the
  existing DG test quotation (QTN-0013) via Playwright with real values for all new fields
  (including all 12 commercial clauses, using the reference document's own clause text as a
  starting point) and re-exported the PDF: now 8 pages (was 6), all 12 clauses fit on a single
  Commercial T&C page with no overflow, Warranty/Technical Details/Certificate pages all render
  cleanly with the letterhead correctly repeated and no clipping. Re-checked the existing On-Grid
  Solar test quotation (still 8 pages) to confirm the Solar layout - untouched by this round - has
  no regression.

## Recommended next phase

There is no next development phase queued. Per the MVP freeze:

1. **Shanvi Enterprises UAT/pilot** using `SHANVI_UAT_CHECKLIST.md` is the next activity - not more feature development.
2. Any issue found during UAT gets classified P0-P3 (see `SHANVI_UAT_CHECKLIST.md`) and P0/P1 issues are fixed as they come up; P2 only if it blocks the pilot; P3 and new feature ideas go into `POST_MVP_BACKLOG.md`.
3. Once the pilot is complete and Shanvi decides to expand scope, treat whatever comes next as its own phase (see `POST_MVP_BACKLOG.md` for candidates, e.g. weighted-average inventory costing or AMC renewal automation) - inspect, plan, implement, test, document, exactly as every phase before this one did.

## Next Activity

**Controlled Shanvi UAT** - baseline commit `395521d6fcd9c28772385e997dd0c9c64568c841`, tag
`v1.0.0`. Do not begin implementation of anything new until the user names it explicitly, and any
change made during UAT should land as a new commit on top of this baseline, never by editing
history.
