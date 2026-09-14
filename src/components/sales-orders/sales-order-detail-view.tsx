import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Printer, FileText } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getSalesOrderById } from "@/lib/energy/sales-orders/queries";
import { setSalesOrderStatusAction } from "@/lib/energy/sales-orders/actions";
import { createInvoiceFromSalesOrderAction } from "@/lib/energy/invoices/actions";
import { listProjectsForSalesOrder } from "@/lib/energy/projects/queries";
import { createProjectFromSalesOrderAction } from "@/lib/energy/projects/actions";
import { ProjectStatusBadge } from "@/components/projects/status-badge";
import { canManageSalesOrders, canCancelSalesOrders, canManageInvoices, canManageProjects } from "@/lib/core/permissions";
import {
  isSalesOrderDetailTabKey,
  SALES_ORDER_STATUS_TRANSITIONS,
  SALES_ORDER_STATUS_LABELS,
  type SalesOrderDetailTabKey,
  type SalesOrderStatus,
} from "@/lib/energy/sales-orders/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SalesOrderStatusBadge } from "./status-badge";
import { SalesOrderTabs } from "./sales-order-tabs";

const CAN_INVOICE_STATUSES = ["CONFIRMED", "PARTIALLY_FULFILLED", "COMPLETED"];

export async function SalesOrderDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const salesOrder = await getSalesOrderById({ companyId: session.companyId, id });
  if (!salesOrder) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: SalesOrderDetailTabKey = isSalesOrderDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageSalesOrders(session.role);
  const canCancel = canCancelSalesOrders(session.role);
  const canInvoice = canManageInvoices(session.role);

  const allowedTransitions = SALES_ORDER_STATUS_TRANSITIONS[salesOrder.status as SalesOrderStatus] ?? [];

  return (
    <div>
      <PageHeader
        title={salesOrder.soNumber}
        description={`${salesOrder.client.name}${salesOrder.quotation ? ` · from ${salesOrder.quotation.quotationNumber}` : ""}`}
        actions={
          <>
            <SalesOrderStatusBadge status={salesOrder.status} />
            <span className="text-sm font-semibold text-slate-900">
              ₹{salesOrder.grandTotal.toLocaleString("en-IN")}
            </span>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {canManage && salesOrder.status === "DRAFT" ? (
          <Link href={`/sales/sales-orders/${id}/edit`}>
            <Button size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
        ) : null}
        <Link href={`/sales/sales-orders/${id}/print`} target="_blank">
          <Button variant="secondary" size="sm">
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </Link>
        {canInvoice && CAN_INVOICE_STATUSES.includes(salesOrder.status) ? (
          <form action={createInvoiceFromSalesOrderAction.bind(null, id)}>
            <Button type="submit" variant="secondary" size="sm">
              <FileText className="h-4 w-4" />
              Create Invoice
            </Button>
          </form>
        ) : null}
        {canManage
          ? allowedTransitions
              .filter((next) => next !== "CANCELLED" || canCancel)
              .map((next) => (
                <form key={next} action={setSalesOrderStatusAction.bind(null, id, next)}>
                  <Button type="submit" variant={next === "CANCELLED" ? "danger" : "secondary"} size="sm">
                    Mark as {SALES_ORDER_STATUS_LABELS[next]}
                  </Button>
                </form>
              ))
          : null}
      </div>

      <SalesOrderTabs basePath={`/sales/sales-orders/${id}`} active={tab} />

      {tab === "overview" ? <OverviewTab salesOrder={salesOrder} /> : null}
      {tab === "overview" ? <ProjectSection companyId={session.companyId} salesOrderId={id} canCreate={canManageProjects(session.role)} isEligible={salesOrder.status !== "DRAFT" && salesOrder.status !== "CANCELLED"} /> : null}
      {tab === "items" ? <ItemsTab salesOrder={salesOrder} /> : null}
      {tab === "pricing" ? <PricingTab salesOrder={salesOrder} /> : null}
      {tab === "inventory" ? <InventoryTab salesOrder={salesOrder} /> : null}
      {tab === "invoices" ? <InvoicesTab salesOrder={salesOrder} /> : null}
      {tab === "activity" ? <ActivityTab companyId={session.companyId} salesOrderId={id} /> : null}
    </div>
  );
}

type SalesOrderWithRelations = NonNullable<Awaited<ReturnType<typeof getSalesOrderById>>>;

function OverviewTab({ salesOrder }: { salesOrder: SalesOrderWithRelations }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <OverviewField label="Client" value={salesOrder.client.name} />
          <OverviewField label="Client Mobile" value={salesOrder.client.mobile} />
          <OverviewField label="Site" value={salesOrder.siteAddressText} />
          <OverviewField label="Order Date" value={salesOrder.orderDate.toLocaleDateString()} />
          <OverviewField label="Expected Delivery" value={salesOrder.expectedDeliveryDate?.toLocaleDateString()} />
          <OverviewField label="Salesperson" value={salesOrder.salesperson?.name} />
          <OverviewField
            label="Source Quotation"
            value={
              salesOrder.quotation ? (
                <Link
                  href={`/sales/quotations/${salesOrder.quotation.id}`}
                  className="text-emerald-700 hover:underline"
                >
                  {salesOrder.quotation.quotationNumber}
                </Link>
              ) : undefined
            }
          />
          {salesOrder.notes ? (
            <div className="sm:col-span-2">
              <OverviewField label="Notes" value={salesOrder.notes} />
            </div>
          ) : null}
          <OverviewField label="Payment Terms" value={salesOrder.paymentTerms} />
        </CardContent>
      </Card>
    </div>
  );
}

async function ProjectSection({
  companyId,
  salesOrderId,
  canCreate,
  isEligible,
}: {
  companyId: string;
  salesOrderId: string;
  canCreate: boolean;
  isEligible: boolean;
}) {
  const projects = await listProjectsForSalesOrder({ companyId, salesOrderId });

  return (
    <Card className="mt-4">
      <CardContent className="py-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Project</p>
        {projects.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                  {p.projectNumber} - {p.name}
                </Link>
                <ProjectStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        ) : canCreate && isEligible ? (
          <form action={createProjectFromSalesOrderAction.bind(null, salesOrderId)}>
            <Button type="submit" variant="secondary" size="sm">
              Create Project
            </Button>
          </form>
        ) : (
          <p className="text-sm text-slate-400">No project has been started for this order yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ItemsTab({ salesOrder }: { salesOrder: SalesOrderWithRelations }) {
  if (salesOrder.items.length === 0) {
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
          {salesOrder.items.map((item) => (
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

function PricingTab({ salesOrder }: { salesOrder: SalesOrderWithRelations }) {
  const itemDiscountTotal = salesOrder.items.reduce((sum, item) => sum + item.discountAmount, 0);
  return (
    <Card className="max-w-md">
      <CardContent className="space-y-2 py-4 text-sm">
        <Row label="Subtotal" value={salesOrder.subtotal} />
        <Row label="Item Discounts" value={-itemDiscountTotal} />
        <Row label="Taxable Amount" value={salesOrder.taxableAmount} />
        <Row label="GST / Tax" value={salesOrder.taxAmount} />
        {salesOrder.discountPercent ? (
          <Row label={`Overall Discount (${salesOrder.discountPercent}%)`} value={-salesOrder.discountAmount} />
        ) : null}
        <Row label="Other Charges" value={salesOrder.otherCharges} />
        <div className="border-t border-slate-200 pt-2">
          <Row label="Grand Total" value={salesOrder.grandTotal} bold />
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

function InventoryTab({ salesOrder }: { salesOrder: SalesOrderWithRelations }) {
  return (
    <Card className="max-w-lg">
      <CardContent className="space-y-3 py-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Stock Reservation</span>
          {salesOrder.stockReserved ? <Badge variant="success">Reserved</Badge> : <Badge variant="neutral">Not reserved</Badge>}
        </div>
        <p className="text-xs text-slate-400">
          Confirming this sales order reserves stock for each line item; cancelling it releases any reservation.
          Products that aren&apos;t stock-tracked are skipped.
        </p>
      </CardContent>
    </Card>
  );
}

function InvoicesTab({ salesOrder }: { salesOrder: SalesOrderWithRelations }) {
  if (salesOrder.invoices.length === 0) {
    return <EmptyState title="No invoices yet" description="Use Create Invoice above once this order is confirmed." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Invoice</th>
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {salesOrder.invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-2.5">
                <Link href={`/sales/invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                  {inv.invoiceNumber}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{inv.invoiceDate.toLocaleDateString()}</td>
              <td className="px-4 py-2.5 text-slate-600">{inv.status}</td>
              <td className="px-4 py-2.5 text-right text-slate-700">₹{inv.grandTotal.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function ActivityTab({ companyId, salesOrderId }: { companyId: string; salesOrderId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "SalesOrder", entityId: salesOrderId },
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
