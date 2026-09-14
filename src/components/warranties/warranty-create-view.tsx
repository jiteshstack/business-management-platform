import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createWarrantyAction } from "@/lib/energy/warranties/actions";
import { PageHeader } from "@/components/shared/page-header";
import { WarrantyForm, type WarrantyCustomerOption } from "./warranty-form";

export async function WarrantyCreateView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" && params[k] ? (params[k] as string) : undefined);

  const customers = await prisma.party.findMany({
    where: { companyId: session.companyId, type: "CLIENT", isActive: true },
    orderBy: { name: "asc" },
    include: {
      projectSites: { orderBy: { name: "asc" } },
      energyProjects: { orderBy: { createdAt: "desc" } },
      installedEquipment: { orderBy: { createdAt: "desc" } },
    },
  });

  const customerOptions: WarrantyCustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    sites: c.projectSites.map((s) => ({ id: s.id, name: s.name })),
    projects: c.energyProjects.map((p) => ({ id: p.id, projectNumber: p.projectNumber, name: p.name })),
    equipment: c.installedEquipment.map((e) => ({ id: e.id, equipmentNumber: e.equipmentNumber, productName: e.productName, serialNumberText: e.serialNumberText })),
  }));

  const customerId = str("customerId");

  return (
    <div>
      <PageHeader title="New Warranty" description="Track equipment warranty coverage." />
      <WarrantyForm
        mode="create"
        action={createWarrantyAction}
        customers={customerOptions}
        cancelHref="/warranty/warranties"
        lockCustomer={!!customerId}
        defaults={{
          customerId,
          siteId: str("siteId"),
          projectId: str("projectId"),
          installedEquipmentId: str("installedEquipmentId"),
        }}
      />
    </div>
  );
}
