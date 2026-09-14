import { PaymentReceiptView } from "@/components/payments/payment-receipt-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentReceiptView id={id} />;
}
