import { SalesOrderEditView } from "@/components/sales-orders/sales-order-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SalesOrderEditView id={id} />;
}
