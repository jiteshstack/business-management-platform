import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/energy/invoices/types";

const VARIANT: Record<InvoiceStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  ISSUED: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "danger",
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const key = status as InvoiceStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{INVOICE_STATUS_LABELS[key] ?? status}</Badge>;
}

// "Overdue" is never a stored status — it's a live fact (due date passed
// with a balance still outstanding) shown as an overlay next to whatever
// the real payment-progress status is, the same way Quotations show a
// "Past validity" badge alongside their real status.
export function isInvoiceOverdue(invoice: { dueDate: Date | null; outstandingAmount: number }): boolean {
  return !!invoice.dueDate && invoice.dueDate.getTime() < Date.now() && invoice.outstandingAmount > 0;
}

export function OverdueBadge() {
  return <Badge variant="danger">Overdue</Badge>;
}
