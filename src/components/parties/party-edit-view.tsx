import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { getPartyById } from "@/lib/core/parties/queries";
import { updatePartyAction } from "@/lib/core/parties/actions";
import type { PartyType } from "@/lib/core/parties/types";
import { PageHeader } from "@/components/shared/page-header";
import { PartyForm } from "./party-form";

const NOUN: Record<PartyType, string> = { CLIENT: "Client", VENDOR: "Vendor" };
const BASE_PATH: Record<PartyType, string> = { CLIENT: "/parties/clients", VENDOR: "/parties/vendors" };

export async function PartyEditView({ type, id }: { type: PartyType; id: string }) {
  const session = await requireSession();
  const party = await getPartyById({ companyId: session.companyId, type, id });
  if (!party) notFound();

  const noun = NOUN[type];
  const basePath = BASE_PATH[type];

  return (
    <div>
      <PageHeader title={`Edit ${party.name}`} description={`Update this ${noun.toLowerCase()}'s details.`} />
      <PartyForm
        noun={noun}
        mode="edit"
        action={updatePartyAction.bind(null, type, id)}
        defaults={party}
        cancelHref={`${basePath}/${id}`}
      />
    </div>
  );
}
