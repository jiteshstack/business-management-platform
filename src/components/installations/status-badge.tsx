import { Badge } from "@/components/ui/badge";
import { INSTALLATION_STATUS_LABELS, type InstallationStatus } from "@/lib/energy/installations/types";

const VARIANT: Record<InstallationStatus, "neutral" | "success" | "warning" | "danger"> = {
  PLANNED: "neutral",
  SCHEDULED: "warning",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export function InstallationStatusBadge({ status }: { status: string }) {
  const key = status as InstallationStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{INSTALLATION_STATUS_LABELS[key] ?? status}</Badge>;
}
