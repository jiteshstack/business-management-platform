import { InvoiceListView } from "@/components/invoices/invoice-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <InvoiceListView searchParams={searchParams} />;
}
