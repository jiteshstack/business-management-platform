import { InvoiceEditView } from "@/components/invoices/invoice-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceEditView id={id} />;
}
