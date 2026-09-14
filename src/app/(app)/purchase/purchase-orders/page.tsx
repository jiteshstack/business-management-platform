import { PurchaseOrderListView } from "@/components/purchase-orders/po-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PurchaseOrderListView searchParams={searchParams} />;
}
