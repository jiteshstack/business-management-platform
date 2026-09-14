import { QuotationEditView } from "@/components/quotations/quotation-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuotationEditView id={id} />;
}
