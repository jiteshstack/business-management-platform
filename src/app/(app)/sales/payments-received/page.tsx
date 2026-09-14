import { PaymentListView } from "@/components/payments/payment-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PaymentListView searchParams={searchParams} />;
}
