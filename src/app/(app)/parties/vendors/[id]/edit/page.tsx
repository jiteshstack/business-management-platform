import { PartyEditView } from "@/components/parties/party-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PartyEditView type="VENDOR" id={id} />;
}
