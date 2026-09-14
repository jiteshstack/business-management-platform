import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getExpenseById, getExpenseDocuments } from "@/lib/energy/expenses/queries";
import { uploadExpenseDocumentAction, deleteExpenseDocumentAction } from "@/lib/energy/expenses/actions";
import { canManageExpenses, canApproveExpenses, canCancelExpenses } from "@/lib/core/permissions";
import { round2 } from "@/lib/energy/shared/pricing";
import { PAYMENT_MODE_LABELS, type PaymentMode } from "@/lib/energy/payments/types";
import { isExpenseDetailTabKey, EXPENSE_DETAIL_TABS, type ExpenseDetailTabKey } from "@/lib/energy/expenses/types";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DocumentsSection } from "@/components/parties/documents-section";
import { EmptyState } from "@/components/shared/empty-state";
import { ExpenseStatusBadge, ExpensePaymentBadge } from "./status-badge";
import { ApproveExpenseButton, CancelExpenseButton, RecordExpensePaymentForm } from "./expense-controls";

export async function ExpenseDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const expense = await getExpenseById({ companyId: session.companyId, id });
  if (!expense) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: ExpenseDetailTabKey = isExpenseDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageExpenses(session.role);
  const canApprove = canApproveExpenses(session.role);
  const canCancel = canCancelExpenses(session.role);

  const documents = tab === "documents" ? await getExpenseDocuments({ companyId: session.companyId, expenseId: id }) : [];
  const remaining = round2(expense.grandTotal - expense.paidAmount);

  return (
    <div>
      <PageHeader
        title={expense.expenseNumber}
        description={expense.category.name}
        actions={
          <>
            <ExpenseStatusBadge status={expense.status} />
            <ExpensePaymentBadge expense={expense} />
            {canManage && expense.status === "DRAFT" ? (
              <Link href={`/finance/expenses/${id}/edit`}>
                <Button size="sm"><Pencil className="h-4 w-4" />Edit</Button>
              </Link>
            ) : null}
            {canApprove && expense.status === "DRAFT" ? <ApproveExpenseButton id={id} /> : null}
            {canCancel && (expense.status === "DRAFT" || expense.status === "APPROVED") ? <CancelExpenseButton id={id} /> : null}
          </>
        }
      />

      <div className="mb-6 overflow-x-auto border-b border-slate-200">
        <nav className="flex min-w-max gap-1">
          {EXPENSE_DETAIL_TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? `/finance/expenses/${id}` : `/finance/expenses/${id}?tab=${t.key}`}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                tab === t.key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
                <Field label="Expense Date" value={expense.expenseDate.toLocaleDateString()} />
                <Field label="Category" value={expense.category.name} />
                <Field label="Amount" value={`₹${expense.amount.toLocaleString("en-IN")}`} />
                <Field label="Tax" value={expense.taxAmount ? `₹${expense.taxAmount.toLocaleString("en-IN")} (${expense.taxRate}%)` : undefined} />
                <Field label="Total" value={`₹${expense.grandTotal.toLocaleString("en-IN")}`} />
                <Field label="Vendor / Payee" value={expense.vendor ? <Link href={`/parties/vendors/${expense.vendor.id}`} className="text-emerald-700 hover:underline">{expense.vendor.name}</Link> : undefined} />
                <Field label="Project" value={expense.project ? <Link href={`/projects/${expense.project.id}`} className="text-emerald-700 hover:underline">{expense.project.projectNumber}</Link> : undefined} />
                <Field label="Site" value={expense.site?.name} />
                <Field label="Reference Number" value={expense.referenceNumber} />
                {expense.description ? (
                  <div className="sm:col-span-2">
                    <Field label="Description" value={expense.description} />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 py-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Paid</span>
                  <span className="font-medium text-slate-900">₹{expense.paidAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Remaining</span>
                  <span className="font-medium text-slate-900">₹{remaining.toLocaleString("en-IN")}</span>
                </div>
                {expense.paymentDate ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Last Payment Date</span>
                      <span>{expense.paymentDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Mode</span>
                      <span>{expense.paymentMode ? PAYMENT_MODE_LABELS[expense.paymentMode as PaymentMode] ?? expense.paymentMode : "-"}</span>
                    </div>
                  </>
                ) : null}
                {canManage && expense.status === "APPROVED" && remaining > 0 ? (
                  <div className="border-t border-slate-100 pt-3">
                    <RecordExpensePaymentForm id={id} remaining={remaining} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "documents" ? (
        <DocumentsSection
          documents={documents}
          uploadAction={uploadExpenseDocumentAction.bind(null, id)}
          deleteAction={deleteExpenseDocumentAction.bind(null, id)}
        />
      ) : null}

      {tab === "activity" ? <ActivityTab companyId={session.companyId} expenseId={id} /> : null}
    </div>
  );
}

async function ActivityTab({ companyId, expenseId }: { companyId: string; expenseId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "Expense", entityId: expenseId },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });
  if (logs.length === 0) return <EmptyState title="No activity yet" />;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {logs.map((log) => (
        <li key={log.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-slate-700">
            <span className="font-medium">{log.user?.name ?? "System"}</span> {log.action.toLowerCase().replaceAll("_", " ")}
          </span>
          <span className="text-xs text-slate-400">{log.createdAt.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, value }: { label: string; value?: string | null | React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</p>
    </div>
  );
}
