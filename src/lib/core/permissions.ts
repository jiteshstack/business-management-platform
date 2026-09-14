import type { UserRole } from "./roles";

// Foundation-level permissions: which nav modules a role can see. This is
// deliberately coarse (view-level, per module) — per-action permissions
// (create/edit/approve/delete/export/print) are layered on once each
// module's business logic exists.
export const MODULE_KEYS = [
  "dashboard",
  "parties",
  "sales",
  "purchase",
  "inventory",
  "projects",
  "service",
  "warranty",
  "finance",
  "reports",
  "settings",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

const ALL_MODULES = MODULE_KEYS;

const MODULE_ACCESS: Record<UserRole, readonly ModuleKey[]> = {
  OWNER_ADMIN: ALL_MODULES,
  SALES: ["dashboard", "parties", "sales", "reports"],
  PURCHASE: ["dashboard", "parties", "purchase", "inventory", "reports"],
  INVENTORY: ["dashboard", "inventory", "reports"],
  ACCOUNTS: ["dashboard", "sales", "purchase", "finance", "reports"],
  PROJECT_MANAGER: ["dashboard", "parties", "projects", "warranty", "reports"],
  INSTALLATION_TEAM: ["dashboard", "projects"],
  SERVICE_MAINTENANCE: ["dashboard", "service", "warranty", "reports"],
};

export function canAccessModule(role: UserRole, moduleKey: ModuleKey): boolean {
  return MODULE_ACCESS[role]?.includes(moduleKey) ?? false;
}

export function isOwnerAdmin(role: UserRole): boolean {
  return role === "OWNER_ADMIN";
}

// Viewing products/inventory follows normal module access (above); actually
// changing stock — stock in/out, adjustments, damage, reservations, serial
// status — is restricted further to the roles whose job this actually is.
const STOCK_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "INVENTORY"];

export function canManageInventory(role: UserRole): boolean {
  return STOCK_MANAGER_ROLES.includes(role);
}

// Creating/editing/sending/revising/cancelling a quotation is a Sales job;
// approving one is held back for Owner/Admin (a lightweight maker-checker
// control, since the spec calls for approval to require its own permission).
const QUOTATION_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "SALES"];

export function canManageQuotations(role: UserRole): boolean {
  return QUOTATION_MANAGER_ROLES.includes(role);
}

export function canApproveQuotations(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

// Sales Orders: same maker roles as quotations; cancellation (a financial,
// hard-to-reverse action once stock is reserved) is held back for
// Owner/Admin only, per "do not give all users approval/cancellation
// permissions by default".
const SALES_ORDER_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "SALES"];

export function canManageSalesOrders(role: UserRole): boolean {
  return SALES_ORDER_MANAGER_ROLES.includes(role);
}

export function canCancelSalesOrders(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

// Invoices: Sales and Accounts both plausibly issue invoices day-to-day;
// cancelling an issued invoice is Owner/Admin only.
const INVOICE_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "SALES", "ACCOUNTS"];

export function canManageInvoices(role: UserRole): boolean {
  return INVOICE_MANAGER_ROLES.includes(role);
}

export function canCancelInvoices(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

// Payments: recording/allocating money-in is a Sales+Accounts job (same
// roles as invoicing, since collecting payment naturally follows issuing the
// invoice); cancelling a recorded payment reverses real financial history,
// so — like invoice/SO cancellation — it stays Owner/Admin only.
const PAYMENT_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "SALES", "ACCOUNTS"];

export function canManagePayments(role: UserRole): boolean {
  return PAYMENT_MANAGER_ROLES.includes(role);
}

export function canCancelPayments(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

// Payment reminders are a collections/follow-up activity — same roles as
// managing payments.
export function canManageReminders(role: UserRole): boolean {
  return PAYMENT_MANAGER_ROLES.includes(role);
}

// ---- Phase 7: Purchasing + Vendor Payables ----

// Purchase Orders: Purchase is the maker role (mirrors Sales for
// quotations); cancellation is Owner/Admin only, same reasoning as
// Sales Order cancellation.
const PURCHASE_ORDER_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "PURCHASE"];

export function canManagePurchaseOrders(role: UserRole): boolean {
  return PURCHASE_ORDER_MANAGER_ROLES.includes(role);
}

export function canCancelPurchaseOrders(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

// Receiving stock against a PO is inventory-affecting, so either the team
// that placed the order or the team that manages stock can do it.
const PURCHASE_RECEIVING_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "PURCHASE", "INVENTORY"];

export function canReceivePurchases(role: UserRole): boolean {
  return PURCHASE_RECEIVING_ROLES.includes(role);
}

// Vendor Invoices: Purchase and Accounts both plausibly record a vendor's
// bill; cancelling one is Owner/Admin only — mirrors customer Invoices.
const VENDOR_INVOICE_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "PURCHASE", "ACCOUNTS"];

export function canManageVendorInvoices(role: UserRole): boolean {
  return VENDOR_INVOICE_MANAGER_ROLES.includes(role);
}

export function canCancelVendorInvoices(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

// Vendor Payments: same roles as vendor invoices — mirrors customer Payments.
const VENDOR_PAYMENT_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "PURCHASE", "ACCOUNTS"];

export function canManageVendorPayments(role: UserRole): boolean {
  return VENDOR_PAYMENT_MANAGER_ROLES.includes(role);
}

export function canCancelVendorPayments(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

// ---- Phase 8: Energy Projects + Sites + Installation Management ----

// Projects/Sites: Project Manager is the natural maker role, plus Owner/Admin.
const PROJECT_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "PROJECT_MANAGER"];

export function canManageProjects(role: UserRole): boolean {
  return PROJECT_MANAGER_ROLES.includes(role);
}

export function canManageSites(role: UserRole): boolean {
  return PROJECT_MANAGER_ROLES.includes(role);
}

// Installation execution (create/schedule/assign equipment/complete) is the
// on-site team's job as much as the project manager's.
const INSTALLATION_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "PROJECT_MANAGER", "INSTALLATION_TEAM"];

export function canManageInstallations(role: UserRole): boolean {
  return INSTALLATION_MANAGER_ROLES.includes(role);
}

// Cancelling a project is a bigger, harder-to-reverse call than day-to-day
// status updates — held back for Owner/Admin, same reasoning as every other
// cancellation in this codebase.
export function canCancelProjects(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

// ---- Phase 9: Warranty + AMC + Maintenance/Service Management ----

// Installed Equipment is created automatically by installation completion;
// viewing/editing it (status, notes) is an Owner/Admin + Service/Project job.
const EQUIPMENT_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "PROJECT_MANAGER", "SERVICE_MAINTENANCE"];

export function canManageInstalledEquipment(role: UserRole): boolean {
  return EQUIPMENT_MANAGER_ROLES.includes(role);
}

const WARRANTY_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "PROJECT_MANAGER", "SERVICE_MAINTENANCE"];

export function canManageWarranties(role: UserRole): boolean {
  return WARRANTY_MANAGER_ROLES.includes(role);
}

const AMC_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "SERVICE_MAINTENANCE"];

export function canManageAmcs(role: UserRole): boolean {
  return AMC_MANAGER_ROLES.includes(role);
}

// Service Requests: any of the after-sales-facing roles can log/manage one;
// assignment is the same set (whoever handles the queue can route it).
const SERVICE_REQUEST_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "SERVICE_MAINTENANCE", "PROJECT_MANAGER"];

export function canManageServiceRequests(role: UserRole): boolean {
  return SERVICE_REQUEST_MANAGER_ROLES.includes(role);
}

export function canAssignServiceRequests(role: UserRole): boolean {
  return SERVICE_REQUEST_MANAGER_ROLES.includes(role);
}

// Maintenance visits (including completion + part consumption) are the
// on-site service team's job, same as Installation execution.
const MAINTENANCE_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "SERVICE_MAINTENANCE", "INSTALLATION_TEAM"];

export function canManageMaintenanceVisits(role: UserRole): boolean {
  return MAINTENANCE_MANAGER_ROLES.includes(role);
}

export function canCompleteMaintenanceVisits(role: UserRole): boolean {
  return MAINTENANCE_MANAGER_ROLES.includes(role);
}

// ---- Phase 10: Expenses + Profitability + Management Reporting ----

// Recording/editing an expense is an Accounts job (same reasoning as
// invoices/payments); approval is a maker-checker control held back for
// Owner/Admin, matching every other approval gate in this codebase.
const EXPENSE_MANAGER_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "ACCOUNTS"];

export function canManageExpenses(role: UserRole): boolean {
  return EXPENSE_MANAGER_ROLES.includes(role);
}

export function canApproveExpenses(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

export function canCancelExpenses(role: UserRole): boolean {
  return isOwnerAdmin(role);
}

// Profitability and the financial-dashboard figures reveal margins and
// costs — deliberately narrower than the general "reports"/"dashboard"
// module access every role already has, per the spec's explicit
// instruction that sensitive financial reports are not visible by default.
const FINANCIAL_VISIBILITY_ROLES: readonly UserRole[] = ["OWNER_ADMIN", "ACCOUNTS"];

export function canViewProfitability(role: UserRole): boolean {
  return FINANCIAL_VISIBILITY_ROLES.includes(role);
}

export function canViewFinancialDashboard(role: UserRole): boolean {
  return FINANCIAL_VISIBILITY_ROLES.includes(role);
}
