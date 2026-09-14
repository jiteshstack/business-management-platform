import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/energy/payments/types";

const VARIANT: Record<PaymentStatus, "neutral" | "success" | "warning" | "danger"> = {
  UNALLOCATED: "neutral",
  PARTIALLY_ALLOCATED: "warning",
  ALLOCATED: "success",
  CANCELLED: "danger",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const key = status as PaymentStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{PAYMENT_STATUS_LABELS[key] ?? status}</Badge>;
}
