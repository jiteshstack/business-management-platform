import Link from "next/link";
import { requireSession } from "@/lib/auth/current-session";
import { listReminderCandidates } from "@/lib/energy/reminders/queries";
import { canManageReminders } from "@/lib/core/permissions";
import { REMINDER_TYPES, REMINDER_TYPE_LABELS, type ReminderType } from "@/lib/energy/reminders/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogReminderForm } from "./log-reminder-form";

function isReminderTypeFilter(value: string | undefined): value is ReminderType {
  return (REMINDER_TYPES as readonly string[]).includes(value ?? "");
}

const TYPE_VARIANT: Record<ReminderType, "neutral" | "success" | "warning" | "danger"> = {
  UPCOMING: "neutral",
  DUE_TODAY: "warning",
  OVERDUE: "danger",
  PARTIAL_PAYMENT: "warning",
};

export async function RemindersView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const type = isReminderTypeFilter(typeof params.type === "string" ? params.type : undefined)
    ? (params.type as ReminderType)
    : "all";

  const canManage = canManageReminders(session.role);
  const candidates = await listReminderCandidates({ companyId: session.companyId, type });

  return (
    <div>
      <PageHeader title="Payment Reminders" description="Outstanding invoices that need collections follow-up." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="type" className="mb-1 block text-sm font-medium text-slate-700">
            Category
          </label>
          <Select id="type" name="type" defaultValue={type} className="w-48">
            <option value="all">All</option>
            {REMINDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {REMINDER_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {candidates.length === 0 ? (
        <EmptyState title="Nothing needs attention" description="No upcoming, due, overdue, or partially paid invoices right now." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Invoice</th>
                <th className="px-4 py-2.5">Due Date</th>
                <th className="px-4 py-2.5">Outstanding</th>
                <th className="px-4 py-2.5">Days Overdue</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Last Reminder</th>
                <th className="px-4 py-2.5">Next Follow-up</th>
                {canManage ? <th className="px-4 py-2.5">Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c) => (
                <tr key={c.invoiceId}>
                  <td className="px-4 py-2.5 text-slate-700">
                    <Link href={`/parties/clients/${c.clientId}`} className="hover:text-emerald-700 hover:underline">
                      {c.clientName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/sales/invoices/${c.invoiceId}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                      {c.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                    {c.dueDate ? c.dueDate.toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">₹{c.outstandingAmount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.daysOverdue > 0 ? c.daysOverdue : "-"}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={TYPE_VARIANT[c.type]}>{REMINDER_TYPE_LABELS[c.type]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    {c.lastReminderAt ? c.lastReminderAt.toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    {c.nextFollowUpDate ? c.nextFollowUpDate.toLocaleDateString() : "-"}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-2.5">
                      <LogReminderForm invoiceId={c.invoiceId} type={c.type} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
