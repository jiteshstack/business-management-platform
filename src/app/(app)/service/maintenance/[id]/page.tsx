import { VisitDetailView } from "@/components/maintenance-visits/visit-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <VisitDetailView id={id} searchParams={searchParams} />;
}
