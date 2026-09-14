export const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "SENT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "FULLY_RECEIVED",
  "CANCELLED",
  "CLOSED",
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  CONFIRMED: "Confirmed",
  PARTIALLY_RECEIVED: "Partially Received",
  FULLY_RECEIVED: "Fully Received",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
};

// Allowed *manual* next statuses from each current status. PARTIALLY_RECEIVED
// and FULLY_RECEIVED are only ever set by the receiving action (see
// purchase-orders/ledger.ts), never by a "Mark as" button — so they don't
// appear as a target here even though they're reachable states.
export const PURCHASE_ORDER_STATUS_TRANSITIONS: Record<PurchaseOrderStatus, readonly PurchaseOrderStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  PARTIALLY_RECEIVED: [],
  FULLY_RECEIVED: ["CLOSED"],
  CANCELLED: [],
  CLOSED: [],
};

// A PO can be received against once it's been confirmed with the vendor —
// not while still Draft/Sent, and not once cancelled/closed.
export const RECEIVABLE_PO_STATUSES: readonly PurchaseOrderStatus[] = ["CONFIRMED", "PARTIALLY_RECEIVED"];

// A vendor invoice can be created once the vendor has committed to the
// order — Draft/Sent/Cancelled POs can't yet (or can no longer) be billed.
export const INVOICEABLE_PO_STATUSES: readonly PurchaseOrderStatus[] = [
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "FULLY_RECEIVED",
];

export const PURCHASE_ORDER_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "items", label: "Items" },
  { key: "pricing", label: "Pricing" },
  { key: "receipts", label: "Receipts" },
  { key: "invoices", label: "Invoices" },
  { key: "activity", label: "Activity" },
] as const;
export type PurchaseOrderDetailTabKey = (typeof PURCHASE_ORDER_DETAIL_TABS)[number]["key"];

const TAB_KEYS = PURCHASE_ORDER_DETAIL_TABS.map((t) => t.key);
export function isPurchaseOrderDetailTabKey(value: string): value is PurchaseOrderDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
