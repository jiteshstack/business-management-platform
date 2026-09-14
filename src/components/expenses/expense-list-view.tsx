import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listExpenses, listExpenseCategories } from "@/lib/energy/expenses/queries";
import { canManageExpenses } from "@/lib/core/permissions";
import {
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABELS,
  EXPENSE_PAYMENT_STATUSES,
  type ExpenseStatus,
  type ExpensePaymentStatus,
} from "@/lib/energy/expenses/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ExpenseStatusBadge, ExpensePaymentBadge } from "./status-badge";

function isStatus(value: string | undefined): value is ExpenseStatus {
  return (EXPENSE_STATUSES as readonly string[]).includes(value ?? "");
}
function isPaymentStatus(value: string | undefined): value is ExpensePaymentStatus {
  return (EXPENSE_PAYMENT_STATUSES as readonly string[]).includes(value ?? "");
}

export async function ExpenseListView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : "";
  const status = isStatus(typeof params.status === "string" ? params.status : undefined) ? (params.status as ExpenseStatus) : "all";
  const paymentStatus = isPaymentStatus(typeof params.paymentStatus === "string" ? params.paymentStatus : undefined)
    ? (params.paymentStatus as ExpensePaymentStatus)
    : "all";
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const canCreate = canManageExpenses(session.role);
  const [{ items, total, pageSize }, categories] = await Promise.all([
    listExpenses({ companyId: session.companyId, q, categoryId: categoryId || undefined, status, paymentStatus, dateFrom, dateTo, page }),
    listExpenseCategories(session.companyId, true),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (categoryId) qs.set("categoryId", categoryId);
    if (status !== "all") qs.set("status", status);
    if (paymentStatus !== "all") qs.set("paymentStatus", paymentStatus);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const query = qs.toString();
    return query ? `/finance/expenses?${query}` : "/finance/expenses";
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Business and project operating costs."
        actions={
          canCreate ? (
            <Link href="/finance/expenses/new">
              <Button><Plus className="h-4 w-4" />New Expense</Button>
            </Link>
          ) : undefined
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="q" name="q" defaultValue={q} placeholder="Expense number, payee, description…" className="pl-8" />
          </div>
        </div>
        <div>
          <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-slate-700">Category</label>
          <Select id="categoryId" name="categoryId" defaultValue={categoryId} className="w-44">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <Select id="status" name="status" defaultValue={status} className="w-36">
            <option value="all">All</option>
            {EXPENSE_STATUSES.map((s) => (
              <option key={s} value={s}>{EXPENSE_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="paymentStatus" className="mb-1 block text-sm font-medium text-slate-700">Payment</label>
          <Select id="paymentStatus" name="paymentStatus" defaultValue={paymentStatus} className="w-36">
            <option value="all">All</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
          </Select>
        </div>
        <div>
          <label htmlFor="dateFrom" className="mb-1 block text-sm font-medium text-slate-700">From</label>
          <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom ?? ""} />
        </div>
        <div>
          <label htmlFor="dateTo" className="mb-1 block text-sm font-medium text-slate-700">To</label>
          <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo ?? ""} />
        </div>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Record a business or project expense to get started."
          action={canCreate ? <Link href="/finance/expenses/new"><Button size="sm"><Plus className="h-4 w-4" />New Expense</Button></Link> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Number</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Vendor/Payee</th>
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/finance/expenses/${e.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{e.expenseNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{e.expenseDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-slate-700">{e.category.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.vendor?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.project?.projectNumber ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-700">₹{e.grandTotal.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5"><ExpensePaymentBadge expense={e} /></td>
                  <td className="px-4 py-2.5"><ExpenseStatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <p>Showing {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}</p>
          <div className="flex gap-2">
            {page <= 1 ? <Button variant="secondary" size="sm" disabled>Previous</Button> : <Link href={pageHref(page - 1)}><Button variant="secondary" size="sm">Previous</Button></Link>}
            {page >= totalPages ? <Button variant="secondary" size="sm" disabled>Next</Button> : <Link href={pageHref(page + 1)}><Button variant="secondary" size="sm">Next</Button></Link>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
