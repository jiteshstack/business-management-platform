import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getExpenseById } from "@/lib/energy/expenses/queries";
import { updateExpenseAction } from "@/lib/energy/expenses/actions";
import { listExpenseCategories } from "@/lib/energy/expenses/queries";
import { PageHeader } from "@/components/shared/page-header";
import { ExpenseForm } from "./expense-form";

export async function ExpenseEditView({ id }: { id: string }) {
  const session = await requireSession();
  const expense = await getExpenseById({ companyId: session.companyId, id });
  if (!expense) notFound();

  const [categories, vendors, projects, sites] = await Promise.all([
    listExpenseCategories(session.companyId, true),
    prisma.party.findMany({ where: { companyId: session.companyId, type: "VENDOR", isActive: true }, orderBy: { name: "asc" } }),
    prisma.energyProject.findMany({ where: { companyId: session.companyId }, orderBy: { createdAt: "desc" }, select: { id: true, projectNumber: true, name: true } }),
    prisma.projectSite.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title={`Edit ${expense.expenseNumber}`} />
      <ExpenseForm
        mode="edit"
        action={updateExpenseAction.bind(null, id)}
        categories={categories}
        vendors={vendors}
        projects={projects}
        sites={sites}
        cancelHref={`/finance/expenses/${id}`}
        defaults={{
          expenseDate: expense.expenseDate.toISOString().slice(0, 10),
          categoryId: expense.categoryId,
          amount: expense.amount,
          taxRate: expense.taxRate,
          vendorId: expense.vendorId,
          projectId: expense.projectId,
          siteId: expense.siteId,
          description: expense.description,
          referenceNumber: expense.referenceNumber,
        }}
      />
    </div>
  );
}
