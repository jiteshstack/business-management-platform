import { PaymentDetailView } from "@/components/payments/payment-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <PaymentDetailView id={id} searchParams={searchParams} />;
}
