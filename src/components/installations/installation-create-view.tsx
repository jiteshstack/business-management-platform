import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { getProjectById } from "@/lib/energy/projects/queries";
import { createInstallationAction } from "@/lib/energy/installations/actions";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { CreateInstallationForm, type PendingScopeItem } from "./create-installation-form";

export async function InstallationCreateView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const projectId = typeof params.projectId === "string" ? params.projectId : undefined;
  if (!projectId) notFound();

  const project = await getProjectById({ companyId: session.companyId, id: projectId });
  if (!project) notFound();

  const [sites, users] = await Promise.all([
    prisma.projectSite.findMany({ where: { companyId: session.companyId, customerId: project.customerId }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const pendingItems: PendingScopeItem[] = project.items
    .filter((item) => item.assignedQuantity - item.installedQuantity > 0)
    .map((item) => ({
      id: item.id,
      productName: item.productName,
      productCode: item.productCode,
      unitLabel: item.unitLabel,
      pendingQuantity: item.assignedQuantity - item.installedQuantity,
    }));

  return (
    <div>
      <PageHeader title="New Installation" description={`For project ${project.projectNumber} - ${project.name}`} />
      <CreateInstallationForm
        action={createInstallationAction.bind(null, projectId)}
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        users={users}
        defaultSiteId={project.siteId}
        pendingItems={pendingItems}
      />
    </div>
  );
}
