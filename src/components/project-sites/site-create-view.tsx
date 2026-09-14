import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createProjectSiteAction } from "@/lib/energy/project-sites/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectSiteForm, type CustomerOption } from "./site-form";

export async function ProjectSiteCreateView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const presetCustomerId = typeof params.customerId === "string" ? params.customerId : undefined;

  const customers = await prisma.party.findMany({
    where: { companyId: session.companyId, type: "CLIENT", isActive: true },
    orderBy: { name: "asc" },
  });
  const customerOptions: CustomerOption[] = customers.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div>
      <PageHeader title="New Site" description="Add a customer installation location." />
      <ProjectSiteForm
        mode="create"
        action={createProjectSiteAction}
        customers={customerOptions}
        cancelHref="/projects/sites"
        lockCustomer={!!presetCustomerId}
        defaults={presetCustomerId ? { customerId: presetCustomerId } : undefined}
      />
    </div>
  );
}
