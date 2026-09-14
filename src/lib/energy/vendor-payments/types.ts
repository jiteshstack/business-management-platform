// Reuses the exact same payment-mode vocabulary as customer Payments —
// re-exported here so vendor-payments code doesn't reach into the sales
// module, while still being the identical single source of truth.
export { PAYMENT_MODES, PAYMENT_MODE_LABELS, type PaymentMode } from "@/lib/energy/payments/types";

export const VENDOR_PAYMENT_STATUSES = ["UNALLOCATED", "PARTIALLY_ALLOCATED", "ALLOCATED", "CANCELLED"] as const;
export type VendorPaymentStatus = (typeof VENDOR_PAYMENT_STATUSES)[number];

export const VENDOR_PAYMENT_STATUS_LABELS: Record<VendorPaymentStatus, string> = {
  UNALLOCATED: "Unallocated",
  PARTIALLY_ALLOCATED: "Partially Allocated",
  ALLOCATED: "Allocated",
  CANCELLED: "Cancelled",
};

export const VENDOR_PAYMENT_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "allocations", label: "Allocations" },
  { key: "activity", label: "Activity" },
] as const;
export type VendorPaymentDetailTabKey = (typeof VENDOR_PAYMENT_DETAIL_TABS)[number]["key"];

const TAB_KEYS = VENDOR_PAYMENT_DETAIL_TABS.map((t) => t.key);
export function isVendorPaymentDetailTabKey(value: string): value is VendorPaymentDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}

// Vendor-payable ageing reuses the exact same bucket vocabulary/logic as
// customer receivables ageing.
export {
  AGEING_BUCKETS,
  AGEING_BUCKET_LABELS,
  ageingBucketForDueDate,
  type AgeingBucket,
} from "@/lib/energy/payments/types";

export const VENDOR_LEDGER_ENTRY_TYPES = ["VENDOR_INVOICE", "VENDOR_PAYMENT", "VENDOR_PAYMENT_CANCELLED"] as const;
export type VendorLedgerEntryType = (typeof VENDOR_LEDGER_ENTRY_TYPES)[number];
