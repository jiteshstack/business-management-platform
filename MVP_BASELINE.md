# MVP Baseline - Energy MVP v1.0

This is the frozen reference for what the Energy Solutions MVP includes. It exists so future work
can be judged against a known, agreed scope instead of drifting - anything not listed here is
either a deliberate exclusion (see "Explicitly Out Of Scope") or a candidate for
`POST_MVP_BACKLOG.md`, not something to add quietly during bug-fixing or polish.

## Product

Business Management Platform

## Active Vertical

Energy Solutions

## Tenant

Shanvi Enterprises

## Version

**Energy MVP v1.0**

- Date frozen: 2026-09-14
- `package.json` version: `1.0.0`
- Database migration state: 10 migrations, all applying cleanly from an empty database
  (verified by running `prisma migrate deploy` against a fresh SQLite file - see
  `PRODUCTION_RUNBOOK.md` for the command).
- Environment: local development (SQLite, Next.js dev server). Not yet deployed to any hosted
  environment - see "Deployment Status" in the final handoff report.
- Source control: this working copy is a local-only Git repository (`main` branch, no remote).
  Baseline tag `v1.0.0` (annotated) marks the exact commit this document describes - see the
  Version Control section of `PROJECT_STATE.md` for the commit hash and details. `v1.0.0` is
  frozen: do not move the tag or amend the baseline commit. Bug fixes get new commits (and,
  eventually, a new patch tag such as `v1.0.1`); new features go into `POST_MVP_BACKLOG.md` first,
  never straight into a commit.

## Included Modules

1. Authentication (JWT session cookies, bcrypt password hashing)
2. Company / Tenant (single active tenant: Shanvi Enterprises; architecture supports more)
3. Users / Roles / Permissions (8 fixed roles, module-level + action-level permission checks)
4. Customers / Vendors / Contacts (shared Party model, addresses, notes, documents)
5. Products (categories, brands, units, serial tracking, purchase/selling price)
6. Inventory (stock ledger, stock movements, serial number lifecycle, locations)
7. Energy Quotations (revisions, PDF/print, technical config)
8. Sales Orders
9. Energy Invoices
10. Customer Payments (full/partial/multiple/advance, allocation)
11. Receivables (with ageing)
12. Customer Ledger
13. Purchase Orders
14. Purchase Receipts (partial/full receiving into inventory)
15. Vendor Invoices
16. Vendor Payments (full/partial/multiple/advance, allocation)
17. Vendor Payables (with ageing)
18. Vendor Ledger
19. Projects (Energy execution projects, linked to a confirmed Sales Order)
20. Sites (reusable customer installation locations)
21. Installations (scheduling, checklist, completion)
22. Installed Equipment (registry created automatically on installation completion)
23. Warranty (equipment/project-level, computed status)
24. AMC - Annual Maintenance Contracts (visit tracking, computed status)
25. Service Requests (assignment, scheduling, resolution workflow)
26. Maintenance Visits (checklist, findings, parts consumption)
27. Expenses (categorized, approval + minimal payment tracking, project/site linkage)
28. Profitability (project- and customer-level, estimated/operational)
29. Management Dashboard (sales, receivables, payables, purchases, expenses, estimated
    gross profit, trend, warranty/AMC/service KPIs)
30. Reports (Sales, Collections, Purchases, Projects, Service, Expenses - with CSV export
    for the highest-priority views)

## Frozen Business Workflows

### Sales

Quotation → Sales Order → Invoice → Customer Payment → Receivable → Customer Ledger

### Purchasing

Purchase Order → Purchase Receipt → Vendor Invoice → Vendor Payment → Payable → Vendor Ledger

### Energy Operations

Sales Order → Project → Site → Equipment (scope items) → Installation → Installed Equipment

### After-Sales

Installed Equipment → Warranty / AMC → Service Request → Maintenance Visit → Service History

### Management

Transactions (Sales/Purchases/Payments/Expenses) → Expenses → Profitability → Dashboard → Reports

## Explicitly Out Of Scope (MVP v1.0)

Not implemented, and not to be added without an explicit new phase:

- Pharma vertical (or any vertical other than Energy Solutions)
- Full accounting / General Ledger / Chart of Accounts / Journal Entries / Trial Balance /
  Balance Sheet / statutory Profit & Loss
- GST return filing, TDS, payroll, bank reconciliation
- Advanced CRM, advanced helpdesk / call-center system
- Technician mobile app, GPS tracking, IoT monitoring / real-time telemetry
- Advanced project costing engine (weighted-average/FIFO inventory costing does not exist -
  see the Financial Disclaimer below)
- Advanced warehouse management (multi-step putaway, bin-level tracking, etc.)
- Payment gateway integration
- WhatsApp / SMS integration
- AI forecasting / advanced analytics / BI data warehouse
- Automatic AMC renewal, subscription billing
- Advanced procurement workflows (requisition/approval chains, supplier bidding)
- Credit/Debit Notes, multi-currency accounting
- A data import system (see `PRODUCTION_RUNBOOK.md` for the manual opening-balance approach)

## Architecture Freeze

### Platform Core (vertical-agnostic, reusable by a future non-Energy vertical)

Authentication, tenancy, users, roles, permissions, parties (customers/vendors), the generic
document-numbering sequence generator, the generic Document/attachment model, the audit log, and
the shared money-math helpers (`round2`, `calculateLineItem`, `calculateDocumentTotals`).

### Energy Domain (vertical-specific)

Products/inventory, quotations, sales orders, invoices, customer payments, purchasing, vendor
payables, projects, sites, installations, installed equipment, warranty, AMC, service requests,
maintenance visits, expenses, and Energy-specific reporting/profitability.

### Future Domains

A Pharma (or other) vertical would live alongside the Energy domain, sharing the Platform Core.
Nothing in the Energy domain should be assumed by the Platform Core, and nothing has been built
that hard-codes Energy-specific concepts into the core layer.

## Data Ownership Rules (source of truth)

| Concept | Source of truth |
|---|---|
| Customer / Vendor identity | Party module |
| Product identity, purchase price | Product Master |
| Stock on hand | Stock movements (`applyStockMovement`), never edited directly |
| Customer outstanding | Invoices + Customer Payment allocations |
| Vendor outstanding | Vendor Invoices + Vendor Payment allocations |
| Project revenue | The linked Sales Order's Invoices - never duplicated onto the Project |
| Project expenses | Expense records linked to the project |
| Service parts consumed | Stock movements (same ledger as all other stock changes) |
| Profitability (project/customer/company) | Computed live from the above at read time - never
  stored as a precomputed metric |

This list exists to stop a future phase from inventing a second place to store any of these
figures. If a number can be derived from existing transactions, it must be - not cached.

## Financial Disclaimer

All profitability and "gross profit"/"margin" figures in this application are **estimated /
operational** approximations for management visibility, not statutory accounting output:

- Company-wide figures use `Sales (invoiced) - Purchases (vendor invoiced) - Expenses`.
- Project/customer figures use installed-quantity material cost (`Product.purchasePrice`, a single
  price point - there is no weighted-average/FIFO inventory costing in this system).

This MVP is **not** a replacement for a statutory accounting system, and its numbers should never
be presented to a tax authority, auditor, or lender as final accounting figures.
