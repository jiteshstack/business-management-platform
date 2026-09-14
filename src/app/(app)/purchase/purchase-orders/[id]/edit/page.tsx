import { PurchaseOrderEditView } from "@/components/purchase-orders/po-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PurchaseOrderEditView id={id} />;
}
