import { QuotationPrintView } from "@/components/quotations/quotation-print-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuotationPrintView id={id} />;
}
