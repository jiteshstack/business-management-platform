import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Printer, IndianRupee } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getInvoiceById } from "@/lib/energy/invoices/queries";
import { setInvoiceStatusAction } from "@/lib/energy/invoices/actions";
import { listAllocationsForInvoice } from "@/lib/energy/payments/queries";
import { listRemindersForInvoice } from "@/lib/energy/reminders/queries";
import { canManageInvoices, canCancelInvoices, canManagePayments } from "@/lib/core/permissions";
import {
  isInvoiceDetailTabKey,
  INVOICE_STATUS_TRANSITIONS,
  INVOICE_STATUS_LABELS,
  type InvoiceDetailTabKey,
  type InvoiceStatus,
} from "@/lib/energy/invoices/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceStatusBadge, isInvoiceOverdue, OverdueBadge } from "./status-badge";
import { InvoiceTabs } from "./invoice-tabs";

export async function InvoiceDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const invoice = await getInvoiceById({ companyId: session.companyId, id });
  if (!invoice) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: InvoiceDetailTabKey = isInvoiceDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageInvoices(session.role);
  const canCancel = canCancelInvoices(session.role);
  const canRecordPayment = canManagePayments(session.role);
  const overdue = isInvoiceOverdue(invoice);

  const allowedTransitions = INVOICE_STATUS_TRANSITIONS[invoice.status as InvoiceStatus] ?? [];
  const canReceivePayment = (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") && invoice.outstandingAmount > 0;

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.client.name}${invoice.salesOrder ? ` · from ${invoice.salesOrder.soNumber}` : ""}`}
        actions={
          <>
            <InvoiceStatusBadge status={invoice.status} />
            {overdue ? <OverdueBadge /> : null}
            <span className="text-sm font-semibold text-slate-900">₹{invoice.grandTotal.toLocaleString("en-IN")}</span>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {canManage && invoice.status === "DRAFT" ? (
          <Link href={`/sales/invoices/${id}/edit`}>
            <Button size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
        ) : null}
        <Link href={`/sales/invoices/${id}/print`} target="_blank">
          <Button variant="secondary" size="sm">
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </Link>
        {canRecordPayment && canReceivePayment ? (
          <Link href={`/sales/payments-received/new?invoiceId=${id}`}>
            <Button size="sm">
              <IndianRupee className="h-4 w-4" />
              Record Payment
            </Button>
          </Link>
        ) : null}
        {canManage
          ? allowedTransitions
              .filter((next) => next !== "CANCELLED" || canCancel)
              .map((next) => (
                <form key={next} action={setInvoiceStatusAction.bind(null, id, next)}>
                  <Button type="submit" variant={next === "CANCELLED" ? "danger" : "secondary"} size="sm">
                    Mark as {INVOICE_STATUS_LABELS[next]}
                  </Button>
                </form>
              ))
          : null}
      </div>

      <InvoiceTabs basePath={`/sales/invoices/${id}`} active={tab} />

      {tab === "overview" ? <OverviewTab invoice={invoice} /> : null}
      {tab === "items" ? <ItemsTab invoice={invoice} /> : null}
      {tab === "pricing" ? <PricingTab invoice={invoice} /> : null}
      {tab === "payment" ? <PaymentTab invoice={invoice} companyId={session.companyId} /> : null}
      {tab === "references" ? <ReferencesTab invoice={invoice} /> : null}
      {tab === "activity" ? <ActivityTab companyId={session.companyId} invoiceId={id} /> : null}
    </div>
  );
}

type InvoiceWithRelations = NonNullable<Awaited<ReturnType<typeof getInvoiceById>>>;

function OverviewTab({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <OverviewField label="Client" value={invoice.client.name} />
          <OverviewField label="Client Mobile" value={invoice.client.mobile} />
          <OverviewField label="Billing Address" value={invoice.billingAddressText} />
          <OverviewField label="Site" value={invoice.siteAddressText} />
          <OverviewField label="Invoice Date" value={invoice.invoiceDate.toLocaleDateString()} />
          <OverviewField label="Due Date" value={invoice.dueDate?.toLocaleDateString()} />
          <OverviewField label="Payment Terms" value={invoice.paymentTerms} />
          {invoice.notes ? (
            <div className="sm:col-span-2">
              <OverviewField label="Notes" value={invoice.notes} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemsTab({ invoice }: { invoice: InvoiceWithRelations }) {
  if (invoice.items.length === 0) {
    return <EmptyState title="No items" />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Product</th>
            <th className="px-4 py-2.5">Description</th>
            <th className="px-4 py-2.5">Qty</th>
            <th className="px-4 py-2.5">Unit</th>
            <th className="px-4 py-2.5">Rate</th>
            <th className="px-4 py-2.5">Disc %</th>
            <th className="px-4 py-2.5">Tax %</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoice.items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-2.5 font-medium text-slate-900">
                {item.productCode ? `${item.productCode} - ` : ""}
                {item.productName}
              </td>
              <td className="px-4 py-2.5 text-slate-500">{item.description ?? "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">{item.quantity}</td>
              <td className="px-4 py-2.5 text-slate-600">{item.unitLabel ?? "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">₹{item.unitPrice.toLocaleString("en-IN")}</td>
              <td className="px-4 py-2.5 text-slate-600">{item.discountPercent ?? 0}%</td>
              <td className="px-4 py-2.5 text-slate-600">{item.taxRate ?? 0}%</td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                ₹{item.lineTotal.toLocaleString("en-IN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PricingTab({ invoice }: { invoice: InvoiceWithRelations }) {
  const itemDiscountTotal = invoice.items.reduce((sum, item) => sum + item.discountAmount, 0);
  return (
    <Card className="max-w-md">
      <CardContent className="space-y-2 py-4 text-sm">
        <Row label="Subtotal" value={invoice.subtotal} />
        <Row label="Item Discounts" value={-itemDiscountTotal} />
        <Row label="Taxable Amount" value={invoice.taxableAmount} />
        <Row label="GST / Tax" value={invoice.taxAmount} />
        {invoice.discountPercent ? (
          <Row label={`Overall Discount (${invoice.discountPercent}%)`} value={-invoice.discountAmount} />
        ) : null}
        <Row label="Other Charges" value={invoice.otherCharges} />
        <div className="border-t border-slate-200 pt-2">
          <Row label="Grand Total" value={invoice.grandTotal} bold />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "text-base" : ""}`}>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</span>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-700"}>
        ₹{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

async function PaymentTab({ invoice, companyId }: { invoice: InvoiceWithRelations; companyId: string }) {
  const [allocations, reminders] = await Promise.all([
    listAllocationsForInvoice({ companyId, invoiceId: invoice.id }),
    listRemindersForInvoice({ companyId, invoiceId: invoice.id }),
  ]);

  // Simple chronological timeline built from the invoice's own lifecycle —
  // issue + each payment received — for visibility only, no duplicate data.
  const timeline: { label: string; date: Date }[] = [{ label: "Invoice Issued", date: invoice.invoiceDate }];
  for (const alloc of allocations) {
    if (alloc.payment.status === "CANCELLED") continue;
    timeline.push({
      label: `Payment Received (₹${alloc.amount.toLocaleString("en-IN")} via ${alloc.payment.paymentNumber})`,
      date: alloc.payment.paymentDate,
    });
  }
  if (invoice.status === "PAID") {
    timeline.push({ label: "Fully Paid", date: invoice.updatedAt });
  }
  timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-2 py-4 text-sm">
          <Row label="Grand Total" value={invoice.grandTotal} />
          <Row label="Paid" value={invoice.paidAmount} />
          <div className="border-t border-slate-200 pt-2">
            <Row label="Outstanding" value={invoice.outstandingAmount} bold />
          </div>
          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <span>Due Date</span>
            <span>{invoice.dueDate ? invoice.dueDate.toLocaleDateString() : "-"}</span>
          </div>

          <p className="pt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Payment History</p>
          {allocations.length === 0 ? (
            <p className="text-sm text-slate-400">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {allocations.map((alloc) => (
                <li key={alloc.id} className="flex items-center justify-between py-2">
                  <Link
                    href={`/sales/payments-received/${alloc.paymentId}`}
                    className={
                      alloc.payment.status === "CANCELLED"
                        ? "text-slate-400 line-through hover:underline"
                        : "font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                    }
                  >
                    {alloc.payment.paymentNumber}
                  </Link>
                  <span className={alloc.payment.status === "CANCELLED" ? "text-slate-400 line-through" : "text-slate-700"}>
                    ₹{alloc.amount.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Timeline</p>
            <ul className="space-y-2 text-sm">
              {timeline.map((step, index) => (
                <li key={index} className="flex items-center justify-between">
                  <span className="text-slate-700">{step.label}</span>
                  <span className="text-xs text-slate-400">{step.date.toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Reminder History</p>
            {reminders.length === 0 ? (
              <p className="text-sm text-slate-400">No reminders logged yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {reminders.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <span className="text-slate-700">{r.type.replaceAll("_", " ")}</span>
                    <span className="text-xs text-slate-400">{r.reminderDate.toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReferencesTab({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <Card className="max-w-md">
      <CardContent className="space-y-3 py-4 text-sm">
        <OverviewField
          label="Sales Order"
          value={
            invoice.salesOrder ? (
              <Link href={`/sales/sales-orders/${invoice.salesOrder.id}`} className="text-emerald-700 hover:underline">
                {invoice.salesOrder.soNumber}
              </Link>
            ) : undefined
          }
        />
        <OverviewField
          label="Quotation"
          value={
            invoice.quotation ? (
              <Link href={`/sales/quotations/${invoice.quotation.id}`} className="text-emerald-700 hover:underline">
                {invoice.quotation.quotationNumber}
              </Link>
            ) : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

async function ActivityTab({ companyId, invoiceId }: { companyId: string; invoiceId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "Invoice", entityId: invoiceId },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });
  if (logs.length === 0) {
    return <EmptyState title="No activity yet" />;
  }
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

function OverviewField({ label, value }: { label: string; value?: string | null | React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</p>
    </div>
  );
}
