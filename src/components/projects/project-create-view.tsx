import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createProjectAction } from "@/lib/energy/projects/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectForm, type CustomerOption } from "./project-form";

export async function ProjectCreateView() {
  const session = await requireSession();

  const customers = await prisma.party.findMany({
    where: { companyId: session.companyId, type: "CLIENT", isActive: true },
    orderBy: { name: "asc" },
    include: { projectSites: { orderBy: { name: "asc" } } },
  });

  const customerOptions: CustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    sites: c.projectSites.map((s) => ({ id: s.id, name: s.name })),
  }));

  return (
    <div>
      <PageHeader title="New Project" description="Create a standalone energy project." />
      <ProjectForm mode="create" action={createProjectAction} customers={customerOptions} cancelHref="/projects" />
    </div>
  );
}
