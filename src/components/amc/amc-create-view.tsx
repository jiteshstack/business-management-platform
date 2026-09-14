import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createAmcAction } from "@/lib/energy/amc/actions";
import { PageHeader } from "@/components/shared/page-header";
import { AmcForm, type AmcCustomerOption } from "./amc-form";

export async function AmcCreateView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" && params[k] ? (params[k] as string) : undefined);

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

  const customerId = str("customerId");

  return (
    <div>
      <PageHeader title="New AMC" description="Create an annual maintenance contract." />
      <AmcForm
        mode="create"
        action={createAmcAction}
        customers={customerOptions}
        cancelHref="/service/amc"
        lockCustomer={!!customerId}
        defaults={{ customerId, siteId: str("siteId"), projectId: str("projectId") }}
      />
    </div>
  );
}
