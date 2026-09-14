import { PaymentCreateView } from "@/components/payments/payment-create-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PaymentCreateView searchParams={searchParams} />;
}
