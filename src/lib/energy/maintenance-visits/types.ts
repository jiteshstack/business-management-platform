export const VISIT_TYPES = [
  "WARRANTY_SERVICE",
  "AMC_PREVENTIVE_MAINTENANCE",
  "BREAKDOWN_SERVICE",
  "INSTALLATION_FOLLOWUP",
  "INSPECTION",
  "GENERAL_SERVICE",
] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  WARRANTY_SERVICE: "Warranty Service",
  AMC_PREVENTIVE_MAINTENANCE: "AMC Preventive Maintenance",
  BREAKDOWN_SERVICE: "Breakdown Service",
  INSTALLATION_FOLLOWUP: "Installation Follow-up",
  INSPECTION: "Inspection",
  GENERAL_SERVICE: "General Service",
};

export const VISIT_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const VISIT_STATUS_TRANSITIONS: Record<VisitStatus, readonly VisitStatus[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["CANCELLED"], // COMPLETED is only ever set by completeMaintenanceVisitAction
  COMPLETED: [],
  CANCELLED: [],
};

// A simple, extensible checklist appropriate for Energy installations —
// same {key,label} + JSON-blob pattern as Installation's checklist.
export const MAINTENANCE_CHECKLIST_ITEMS: readonly { key: string; label: string }[] = [
  { key: "panelCondition", label: "Panel condition checked" },
  { key: "mountingStructure", label: "Mounting structure checked" },
  { key: "wiring", label: "Wiring checked" },
  { key: "inverter", label: "Inverter checked" },
  { key: "battery", label: "Battery checked" },
  { key: "connections", label: "Connections checked" },
  { key: "systemPerformance", label: "System performance checked" },
  { key: "cleaning", label: "Cleaning completed" },
];

export const MAINTENANCE_VISIT_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "checklist", label: "Checklist" },
  { key: "parts", label: "Parts Used" },
  { key: "activity", label: "Activity" },
] as const;
export type MaintenanceVisitDetailTabKey = (typeof MAINTENANCE_VISIT_DETAIL_TABS)[number]["key"];
const TAB_KEYS = MAINTENANCE_VISIT_DETAIL_TABS.map((t) => t.key);
export function isMaintenanceVisitDetailTabKey(value: string): value is MaintenanceVisitDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
