import { VendorPaymentListView } from "@/components/vendor-payments/payment-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <VendorPaymentListView searchParams={searchParams} />;
}
