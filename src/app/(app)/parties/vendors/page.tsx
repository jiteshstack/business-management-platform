import { PartyListView } from "@/components/parties/party-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PartyListView type="VENDOR" searchParams={searchParams} />;
}
