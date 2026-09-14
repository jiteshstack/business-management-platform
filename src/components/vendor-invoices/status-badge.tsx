import { Badge } from "@/components/ui/badge";
import { VENDOR_INVOICE_STATUS_LABELS, type VendorInvoiceStatus } from "@/lib/energy/vendor-invoices/types";

const VARIANT: Record<VendorInvoiceStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  CANCELLED: "danger",
};

export function VendorInvoiceStatusBadge({ status }: { status: string }) {
  const key = status as VendorInvoiceStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{VENDOR_INVOICE_STATUS_LABELS[key] ?? status}</Badge>;
}

// "Overdue" is never a stored status — computed live and shown as an
// overlay badge, same pattern as customer Invoices.
export function isVendorInvoiceOverdue(invoice: { dueDate: Date | null; outstandingAmount: number }): boolean {
  return !!invoice.dueDate && invoice.dueDate.getTime() < Date.now() && invoice.outstandingAmount > 0;
}

export function OverdueBadge() {
  return <Badge variant="danger">Overdue</Badge>;
}
