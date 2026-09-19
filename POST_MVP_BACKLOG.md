# Post-MVP Backlog

Ideas and requests that came up during development or UAT but were deliberately kept out of Energy
MVP v1.0. Nothing here is scheduled - this list exists so that good ideas aren't lost, without
letting them quietly expand the frozen MVP scope. See `MVP_BASELINE.md` for the freeze rule.

New requests (from UAT or otherwise) should be added here rather than implemented immediately,
unless they're a P0/P1 fix to something already promised in the MVP (see
`SHANVI_UAT_CHECKLIST.md`'s bug classification).

## Accounting & Finance

- Full accounting / General Ledger / Chart of Accounts / Journal Entries / Trial Balance / Balance
  Sheet
- GST return filing
- TDS handling
- Bank reconciliation
- Payment gateway integration
- Weighted-average or FIFO inventory costing (would materially improve profitability accuracy -
  see the Financial Disclaimer in `MVP_BASELINE.md`)
- Advanced project costing / full project P&L engine
- Multi-currency accounting
- Credit/Debit Notes

## Service & Field Operations

- Automatic AMC renewal workflow
- Technician mobile app
- GPS tracking / route planning for field visits
- IoT monitoring / real-time solar telemetry, automatic fault detection
- Advanced workforce scheduling
- Advanced SLA management for service requests

## Sales & Customer Engagement

- Advanced CRM (lead management, pipelines, campaigns)
- Advanced helpdesk / call-center system
- WhatsApp integration
- SMS integration
- Subscription billing

## Reporting & Analytics

- Advanced dashboards / configurable widgets
- Advanced analytics / BI / data warehouse
- AI-based forecasting
- CSV export for the remaining report types not yet covered (Service Summary, Maintenance
  Activity)
- Saved report filter presets

## Procurement & Inventory

- Advanced procurement workflows (requisition/approval chains, supplier bidding)
- Advanced warehouse management (bin-level tracking, multi-step putaway)
- Bulk data import tooling (customers/vendors/products/opening balances)

## Quotations / Proposals (Phase B - deferred from the On-Grid Solar proposal work)

- Product-Master-linked module/inverter/mounting specs with snapshot-on-finalize (specs currently
  live as free-text `technicalConfigJson` per quotation, not pulled from a spec-bearing product
  record)
- Wattage x quantity vs. system-capacity mismatch warning (validation only - never silently
  auto-correct a user-entered value)
- Structured, percentage-validated payment-milestone table (description + % + due condition,
  summing to 100%) instead of the current single free-text `paymentTerms` field
- Multiple bank accounts (Company currently has exactly one set of bank fields)
- CGST/SGST/IGST tax breakdown on the Quotation print view (already built for the Invoice print
  view - `splitTax()` in `invoice-print-view.tsx` - just not ported to quotations this round)
- Distinct cover/branding "pages" with running headers/footers/page numbers on every physical PDF
  page - requires server-side PDF rendering (Puppeteer/Playwright/pdf library), a new dependency
  the user explicitly chose not to add when asked; revisit if that trade-off changes
- Rich template system for Company Introduction / Corporate Philosophy / named clauses (currently
  plain free-text fields, no versioning or per-clause history)
- DG proposal marketing/graphic annexures (from the CPCB-4 DG reference round): "Our Promise",
  Service Networks map, Customer Solution Centre, Company Profile - none have corresponding dynamic
  data in the system today, so they weren't built rather than filling them with hardcoded
  brand-specific marketing copy. (The Authorized Dealer/Channel Partner Certificate annexure WAS
  built - see PROJECT_STATE.md - since the reference's version of it turned out to be just a
  certifying statement + GSTIN, not a distinct artwork.)

## Platform

- User self-service management UI (create/edit/deactivate users from within the app, rather than
  direct database access during initial setup)
- Company logo upload (GSTIN/PAN/address/bank details are now editable under Settings -> Company,
  added to support the GST tax invoice print layout)
- Multi-company / multi-vertical support beyond the current single Energy Solutions tenant
  (architecture supports it; no second vertical has been built)
- Pharma vertical (explicitly out of scope for this product line so far)

## Notes

- Nothing in this list has been scoped, estimated, or committed to. Before starting any of these,
  treat it as its own phase: inspect the current architecture, plan, implement, test, and update
  `PROJECT_STATE.md` - the same process every prior phase followed.
