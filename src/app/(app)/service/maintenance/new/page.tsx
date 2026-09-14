import { VisitCreateView } from "@/components/maintenance-visits/visit-create-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <VisitCreateView searchParams={searchParams} />;
}
