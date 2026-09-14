import { ServiceRequestDetailView } from "@/components/service-requests/service-request-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <ServiceRequestDetailView id={id} searchParams={searchParams} />;
}
