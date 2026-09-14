import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Printer, IndianRupee } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getVendorInvoiceById } from "@/lib/energy/vendor-invoices/queries";
import { setVendorInvoiceStatusAction } from "@/lib/energy/vendor-invoices/actions";
import { listAllocationsForVendorInvoice } from "@/lib/energy/vendor-payments/queries";
import { canManageVendorInvoices, canCancelVendorInvoices, canManageVendorPayments } from "@/lib/core/permissions";
import {
  isVendorInvoiceDetailTabKey,
  VENDOR_INVOICE_STATUS_TRANSITIONS,
  VENDOR_INVOICE_STATUS_LABELS,
  type VendorInvoiceDetailTabKey,
  type VendorInvoiceStatus,
} from "@/lib/energy/vendor-invoices/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VendorInvoiceStatusBadge, isVendorInvoiceOverdue, OverdueBadge } from "./status-badge";
import { VendorInvoiceTabs } from "./invoice-tabs";

export async function VendorInvoiceDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const invoice = await getVendorInvoiceById({ companyId: session.companyId, id });
  if (!invoice) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: VendorInvoiceDetailTabKey = isVendorInvoiceDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageVendorInvoices(session.role);
  const canCancel = canCancelVendorInvoices(session.role);
  const canRecordPayment = canManageVendorPayments(session.role);
  const overdue = isVendorInvoiceOverdue(invoice);

  const allowedTransitions = VENDOR_INVOICE_STATUS_TRANSITIONS[invoice.status as VendorInvoiceStatus] ?? [];
  const canReceivePayment = (invoice.status === "UNPAID" || invoice.status === "PARTIALLY_PAID") && invoice.outstandingAmount > 0;

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.vendor.name}${invoice.purchaseOrder ? ` · from ${invoice.purchaseOrder.poNumber}` : ""}`}
        actions={
          <>
            <VendorInvoiceStatusBadge status={invoice.status} />
            {overdue ? <OverdueBadge /> : null}
            <span className="text-sm font-semibold text-slate-900">₹{invoice.grandTotal.toLocaleString("en-IN")}</span>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {canManage && invoice.status === "DRAFT" ? (
          <Link href={`/purchase/vendor-invoices/${id}/edit`}>
            <Button size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
        ) : null}
        <Link href={`/purchase/vendor-invoices/${id}/print`} target="_blank">
          <Button variant="secondary" size="sm">
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </Link>
        {canRecordPayment && canReceivePayment ? (
          <Link href={`/purchase/payments-made/new?vendorInvoiceId=${id}`}>
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
                <form key={next} action={setVendorInvoiceStatusAction.bind(null, id, next)}>
                  <Button type="submit" variant={next === "CANCELLED" ? "danger" : "secondary"} size="sm">
                    Mark as {VENDOR_INVOICE_STATUS_LABELS[next]}
                  </Button>
                </form>
              ))
          : null}
      </div>

      <VendorInvoiceTabs basePath={`/purchase/vendor-invoices/${id}`} active={tab} />

      {tab === "overview" ? <OverviewTab invoice={invoice} /> : null}
      {tab === "items" ? <ItemsTab invoice={invoice} /> : null}
      {tab === "pricing" ? <PricingTab invoice={invoice} /> : null}
      {tab === "payment" ? <PaymentTab invoice={invoice} companyId={session.companyId} /> : null}
      {tab === "references" ? <ReferencesTab invoice={invoice} /> : null}
      {tab === "activity" ? <ActivityTab companyId={session.companyId} vendorInvoiceId={id} /> : null}
    </div>
  );
}

type VendorInvoiceWithRelations = NonNullable<Awaited<ReturnType<typeof getVendorInvoiceById>>>;

function OverviewTab({ invoice }: { invoice: VendorInvoiceWithRelations }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <OverviewField label="Vendor" value={invoice.vendor.name} />
          <OverviewField label="Vendor Mobile" value={invoice.vendor.mobile} />
          <OverviewField label="Vendor's Bill Number" value={invoice.vendorInvoiceNumber} />
          <OverviewField label="Invoice Date" value={invoice.invoiceDate.toLocaleDateString()} />
          <OverviewField label="Due Date" value={invoice.dueDate?.toLocaleDateString()} />
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

function ItemsTab({ invoice }: { invoice: VendorInvoiceWithRelations }) {
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
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">₹{item.lineTotal.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PricingTab({ invoice }: { invoice: VendorInvoiceWithRelations }) {
  const itemDiscountTotal = invoice.items.reduce((sum, item) => sum + item.discountAmount, 0);
  return (
    <Card className="max-w-md">
      <CardContent className="space-y-2 py-4 text-sm">
        <Row label="Subtotal" value={invoice.subtotal} />
        <Row label="Item Discounts" value={-itemDiscountTotal} />
        <Row label="Taxable Amount" value={invoice.taxableAmount} />
        <Row label="GST / Tax" value={invoice.taxAmount} />
        {invoice.discountPercent ? <Row label={`Overall Discount (${invoice.discountPercent}%)`} value={-invoice.discountAmount} /> : null}
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

async function PaymentTab({ invoice, companyId }: { invoice: VendorInvoiceWithRelations; companyId: string }) {
  const allocations = await listAllocationsForVendorInvoice({ companyId, vendorInvoiceId: invoice.id });

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
                    href={`/purchase/payments-made/${alloc.vendorPaymentId}`}
                    className={
                      alloc.vendorPayment.status === "CANCELLED"
                        ? "text-slate-400 line-through hover:underline"
                        : "font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                    }
                  >
                    {alloc.vendorPayment.paymentNumber}
                  </Link>
                  <span className={alloc.vendorPayment.status === "CANCELLED" ? "text-slate-400 line-through" : "text-slate-700"}>
                    ₹{alloc.amount.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReferencesTab({ invoice }: { invoice: VendorInvoiceWithRelations }) {
  return (
    <Card className="max-w-md">
      <CardContent className="space-y-3 py-4 text-sm">
        <OverviewField
          label="Purchase Order"
          value={
            invoice.purchaseOrder ? (
              <Link href={`/purchase/purchase-orders/${invoice.purchaseOrder.id}`} className="text-emerald-700 hover:underline">
                {invoice.purchaseOrder.poNumber}
              </Link>
            ) : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

async function ActivityTab({ companyId, vendorInvoiceId }: { companyId: string; vendorInvoiceId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "VendorInvoice", entityId: vendorInvoiceId },
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
