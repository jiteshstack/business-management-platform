import { ReportsView } from "@/components/reporting/reports-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReportsView searchParams={searchParams} />;
}
