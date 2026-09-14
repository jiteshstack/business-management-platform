export const SALES_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_FULFILLED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PARTIALLY_FULFILLED: "Partially Fulfilled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Allowed next statuses from each current status — enforced server-side.
export const SALES_ORDER_STATUS_TRANSITIONS: Record<SalesOrderStatus, readonly SalesOrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PARTIALLY_FULFILLED", "COMPLETED", "CANCELLED"],
  PARTIALLY_FULFILLED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const SALES_ORDER_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "items", label: "Items" },
  { key: "pricing", label: "Pricing" },
  { key: "inventory", label: "Inventory" },
  { key: "invoices", label: "Invoices" },
  { key: "activity", label: "Activity" },
] as const;
export type SalesOrderDetailTabKey = (typeof SALES_ORDER_DETAIL_TABS)[number]["key"];

const TAB_KEYS = SALES_ORDER_DETAIL_TABS.map((t) => t.key);
export function isSalesOrderDetailTabKey(value: string): value is SalesOrderDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
