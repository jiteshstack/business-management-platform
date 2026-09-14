import { VendorInvoiceEditView } from "@/components/vendor-invoices/invoice-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VendorInvoiceEditView id={id} />;
}
