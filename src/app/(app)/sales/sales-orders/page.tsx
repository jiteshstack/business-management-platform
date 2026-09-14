import { SalesOrderListView } from "@/components/sales-orders/sales-order-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SalesOrderListView searchParams={searchParams} />;
}
