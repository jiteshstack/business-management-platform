export const SERVICE_REQUEST_SOURCES = [
  "COMPLAINT",
  "PHONE_CALL",
  "INSPECTION",
  "PREVENTIVE_MAINTENANCE",
  "AMC_VISIT",
  "WARRANTY_ISSUE",
  "POST_INSTALLATION_SUPPORT",
  "OTHER",
] as const;
export type ServiceRequestSource = (typeof SERVICE_REQUEST_SOURCES)[number];

export const SERVICE_REQUEST_SOURCE_LABELS: Record<ServiceRequestSource, string> = {
  COMPLAINT: "Customer Complaint",
  PHONE_CALL: "Phone Call",
  INSPECTION: "Internal Inspection",
  PREVENTIVE_MAINTENANCE: "Preventive Maintenance",
  AMC_VISIT: "AMC Visit",
  WARRANTY_ISSUE: "Warranty Issue",
  POST_INSTALLATION_SUPPORT: "Post-installation Support",
  OTHER: "Other",
};

export const SERVICE_REQUEST_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ServiceRequestPriority = (typeof SERVICE_REQUEST_PRIORITIES)[number];

export const SERVICE_REQUEST_PRIORITY_LABELS: Record<ServiceRequestPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const SERVICE_TYPES = ["WARRANTY", "AMC", "CHARGEABLE", "OTHER"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  WARRANTY: "Warranty",
  AMC: "AMC",
  CHARGEABLE: "Chargeable",
  OTHER: "Other",
};

export const SERVICE_REQUEST_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "SCHEDULED",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "WAITING_FOR_PARTS",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_CUSTOMER: "Waiting for Customer",
  WAITING_FOR_PARTS: "Waiting for Parts",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

// Basic flow: Open -> Assigned -> Scheduled -> In Progress -> Resolved ->
// Closed, with Waiting states as detours back into In Progress, and
// Cancelled reachable from any non-terminal state.
export const SERVICE_REQUEST_STATUS_TRANSITIONS: Record<ServiceRequestStatus, readonly ServiceRequestStatus[]> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_CUSTOMER", "WAITING_FOR_PARTS", "RESOLVED", "CANCELLED"],
  WAITING_FOR_CUSTOMER: ["IN_PROGRESS", "CANCELLED"],
  WAITING_FOR_PARTS: ["IN_PROGRESS", "CANCELLED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  CANCELLED: [],
};

export const SERVICE_REQUEST_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "visits", label: "Maintenance Visits" },
  { key: "financial", label: "Financial" },
  { key: "activity", label: "Activity" },
] as const;
export type ServiceRequestDetailTabKey = (typeof SERVICE_REQUEST_DETAIL_TABS)[number]["key"];
const TAB_KEYS = SERVICE_REQUEST_DETAIL_TABS.map((t) => t.key);
export function isServiceRequestDetailTabKey(value: string): value is ServiceRequestDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
