import { ReceivablesView } from "@/components/payments/receivables-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReceivablesView searchParams={searchParams} />;
}
