import { Badge } from "@/components/ui/badge";
import { VENDOR_PAYMENT_STATUS_LABELS, type VendorPaymentStatus } from "@/lib/energy/vendor-payments/types";

const VARIANT: Record<VendorPaymentStatus, "neutral" | "success" | "warning" | "danger"> = {
  UNALLOCATED: "neutral",
  PARTIALLY_ALLOCATED: "warning",
  ALLOCATED: "success",
  CANCELLED: "danger",
};

export function VendorPaymentStatusBadge({ status }: { status: string }) {
  const key = status as VendorPaymentStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{VENDOR_PAYMENT_STATUS_LABELS[key] ?? status}</Badge>;
}
