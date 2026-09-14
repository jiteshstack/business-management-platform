import { VendorPaymentDetailView } from "@/components/vendor-payments/payment-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <VendorPaymentDetailView id={id} searchParams={searchParams} />;
}
