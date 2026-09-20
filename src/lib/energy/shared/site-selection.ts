import "server-only";
import { prisma } from "@/lib/db/client";

// The "Site Address" field on Quotations/Sales Orders can point at either a
// Project Site (a customer's installation location, managed under Projects >
// Sites) or a PartyAddress of type "SITE" (added directly on the client's
// own Addresses tab) — two separate tables that predate each other. The form
// submits one combined value, "site:<id>" or "address:<id>", which this
// resolves and validates against whichever table it names.
export type SiteSelectionResult = {
  siteId: string | null;
  siteAddressId: string | null;
  siteAddressText: string | undefined;
};

function formatAddress(address: {
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}) {
  return [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(", ");
}

function formatProjectSite(site: {
  name: string;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}) {
  return [site.name, site.line1, site.line2, site.city, site.state, site.pincode].filter(Boolean).join(", ");
}

export async function resolveSiteSelection(params: {
  companyId: string;
  clientId: string;
  siteSelection: string | undefined;
}): Promise<SiteSelectionResult> {
  const { companyId, clientId, siteSelection } = params;

  if (siteSelection?.startsWith("site:")) {
    const siteId = siteSelection.slice("site:".length);
    const site = await prisma.projectSite.findFirst({ where: { id: siteId, companyId, customerId: clientId } });
    if (!site) throw new Error("Select a valid site.");
    return { siteId: site.id, siteAddressId: null, siteAddressText: formatProjectSite(site) };
  }

  if (siteSelection?.startsWith("address:")) {
    const siteAddressId = siteSelection.slice("address:".length);
    const address = await prisma.partyAddress.findFirst({ where: { id: siteAddressId, partyId: clientId } });
    if (!address) throw new Error("Select a valid site address.");
    return { siteId: null, siteAddressId: address.id, siteAddressText: formatAddress(address) };
  }

  return { siteId: null, siteAddressId: null, siteAddressText: undefined };
}
