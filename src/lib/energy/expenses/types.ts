export const EXPENSE_STATUSES = ["DRAFT", "APPROVED", "PAID", "CANCELLED"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

// PAID is only ever reached through recordExpensePaymentAction once
// paidAmount >= grandTotal — never a bare "Mark as Paid" button (mirrors
// Invoice/VendorInvoice's payment-driven status).
export const EXPENSE_STATUS_TRANSITIONS: Record<ExpenseStatus, readonly ExpenseStatus[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export const EXPENSE_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const;
export type ExpensePaymentStatus = (typeof EXPENSE_PAYMENT_STATUSES)[number];

// "Partially Paid" is a computed overlay, never a stored status — mirrors
// Invoice's computed "Overdue" badge (Phase 5).
export function computeExpensePaymentStatus(expense: { paidAmount: number; grandTotal: number }): ExpensePaymentStatus {
  if (expense.paidAmount <= 0) return "UNPAID";
  if (expense.paidAmount >= expense.grandTotal) return "PAID";
  return "PARTIALLY_PAID";
}

export const EXPENSE_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "documents", label: "Documents" },
  { key: "activity", label: "Activity" },
] as const;
export type ExpenseDetailTabKey = (typeof EXPENSE_DETAIL_TABS)[number]["key"];
const TAB_KEYS = EXPENSE_DETAIL_TABS.map((t) => t.key);
export function isExpenseDetailTabKey(value: string): value is ExpenseDetailTabKey {
  return (TAB_KEYS as string[]).includes(value);
}
