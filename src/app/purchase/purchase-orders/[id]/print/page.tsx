import { PurchaseOrderPrintView } from "@/components/purchase-orders/po-print-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PurchaseOrderPrintView id={id} />;
}
