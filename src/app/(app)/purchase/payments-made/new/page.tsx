import { VendorPaymentCreateView } from "@/components/vendor-payments/payment-create-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <VendorPaymentCreateView searchParams={searchParams} />;
}
