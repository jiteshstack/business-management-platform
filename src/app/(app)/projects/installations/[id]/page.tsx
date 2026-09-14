import { InstallationDetailView } from "@/components/installations/installation-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <InstallationDetailView id={id} searchParams={searchParams} />;
}
