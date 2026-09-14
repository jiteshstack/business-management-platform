// Full lifecycle per the data model, but only DRAFT / ISSUED / CANCELLED are
// reachable this phase — PARTIALLY_PAID / PAID / OVERDUE require the
// Payments module (Phase 6), not built yet.
export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

// Only the transitions reachable without Payments exist here.
export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["CANCELLED"],
  PARTIALLY_PAID: [],
  PAID: [],
  OVERDUE: [],
  CANCELLED: [],
};

export const INVOICE_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "items", label: "Items" },
  { key: "pricing", label: "Pricing" },
  { key: "payment", label: "Payment" },
  { key: "references", label: "References" },
  { key: "activity", label: "Activity" },
] as const;
export type InvoiceDetailTabKey = (typeof INVOICE_DETAIL_TABS)[number]["key"];

const TAB_KEYS = INVOICE_DETAIL_TABS.map((t) => t.key);
export function isInvoiceDetailTabKey(value: string): value is InvoiceDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
