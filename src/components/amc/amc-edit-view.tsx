import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getAmcById } from "@/lib/energy/amc/queries";
import { updateAmcAction } from "@/lib/energy/amc/actions";
import { PageHeader } from "@/components/shared/page-header";
import { AmcForm, type AmcCustomerOption } from "./amc-form";

export async function AmcEditView({ id }: { id: string }) {
  const session = await requireSession();
  const amc = await getAmcById({ companyId: session.companyId, id });
  if (!amc) notFound();

  const customers = await prisma.party.findMany({
    where: { companyId: session.companyId, type: "CLIENT", isActive: true },
    orderBy: { name: "asc" },
    include: { projectSites: { orderBy: { name: "asc" } }, energyProjects: { orderBy: { createdAt: "desc" } } },
  });

  const customerOptions: AmcCustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    sites: c.projectSites.map((s) => ({ id: s.id, name: s.name })),
    projects: c.energyProjects.map((p) => ({ id: p.id, projectNumber: p.projectNumber, name: p.name })),
  }));

  return (
    <div>
      <PageHeader title={`Edit ${amc.amcNumber}`} />
      <AmcForm
        mode="edit"
        action={updateAmcAction.bind(null, id)}
        customers={customerOptions}
        cancelHref={`/service/amc/${id}`}
        lockCustomer
        defaults={{
          customerId: amc.customerId,
          siteId: amc.siteId ?? undefined,
          projectId: amc.projectId ?? undefined,
          startDate: amc.startDate.toISOString().slice(0, 10),
          endDate: amc.endDate.toISOString().slice(0, 10),
          contractValue: amc.contractValue,
          billingFrequency: amc.billingFrequency,
          numberOfVisits: amc.numberOfVisits,
          coverage: amc.coverage,
          exclusions: amc.exclusions,
          notes: amc.notes,
        }}
      />
    </div>
  );
}
