import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/energy/projects/types";

const VARIANT: Record<ProjectStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  PLANNED: "warning",
  IN_PROGRESS: "warning",
  ON_HOLD: "danger",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export function ProjectStatusBadge({ status }: { status: string }) {
  const key = status as ProjectStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{PROJECT_STATUS_LABELS[key] ?? status}</Badge>;
}
