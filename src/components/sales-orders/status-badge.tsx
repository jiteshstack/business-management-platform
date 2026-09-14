import { Badge } from "@/components/ui/badge";
import { SALES_ORDER_STATUS_LABELS, type SalesOrderStatus } from "@/lib/energy/sales-orders/types";

const VARIANT: Record<SalesOrderStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  CONFIRMED: "warning",
  PARTIALLY_FULFILLED: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export function SalesOrderStatusBadge({ status }: { status: string }) {
  const key = status as SalesOrderStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{SALES_ORDER_STATUS_LABELS[key] ?? status}</Badge>;
}
