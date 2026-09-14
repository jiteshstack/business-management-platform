import { QuotationListView } from "@/components/quotations/quotation-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <QuotationListView searchParams={searchParams} />;
}
