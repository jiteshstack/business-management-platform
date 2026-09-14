import { SalesOrderDetailView } from "@/components/sales-orders/sales-order-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <SalesOrderDetailView id={id} searchParams={searchParams} />;
}
