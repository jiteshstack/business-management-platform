import { VendorInvoicePrintView } from "@/components/vendor-invoices/invoice-print-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VendorInvoicePrintView id={id} />;
}
