import { ServiceRequestCreateView } from "@/components/service-requests/service-request-create-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ServiceRequestCreateView searchParams={searchParams} />;
}
