import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createServiceRequestAction } from "@/lib/energy/service-requests/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ServiceRequestForm, type ServiceRequestCustomerOption } from "./service-request-form";

export async function ServiceRequestCreateView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
      },
    }),
    prisma.user.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const customerOptions: ServiceRequestCustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    sites: c.projectSites.map((s) => ({ id: s.id, name: s.name })),
    projects: c.energyProjects.map((p) => ({ id: p.id, projectNumber: p.projectNumber, name: p.name })),
    equipment: c.installedEquipment.map((e) => ({ id: e.id, equipmentNumber: e.equipmentNumber, productName: e.productName, serialNumberText: e.serialNumberText })),
  }));

  const customerId = str("customerId");

  return (
    <div>
      <PageHeader title="New Service Request" description="Log a customer complaint, inspection, or support request." />
      <ServiceRequestForm
        action={createServiceRequestAction}
        customers={customerOptions}
        users={users}
        cancelHref="/service/service-requests"
        lockCustomer={!!customerId}
        defaults={{ customerId, siteId: str("siteId"), projectId: str("projectId"), installedEquipmentId: str("installedEquipmentId") }}
      />
    </div>
  );
}
