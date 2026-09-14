import { VendorInvoiceListView } from "@/components/vendor-invoices/invoice-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <VendorInvoiceListView searchParams={searchParams} />;
}
