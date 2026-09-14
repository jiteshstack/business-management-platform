import { ProductListView } from "@/components/inventory/product-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProductListView searchParams={searchParams} />;
}
