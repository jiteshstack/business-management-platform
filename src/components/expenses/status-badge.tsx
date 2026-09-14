import { Badge } from "@/components/ui/badge";
import {
  EXPENSE_STATUS_LABELS,
  computeExpensePaymentStatus,
  type ExpenseStatus,
} from "@/lib/energy/expenses/types";

const VARIANT: Record<ExpenseStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  APPROVED: "warning",
  PAID: "success",
  CANCELLED: "danger",
};

export function ExpenseStatusBadge({ status }: { status: string }) {
  const key = status as ExpenseStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{EXPENSE_STATUS_LABELS[key] ?? status}</Badge>;
}

// "Partially Paid" is a computed overlay, never a stored status — same
// pattern as Invoice's "Overdue" badge.
export function ExpensePaymentBadge({ expense }: { expense: { paidAmount: number; grandTotal: number; status: string } }) {
  if (expense.status === "CANCELLED") return null;
  const paymentStatus = computeExpensePaymentStatus(expense);
  if (paymentStatus === "PARTIALLY_PAID") return <Badge variant="warning">Partially Paid</Badge>;
  if (paymentStatus === "UNPAID" && expense.status === "APPROVED") return <Badge variant="neutral">Unpaid</Badge>;
  return null;
}
