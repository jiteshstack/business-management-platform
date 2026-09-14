export const PROJECT_TYPES = [
  "SOLAR_INSTALLATION",
  "SOLAR_BATTERY",
  "GENERATOR_INSTALLATION",
  "POWER_BACKUP",
  "EQUIPMENT_SUPPLY",
  "EQUIPMENT_SUPPLY_INSTALLATION",
  "ELECTRICAL_INSTALLATION",
  "SERVICE_INSTALLATION",
  "CUSTOM",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  SOLAR_INSTALLATION: "Solar Installation",
  SOLAR_BATTERY: "Solar + Battery",
  GENERATOR_INSTALLATION: "Generator Installation",
  POWER_BACKUP: "Power Backup",
  EQUIPMENT_SUPPLY: "Equipment Supply",
  EQUIPMENT_SUPPLY_INSTALLATION: "Equipment Supply + Installation",
  ELECTRICAL_INSTALLATION: "Electrical Installation",
  SERVICE_INSTALLATION: "Service / Installation",
  CUSTOM: "Custom Energy Project",
};

export const PROJECT_STATUSES = ["DRAFT", "PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: "Draft",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Allowed manual next statuses. COMPLETED is reachable only via the
// completion-rule check in actions.ts (not a bare "Mark as Completed"
// button click) — see requireProjectCompletable.
export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  DRAFT: ["PLANNED", "CANCELLED"],
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const PROJECT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const MILESTONE_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
};

// Seeded onto every new project — a lightweight, fixed default sequence
// (not a workflow engine); milestones can still be added/renamed per spec's
// "configurable enough for future extension but simple" guidance.
export const DEFAULT_MILESTONES: readonly string[] = [
  "Site Survey",
  "Material Planning",
  "Material Allocation",
  "Installation Scheduled",
  "Installation Started",
  "Installation Completed",
  "Customer Handover",
];

export const PROJECT_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "scope", label: "Scope" },
  { key: "milestones", label: "Milestones" },
  { key: "installations", label: "Installations" },
  { key: "service", label: "Warranty & Service" },
  { key: "profitability", label: "Profitability" },
  { key: "documents", label: "Documents" },
  { key: "activity", label: "Activity" },
] as const;
export type ProjectDetailTabKey = (typeof PROJECT_DETAIL_TABS)[number]["key"];

const TAB_KEYS = PROJECT_DETAIL_TABS.map((t) => t.key);
export function isProjectDetailTabKey(value: string): value is ProjectDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
