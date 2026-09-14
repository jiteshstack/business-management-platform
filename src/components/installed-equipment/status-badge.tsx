import { Badge } from "@/components/ui/badge";
import { EQUIPMENT_STATUS_LABELS, type EquipmentStatus } from "@/lib/energy/installed-equipment/types";

const VARIANT: Record<EquipmentStatus, "neutral" | "success" | "warning" | "danger"> = {
  INSTALLED: "neutral",
  ACTIVE: "success",
  UNDER_MAINTENANCE: "warning",
  REPLACED: "warning",
  REMOVED: "danger",
  RETIRED: "danger",
};

export function EquipmentStatusBadge({ status }: { status: string }) {
  const key = status as EquipmentStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{EQUIPMENT_STATUS_LABELS[key] ?? status}</Badge>;
}
