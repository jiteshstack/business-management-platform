export const INSTALLATION_STATUSES = ["PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];

export const INSTALLATION_STATUS_LABELS: Record<InstallationStatus, string> = {
  PLANNED: "Planned",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// COMPLETED is only ever reached via completeInstallationAction (which also
// records installed equipment), never a bare "Mark as Completed" button.
export const INSTALLATION_STATUS_TRANSITIONS: Record<InstallationStatus, readonly InstallationStatus[]> = {
  PLANNED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// A simple, fixed {key: boolean} checklist — same JSON-blob pattern as
// Quotation.technicalConfigJson, not a separate configurable-items table.
export const CHECKLIST_SECTIONS: readonly { title: string; items: readonly { key: string; label: string }[] }[] = [
  {
    title: "Pre-installation",
    items: [
      { key: "siteVerified", label: "Site verified" },
      { key: "equipmentAvailable", label: "Required equipment available" },
      { key: "teamAssigned", label: "Installation team assigned" },
      { key: "customerCoordinated", label: "Customer coordination completed" },
    ],
  },
  {
    title: "Installation",
    items: [
      { key: "equipmentDelivered", label: "Equipment delivered" },
      { key: "equipmentInstalled", label: "Equipment installed" },
      { key: "wiringCompleted", label: "Wiring completed" },
      { key: "mountingCompleted", label: "Mounting completed" },
      { key: "connectionsCompleted", label: "Connections completed" },
    ],
  },
  {
    title: "Completion",
    items: [
      { key: "systemChecked", label: "System checked" },
      { key: "testingCompleted", label: "Testing completed" },
      { key: "customerHandoverCompleted", label: "Customer handover completed" },
    ],
  },
];

export const INSTALLATION_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "items", label: "Items" },
  { key: "checklist", label: "Checklist" },
  { key: "activity", label: "Activity" },
] as const;
export type InstallationDetailTabKey = (typeof INSTALLATION_DETAIL_TABS)[number]["key"];

const TAB_KEYS = INSTALLATION_DETAIL_TABS.map((t) => t.key);
export function isInstallationDetailTabKey(value: string): value is InstallationDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
