import { ProfitabilityView } from "@/components/reporting/profitability-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProfitabilityView searchParams={searchParams} />;
}
