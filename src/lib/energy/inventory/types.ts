export const PRODUCT_TYPES = ["EQUIPMENT", "MATERIAL", "SERVICE"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  EQUIPMENT: "Equipment",
  MATERIAL: "Material",
  SERVICE: "Service",
};

export const MOVEMENT_TYPES = [
  "STOCK_IN",
  "STOCK_OUT",
  "RESERVE",
  "RESERVE_RELEASE",
  "ADJUST_INCREASE",
  "ADJUST_DECREASE",
  "DAMAGE",
  "RETURN",
  "OPENING_STOCK",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  STOCK_IN: "Stock In",
  STOCK_OUT: "Stock Out",
  RESERVE: "Reservation",
  RESERVE_RELEASE: "Reservation Release",
  ADJUST_INCREASE: "Adjustment Increase",
  ADJUST_DECREASE: "Adjustment Decrease",
  DAMAGE: "Damage",
  RETURN: "Return",
  OPENING_STOCK: "Opening Stock",
};

// Movements that increase totalQty vs. decrease it — used to render a
// consistent +/- sign in the movement history table.
export const MOVEMENT_INCREASES_TOTAL: readonly MovementType[] = [
  "STOCK_IN",
  "ADJUST_INCREASE",
  "RETURN",
  "OPENING_STOCK",
];
export const MOVEMENT_DECREASES_TOTAL: readonly MovementType[] = ["STOCK_OUT", "ADJUST_DECREASE"];

export const SERIAL_STATUSES = [
  "IN_STOCK",
  "RESERVED",
  "ASSIGNED",
  "INSTALLED",
  "DAMAGED",
  "RETURNED",
  "UNDER_SERVICE",
  "RETIRED",
] as const;
export type SerialStatus = (typeof SERIAL_STATUSES)[number];

export const SERIAL_STATUS_LABELS: Record<SerialStatus, string> = {
  IN_STOCK: "In Stock",
  RESERVED: "Reserved",
  ASSIGNED: "Assigned",
  INSTALLED: "Installed",
  DAMAGED: "Damaged",
  RETURNED: "Returned",
  UNDER_SERVICE: "Under Service",
  RETIRED: "Retired",
};

export const PRODUCT_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "inventory", label: "Inventory" },
  { key: "movements", label: "Stock Movements" },
  { key: "serials", label: "Serial Numbers" },
  { key: "vendors", label: "Vendors" },
  { key: "transactions", label: "Transactions" },
] as const;
export type ProductDetailTabKey = (typeof PRODUCT_DETAIL_TABS)[number]["key"];

const TAB_KEYS = PRODUCT_DETAIL_TABS.map((t) => t.key);
export function isProductDetailTabKey(value: string): value is ProductDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}

// Tabs with real data/actions in this phase.
export const IMPLEMENTED_PRODUCT_TABS: readonly ProductDetailTabKey[] = [
  "overview",
  "inventory",
  "movements",
  "serials",
  "vendors",
];
