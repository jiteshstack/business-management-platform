import { PurchaseOrderDetailView } from "@/components/purchase-orders/po-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <PurchaseOrderDetailView id={id} searchParams={searchParams} />;
}
