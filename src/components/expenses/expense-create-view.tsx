import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createExpenseAction } from "@/lib/energy/expenses/actions";
import { listExpenseCategories } from "@/lib/energy/expenses/queries";
import { PageHeader } from "@/components/shared/page-header";
import { ExpenseForm } from "./expense-form";

export async function ExpenseCreateView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;
  const lockProjectId = typeof params.projectId === "string" ? params.projectId : undefined;

  const [categories, vendors, projects, sites] = await Promise.all([
    listExpenseCategories(session.companyId, true),
    prisma.party.findMany({ where: { companyId: session.companyId, type: "VENDOR", isActive: true }, orderBy: { name: "asc" } }),
    prisma.energyProject.findMany({ where: { companyId: session.companyId }, orderBy: { createdAt: "desc" }, select: { id: true, projectNumber: true, name: true } }),
    prisma.projectSite.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="New Expense" description="Record a business or project cost." />
      <ExpenseForm
        mode="create"
        action={createExpenseAction}
        categories={categories}
        vendors={vendors}
        projects={projects}
        sites={sites}
        cancelHref="/finance/expenses"
        lockProjectId={lockProjectId}
        defaults={lockProjectId ? { projectId: lockProjectId } : undefined}
      />
    </div>
  );
}
