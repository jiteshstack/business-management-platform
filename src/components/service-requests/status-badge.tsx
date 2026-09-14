import { Badge } from "@/components/ui/badge";
import {
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_PRIORITY_LABELS,
  type ServiceRequestStatus,
  type ServiceRequestPriority,
} from "@/lib/energy/service-requests/types";

const STATUS_VARIANT: Record<ServiceRequestStatus, "neutral" | "success" | "warning" | "danger"> = {
  OPEN: "warning",
  ASSIGNED: "warning",
  SCHEDULED: "warning",
  IN_PROGRESS: "warning",
  WAITING_FOR_CUSTOMER: "neutral",
  WAITING_FOR_PARTS: "neutral",
  RESOLVED: "success",
  CLOSED: "success",
  CANCELLED: "danger",
};

export function ServiceRequestStatusBadge({ status }: { status: string }) {
  const key = status as ServiceRequestStatus;
  return <Badge variant={STATUS_VARIANT[key] ?? "neutral"}>{SERVICE_REQUEST_STATUS_LABELS[key] ?? status}</Badge>;
}

const PRIORITY_VARIANT: Record<ServiceRequestPriority, "neutral" | "success" | "warning" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "neutral",
  HIGH: "warning",
  CRITICAL: "danger",
};

export function ServiceRequestPriorityBadge({ priority }: { priority: string }) {
  const key = priority as ServiceRequestPriority;
  return <Badge variant={PRIORITY_VARIANT[key] ?? "neutral"}>{SERVICE_REQUEST_PRIORITY_LABELS[key] ?? priority}</Badge>;
}
