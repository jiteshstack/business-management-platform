export const PARTY_TYPES = ["CLIENT", "VENDOR"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  CLIENT: "Client",
  VENDOR: "Vendor",
};

export const ADDRESS_TYPES = ["BILLING", "SITE"] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  BILLING: "Billing",
  SITE: "Site",
};

export const PARTY_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "contacts", label: "Contacts" },
  { key: "addresses", label: "Addresses" },
  { key: "quotations", label: "Quotations" },
  { key: "sales-orders", label: "Sales Orders" },
  { key: "purchase-orders", label: "Purchase Orders" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
  { key: "outstanding", label: "Outstanding" },
  { key: "ledger", label: "Ledger" },
  { key: "projects", label: "Projects" },
  { key: "sites", label: "Sites" },
  { key: "equipment", label: "Equipment" },
  { key: "warranty-amc", label: "Warranty & AMC" },
  { key: "service", label: "Service" },
  { key: "documents", label: "Documents" },
  { key: "notes", label: "Notes" },
] as const;

export type PartyDetailTabKey = (typeof PARTY_DETAIL_TABS)[number]["key"];

const TAB_KEYS = PARTY_DETAIL_TABS.map((tab) => tab.key);

export function isPartyDetailTabKey(value: string): value is PartyDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}

// Tabs with real data/actions in this phase. The rest render a "not built
// yet" placeholder since those modules don't exist (quotations, invoices, …).
export const IMPLEMENTED_TABS: readonly PartyDetailTabKey[] = [
  "overview",
  "contacts",
  "addresses",
  "documents",
  "notes",
];
