import { Badge } from "@/components/ui/badge";
import { PURCHASE_ORDER_STATUS_LABELS, type PurchaseOrderStatus } from "@/lib/energy/purchase-orders/types";

const VARIANT: Record<PurchaseOrderStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SENT: "warning",
  CONFIRMED: "warning",
  PARTIALLY_RECEIVED: "warning",
  FULLY_RECEIVED: "success",
  CANCELLED: "danger",
  CLOSED: "neutral",
};

export function PurchaseOrderStatusBadge({ status }: { status: string }) {
  const key = status as PurchaseOrderStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{PURCHASE_ORDER_STATUS_LABELS[key] ?? status}</Badge>;
}
