import { VisitListView } from "@/components/maintenance-visits/visit-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <VisitListView searchParams={searchParams} />;
}
