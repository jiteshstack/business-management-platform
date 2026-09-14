import { SalesOrderPrintView } from "@/components/sales-orders/sales-order-print-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SalesOrderPrintView id={id} />;
}
