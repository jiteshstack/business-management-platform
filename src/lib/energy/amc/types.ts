export const BILLING_FREQUENCIES = ["ONE_TIME", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  ONE_TIME: "One-time",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  ANNUAL: "Annual",
};

// DRAFT is set manually (contract drawn up but not yet effective).
// ACTIVE/EXPIRING_SOON/EXPIRED are derived live from dates once a contract
// is no longer DRAFT. CANCELLED/COMPLETED are explicit user actions.
export const AMC_DISPLAY_STATUSES = ["DRAFT", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "CANCELLED", "COMPLETED"] as const;
export type AmcDisplayStatus = (typeof AMC_DISPLAY_STATUSES)[number];

export const AMC_DISPLAY_STATUS_LABELS: Record<AmcDisplayStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  EXPIRING_SOON: "Expiring Soon",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const DEFAULT_EXPIRY_THRESHOLD_DAYS = 30;

export function computeAmcStatus(
  amc: { status: string; startDate: Date; endDate: Date },
  now: Date = new Date(),
  thresholdDays: number = DEFAULT_EXPIRY_THRESHOLD_DAYS
): AmcDisplayStatus {
  if (amc.status === "CANCELLED" || amc.status === "COMPLETED" || amc.status === "DRAFT") {
    return amc.status as AmcDisplayStatus;
  }
  if (now.getTime() > amc.endDate.getTime()) return "EXPIRED";
  const msRemaining = amc.endDate.getTime() - now.getTime();
  if (msRemaining <= thresholdDays * 24 * 60 * 60 * 1000) return "EXPIRING_SOON";
  return "ACTIVE";
}

export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export const AMC_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "visits", label: "Visits" },
  { key: "service", label: "Service Requests" },
  { key: "activity", label: "Activity" },
] as const;
export type AmcDetailTabKey = (typeof AMC_DETAIL_TABS)[number]["key"];
const TAB_KEYS = AMC_DETAIL_TABS.map((t) => t.key);
export function isAmcDetailTabKey(value: string): value is AmcDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
