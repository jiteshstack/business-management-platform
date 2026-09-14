import { ServiceRequestListView } from "@/components/service-requests/service-request-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ServiceRequestListView searchParams={searchParams} />;
}
