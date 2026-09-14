import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { getProjectSiteById } from "@/lib/energy/project-sites/queries";
import { updateProjectSiteAction } from "@/lib/energy/project-sites/actions";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectSiteForm, type CustomerOption } from "./site-form";

export async function ProjectSiteEditView({ id }: { id: string }) {
  const session = await requireSession();
  const site = await getProjectSiteById({ companyId: session.companyId, id });
  if (!site) notFound();

  const customers = await prisma.party.findMany({
    where: { companyId: session.companyId, type: "CLIENT", isActive: true },
    orderBy: { name: "asc" },
  });
  const customerOptions: CustomerOption[] = customers.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div>
      <PageHeader title={`Edit ${site.name}`} description="Update this site." />
      <ProjectSiteForm
        mode="edit"
        action={updateProjectSiteAction.bind(null, id)}
        customers={customerOptions}
        cancelHref={`/projects/sites/${id}`}
        defaults={{
          customerId: site.customerId,
          name: site.name,
          line1: site.line1,
          line2: site.line2,
          city: site.city,
          state: site.state,
          pincode: site.pincode,
          landmark: site.landmark,
          contactPerson: site.contactPerson,
          contactPhone: site.contactPhone,
          contactEmail: site.contactEmail,
          notes: site.notes,
        }}
      />
    </div>
  );
}
