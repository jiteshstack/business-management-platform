import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getWarrantyById } from "@/lib/energy/warranties/queries";
import { updateWarrantyAction } from "@/lib/energy/warranties/actions";
import { PageHeader } from "@/components/shared/page-header";
import { WarrantyForm, type WarrantyCustomerOption } from "./warranty-form";

export async function WarrantyEditView({ id }: { id: string }) {
  const session = await requireSession();
  const warranty = await getWarrantyById({ companyId: session.companyId, id });
  if (!warranty) notFound();

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

  return (
    <div>
      <PageHeader title={`Edit ${warranty.warrantyNumber}`} />
      <WarrantyForm
        mode="edit"
        action={updateWarrantyAction.bind(null, id)}
        customers={customerOptions}
        cancelHref={`/warranty/warranties/${id}`}
        lockCustomer
        defaults={{
          customerId: warranty.customerId,
          siteId: warranty.siteId ?? undefined,
          projectId: warranty.projectId ?? undefined,
          installedEquipmentId: warranty.installedEquipmentId ?? undefined,
          warrantyType: warranty.warrantyType,
          startDate: warranty.startDate.toISOString().slice(0, 10),
          endDate: warranty.endDate.toISOString().slice(0, 10),
          durationMonths: warranty.durationMonths,
          terms: warranty.terms,
          coverage: warranty.coverage,
          exclusions: warranty.exclusions,
          documentReference: warranty.documentReference,
        }}
      />
    </div>
  );
}
