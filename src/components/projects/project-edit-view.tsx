import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { getProjectById } from "@/lib/energy/projects/queries";
import { updateProjectAction } from "@/lib/energy/projects/actions";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectForm, type CustomerOption } from "./project-form";

export async function ProjectEditView({ id }: { id: string }) {
  const session = await requireSession();
  const project = await getProjectById({ companyId: session.companyId, id });
  if (!project) notFound();

  const sites = await prisma.projectSite.findMany({
    where: { companyId: session.companyId, customerId: project.customerId },
    orderBy: { name: "asc" },
  });

  const customerOptions: CustomerOption[] = [
    { id: project.customerId, name: project.customer.name, sites: sites.map((s) => ({ id: s.id, name: s.name })) },
  ];

  return (
    <div>
      <PageHeader title={`Edit ${project.projectNumber}`} description="Update this project." />
      <ProjectForm
        mode="edit"
        action={updateProjectAction.bind(null, id)}
        customers={customerOptions}
        cancelHref={`/projects/${id}`}
        lockCustomer
        defaults={{
          customerId: project.customerId,
          siteId: project.siteId,
          name: project.name,
          type: project.type,
          priority: project.priority,
          description: project.description,
          startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : null,
          expectedCompletionDate: project.expectedCompletionDate ? project.expectedCompletionDate.toISOString().slice(0, 10) : null,
          notes: project.notes,
        }}
      />
    </div>
  );
}
