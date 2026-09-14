export const WARRANTY_TYPES = ["MANUFACTURER", "SUPPLIER", "INSTALLATION", "EXTENDED", "OTHER"] as const;
export type WarrantyType = (typeof WARRANTY_TYPES)[number];

export const WARRANTY_TYPE_LABELS: Record<WarrantyType, string> = {
  MANUFACTURER: "Manufacturer Warranty",
  SUPPLIER: "Supplier Warranty",
  INSTALLATION: "Installation Warranty",
  EXTENDED: "Extended Warranty",
  OTHER: "Other",
};

// Displayed status is always derived from dates, never typed by a user —
// CANCELLED is the one exception, an explicit action stored on the record.
export const WARRANTY_DISPLAY_STATUSES = ["NOT_STARTED", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "CANCELLED"] as const;
export type WarrantyDisplayStatus = (typeof WARRANTY_DISPLAY_STATUSES)[number];

export const WARRANTY_DISPLAY_STATUS_LABELS: Record<WarrantyDisplayStatus, string> = {
  NOT_STARTED: "Not Started",
  ACTIVE: "Active",
  EXPIRING_SOON: "Expiring Soon",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

// Default "expiring soon" threshold — configurable per call, 30 days by
// default per the spec's suggested MVP default.
export const DEFAULT_EXPIRY_THRESHOLD_DAYS = 30;

export function computeWarrantyStatus(
  warranty: { status: string; startDate: Date; endDate: Date },
  now: Date = new Date(),
  thresholdDays: number = DEFAULT_EXPIRY_THRESHOLD_DAYS
): WarrantyDisplayStatus {
  if (warranty.status === "CANCELLED") return "CANCELLED";
  if (now.getTime() < warranty.startDate.getTime()) return "NOT_STARTED";
  if (now.getTime() > warranty.endDate.getTime()) return "EXPIRED";
  const msRemaining = warranty.endDate.getTime() - now.getTime();
  if (msRemaining <= thresholdDays * 24 * 60 * 60 * 1000) return "EXPIRING_SOON";
  return "ACTIVE";
}

export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export const WARRANTY_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "service", label: "Service History" },
  { key: "activity", label: "Activity" },
] as const;
export type WarrantyDetailTabKey = (typeof WARRANTY_DETAIL_TABS)[number]["key"];
const TAB_KEYS = WARRANTY_DETAIL_TABS.map((t) => t.key);
export function isWarrantyDetailTabKey(value: string): value is WarrantyDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
