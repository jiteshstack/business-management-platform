import { Badge } from "@/components/ui/badge";
import { QUOTATION_STATUS_LABELS, type QuotationStatus } from "@/lib/energy/quotations/types";

const VARIANT: Record<QuotationStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SENT: "warning",
  NEGOTIATION: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  EXPIRED: "danger",
  CANCELLED: "danger",
};

export function QuotationStatusBadge({ status }: { status: string }) {
  const key = status as QuotationStatus;
  return <Badge variant={VARIANT[key] ?? "neutral"}>{QUOTATION_STATUS_LABELS[key] ?? status}</Badge>;
}
