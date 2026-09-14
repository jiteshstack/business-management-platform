import { createPartyAction } from "@/lib/core/parties/actions";
import type { PartyType } from "@/lib/core/parties/types";
import { PageHeader } from "@/components/shared/page-header";
import { PartyForm } from "./party-form";

const NOUN: Record<PartyType, string> = { CLIENT: "Client", VENDOR: "Vendor" };
const BASE_PATH: Record<PartyType, string> = { CLIENT: "/parties/clients", VENDOR: "/parties/vendors" };

export function PartyCreateView({ type }: { type: PartyType }) {
  const noun = NOUN[type];
  const basePath = BASE_PATH[type];

  return (
    <div>
      <PageHeader title={`New ${noun}`} description={`Add a new ${noun.toLowerCase()} record.`} />
      <PartyForm
        noun={noun}
        mode="create"
        action={createPartyAction.bind(null, type)}
        cancelHref={basePath}
      />
    </div>
  );
}
