import { PayablesView } from "@/components/vendor-payments/payables-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PayablesView searchParams={searchParams} />;
}
