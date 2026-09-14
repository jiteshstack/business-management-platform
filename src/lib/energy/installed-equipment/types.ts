export const EQUIPMENT_STATUSES = [
  "INSTALLED",
  "ACTIVE",
  "UNDER_MAINTENANCE",
  "REPLACED",
  "REMOVED",
  "RETIRED",
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  INSTALLED: "Installed",
  ACTIVE: "Active",
  UNDER_MAINTENANCE: "Under Maintenance",
  REPLACED: "Replaced",
  REMOVED: "Removed",
  RETIRED: "Retired",
};

// Deliberately permissive — a technician correcting equipment state (e.g.
// putting something back into Active after maintenance) shouldn't hit a
// rigid transition wall like the financial/status-gated document flows do.
export const EQUIPMENT_STATUS_TRANSITIONS: Record<EquipmentStatus, readonly EquipmentStatus[]> = {
  INSTALLED: ["ACTIVE", "UNDER_MAINTENANCE", "REPLACED", "REMOVED", "RETIRED"],
  ACTIVE: ["UNDER_MAINTENANCE", "REPLACED", "REMOVED", "RETIRED"],
  UNDER_MAINTENANCE: ["ACTIVE", "REPLACED", "REMOVED", "RETIRED"],
  REPLACED: ["REMOVED", "RETIRED"],
  REMOVED: ["RETIRED"],
  RETIRED: [],
};

export const EQUIPMENT_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "warranty", label: "Warranty" },
  { key: "amc", label: "AMC" },
  { key: "service", label: "Service History" },
  { key: "maintenance", label: "Maintenance" },
] as const;
export type EquipmentDetailTabKey = (typeof EQUIPMENT_DETAIL_TABS)[number]["key"];

const TAB_KEYS = EQUIPMENT_DETAIL_TABS.map((t) => t.key);
export function isEquipmentDetailTabKey(value: string): value is EquipmentDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
