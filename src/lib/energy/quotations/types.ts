export const QUOTATION_TYPES = [
  "ON_GRID_SOLAR",
  "OFF_GRID_SOLAR",
  "HYBRID_SOLAR",
  "DIESEL_GENERATOR",
  "BATTERY_INVERTER",
  "EQUIPMENT_SUPPLY",
  "INSTALLATION_SERVICE",
  "AMC_MAINTENANCE",
  "CUSTOM",
] as const;
export type QuotationType = (typeof QUOTATION_TYPES)[number];

export const QUOTATION_TYPE_LABELS: Record<QuotationType, string> = {
  ON_GRID_SOLAR: "On-Grid Solar",
  OFF_GRID_SOLAR: "Off-Grid Solar",
  HYBRID_SOLAR: "Hybrid Solar",
  DIESEL_GENERATOR: "Diesel Generator",
  BATTERY_INVERTER: "Battery / Inverter",
  EQUIPMENT_SUPPLY: "Equipment Supply",
  INSTALLATION_SERVICE: "Installation / Service",
  AMC_MAINTENANCE: "AMC / Maintenance",
  CUSTOM: "Custom",
};

// Which quotation types get the optional Solar / DG technical config section.
export const SOLAR_TYPES: readonly QuotationType[] = ["ON_GRID_SOLAR", "OFF_GRID_SOLAR", "HYBRID_SOLAR"];
export const DG_TYPES: readonly QuotationType[] = ["DIESEL_GENERATOR"];

export const QUOTATION_STATUSES = [
  "DRAFT",
  "SENT",
  "NEGOTIATION",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  NEGOTIATION: "Negotiation",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

// Allowed next statuses from each current status — enforced server-side so
// the UI can't push a quotation through an invalid transition.
export const QUOTATION_STATUS_TRANSITIONS: Record<QuotationStatus, readonly QuotationStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["NEGOTIATION", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED"],
  NEGOTIATION: ["SENT", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export const QUOTATION_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "items", label: "Items" },
  { key: "technical", label: "Technical" },
  { key: "pricing", label: "Pricing" },
  { key: "terms", label: "Terms" },
  { key: "revisions", label: "Revisions" },
  { key: "activity", label: "Activity" },
] as const;
export type QuotationDetailTabKey = (typeof QUOTATION_DETAIL_TABS)[number]["key"];

const TAB_KEYS = QUOTATION_DETAIL_TABS.map((t) => t.key);
export function isQuotationDetailTabKey(value: string): value is QuotationDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}

export type SolarConfig = {
  systemCapacity?: string;
  panelQuantity?: string;
  panelWattage?: string;
  inverterCapacity?: string;
  inverterQuantity?: string;
  structure?: string;
  batteryCapacity?: string;
  batteryQuantity?: string;
  backupRequirement?: string;
  backupHours?: string;
  notes?: string;
};

export type DgConfig = {
  dgCapacityKva?: string;
  dgModel?: string;
  fuelType?: string;
  amfRequired?: string;
  synchronizationRequired?: string;
  installationRequired?: string;
  warranty?: string;
  notes?: string;
};
