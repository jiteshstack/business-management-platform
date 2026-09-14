// Only ENERGY_SOLUTIONS is implemented in V1. The column is a plain string
// (not a DB enum) so a future vertical (e.g. PHARMA_DISTRIBUTION) can be
// added without a schema migration — no Pharma logic exists yet.
export const BUSINESS_TYPES = ["ENERGY_SOLUTIONS"] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  ENERGY_SOLUTIONS: "Energy Solutions",
};
