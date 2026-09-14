import { PurchaseReceiptListView } from "@/components/purchase-orders/purchase-receipt-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PurchaseReceiptListView searchParams={searchParams} />;
}
