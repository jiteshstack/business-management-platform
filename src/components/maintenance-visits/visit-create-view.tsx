import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createMaintenanceVisitAction } from "@/lib/energy/maintenance-visits/actions";
import { PageHeader } from "@/components/shared/page-header";
import { VisitForm, type VisitCustomerOption } from "./visit-form";

export async function VisitCreateView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" && params[k] ? (params[k] as string) : undefined);

  const [customers, users] = await Promise.all([
    prisma.party.findMany({
      where: { companyId: session.companyId, type: "CLIENT", isActive: true },
      orderBy: { name: "asc" },
      include: {
        projectSites: { orderBy: { name: "asc" } },
        energyProjects: { orderBy: { createdAt: "desc" } },
        installedEquipment: { orderBy: { createdAt: "desc" } },
        serviceRequests: { where: { status: { notIn: ["CLOSED", "CANCELLED"] } }, orderBy: { createdAt: "desc" } },
        amcs: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.user.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const customerOptions: VisitCustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    sites: c.projectSites.map((s) => ({ id: s.id, name: s.name })),
    projects: c.energyProjects.map((p) => ({ id: p.id, projectNumber: p.projectNumber, name: p.name })),
    equipment: c.installedEquipment.map((e) => ({ id: e.id, equipmentNumber: e.equipmentNumber, productName: e.productName })),
    serviceRequests: c.serviceRequests.map((sr) => ({ id: sr.id, requestNumber: sr.requestNumber, issue: sr.issue })),
    amcs: c.amcs.map((a) => ({ id: a.id, amcNumber: a.amcNumber })),
  }));

  const customerId = str("customerId");

  return (
    <div>
      <PageHeader title="Schedule Maintenance Visit" description="Plan a service, AMC, or warranty maintenance visit." />
      <VisitForm
        action={createMaintenanceVisitAction}
        customers={customerOptions}
        users={users}
        cancelHref="/service/maintenance"
        lockCustomer={!!customerId}
        defaults={{
          customerId,
          siteId: str("siteId"),
          projectId: str("projectId"),
          installedEquipmentId: str("installedEquipmentId"),
          serviceRequestId: str("serviceRequestId"),
          amcId: str("amcId"),
        }}
      />
    </div>
  );
}
