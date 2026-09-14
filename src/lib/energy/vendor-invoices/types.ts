// Mirrors customer Invoice's status set (DRAFT/ISSUED→UNPAID here/PARTIALLY_PAID/PAID/CANCELLED).
// "Overdue" is a computed badge, never a stored status — see status-badge.tsx.
export const VENDOR_INVOICE_STATUSES = ["DRAFT", "UNPAID", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;
export type VendorInvoiceStatus = (typeof VENDOR_INVOICE_STATUSES)[number];

export const VENDOR_INVOICE_STATUS_LABELS: Record<VendorInvoiceStatus, string> = {
  DRAFT: "Draft",
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const VENDOR_INVOICE_STATUS_TRANSITIONS: Record<VendorInvoiceStatus, readonly VendorInvoiceStatus[]> = {
  DRAFT: ["UNPAID", "CANCELLED"],
  UNPAID: ["CANCELLED"],
  PARTIALLY_PAID: [],
  PAID: [],
  CANCELLED: [],
};

export const VENDOR_INVOICE_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "items", label: "Items" },
  { key: "pricing", label: "Pricing" },
  { key: "payment", label: "Payment" },
  { key: "references", label: "References" },
  { key: "activity", label: "Activity" },
] as const;
export type VendorInvoiceDetailTabKey = (typeof VENDOR_INVOICE_DETAIL_TABS)[number]["key"];

const TAB_KEYS = VENDOR_INVOICE_DETAIL_TABS.map((t) => t.key);
export function isVendorInvoiceDetailTabKey(value: string): value is VendorInvoiceDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
