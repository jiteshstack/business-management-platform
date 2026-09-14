import { InvoiceDetailView } from "@/components/invoices/invoice-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <InvoiceDetailView id={id} searchParams={searchParams} />;
}
