import { Badge } from "@/components/ui/badge";
import { computeAmcStatus, AMC_DISPLAY_STATUS_LABELS, type AmcDisplayStatus } from "@/lib/energy/amc/types";

const VARIANT: Record<AmcDisplayStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  CANCELLED: "danger",
  COMPLETED: "neutral",
};

export function AmcStatusBadge({ amc }: { amc: { status: string; startDate: Date; endDate: Date } }) {
  const status = computeAmcStatus(amc);
  return <Badge variant={VARIANT[status]}>{AMC_DISPLAY_STATUS_LABELS[status]}</Badge>;
}
