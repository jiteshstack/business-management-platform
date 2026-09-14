export const PAYMENT_MODES = ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

// A payment's own status — how much of it has been put to use — is
// distinct from any invoice's payment status. Always recomputed from
// PaymentAllocation rows, never set directly (see ledger.ts).
export const PAYMENT_STATUSES = ["UNALLOCATED", "PARTIALLY_ALLOCATED", "ALLOCATED", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNALLOCATED: "Unallocated",
  PARTIALLY_ALLOCATED: "Partially Allocated",
  ALLOCATED: "Allocated",
  CANCELLED: "Cancelled",
};

export const PAYMENT_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "allocations", label: "Allocations" },
  { key: "activity", label: "Activity" },
] as const;
export type PaymentDetailTabKey = (typeof PAYMENT_DETAIL_TABS)[number]["key"];

const TAB_KEYS = PAYMENT_DETAIL_TABS.map((t) => t.key);
export function isPaymentDetailTabKey(value: string): value is PaymentDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}

// Ageing buckets for receivables — based on due date, not invoice date.
export const AGEING_BUCKETS = ["CURRENT", "DAYS_1_30", "DAYS_31_60", "DAYS_61_90", "DAYS_90_PLUS"] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

export const AGEING_BUCKET_LABELS: Record<AgeingBucket, string> = {
  CURRENT: "Current / Not Due",
  DAYS_1_30: "1–30 days overdue",
  DAYS_31_60: "31–60 days overdue",
  DAYS_61_90: "61–90 days overdue",
  DAYS_90_PLUS: "90+ days overdue",
};

export function ageingBucketForDueDate(dueDate: Date | null, now: Date = new Date()): AgeingBucket {
  if (!dueDate || dueDate.getTime() >= now.getTime()) return "CURRENT";
  const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
  if (daysOverdue <= 30) return "DAYS_1_30";
  if (daysOverdue <= 60) return "DAYS_31_60";
  if (daysOverdue <= 90) return "DAYS_61_90";
  return "DAYS_90_PLUS";
}

// Customer-facing ledger transaction types. A payment's credit is recorded
// once, at receipt — whether or not it is later allocated to an invoice —
// so an "advance" is never a second, separate credit entry.
export const LEDGER_ENTRY_TYPES = ["INVOICE", "PAYMENT", "PAYMENT_CANCELLED"] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];
