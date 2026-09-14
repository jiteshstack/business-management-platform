import { Badge } from "@/components/ui/badge";
import { VISIT_STATUS_LABELS, type VisitStatus } from "@/lib/energy/maintenance-visits/types";

const VARIANT: Record<VisitStatus, "neutral" | "success" | "warning" | "danger"> = {
  PLANNED: "neutral",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export function VisitStatusBadge({ status }: { status: string }) {
  const key = status as VisitStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{VISIT_STATUS_LABELS[key] ?? status}</Badge>;
}
