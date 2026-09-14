// Role is stored as a plain string column (SQLite has no native enum type),
// constrained to this union at the application layer.
export const USER_ROLES = [
  "OWNER_ADMIN",
  "SALES",
  "PURCHASE",
  "INVENTORY",
  "ACCOUNTS",
  "PROJECT_MANAGER",
  "INSTALLATION_TEAM",
  "SERVICE_MAINTENANCE",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER_ADMIN: "Owner / Admin",
  SALES: "Sales",
  PURCHASE: "Purchase",
  INVENTORY: "Inventory",
  ACCOUNTS: "Accounts",
  PROJECT_MANAGER: "Project Manager",
  INSTALLATION_TEAM: "Installation Team",
  SERVICE_MAINTENANCE: "Service / Maintenance",
};

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
