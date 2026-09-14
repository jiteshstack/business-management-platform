import { PartyDetailView } from "@/components/parties/party-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <PartyDetailView type="VENDOR" id={id} searchParams={searchParams} />;
}
