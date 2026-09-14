import { Badge } from "@/components/ui/badge";
import { computeWarrantyStatus, WARRANTY_DISPLAY_STATUS_LABELS, type WarrantyDisplayStatus } from "@/lib/energy/warranties/types";

const VARIANT: Record<WarrantyDisplayStatus, "neutral" | "success" | "warning" | "danger"> = {
  NOT_STARTED: "neutral",
  ACTIVE: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  CANCELLED: "danger",
};

export function WarrantyStatusBadge({ warranty }: { warranty: { status: string; startDate: Date; endDate: Date } }) {
  const status = computeWarrantyStatus(warranty);
  return <Badge variant={VARIANT[status]}>{WARRANTY_DISPLAY_STATUS_LABELS[status]}</Badge>;
}
