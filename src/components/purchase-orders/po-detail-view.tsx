import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Printer, FileText } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getPurchaseOrderById } from "@/lib/energy/purchase-orders/queries";
import { setPurchaseOrderStatusAction } from "@/lib/energy/purchase-orders/actions";
import { receiveGoodsAction } from "@/lib/energy/purchase-receipts/actions";
import { createVendorInvoiceFromPurchaseOrderAction } from "@/lib/energy/vendor-invoices/actions";
import {
  canManagePurchaseOrders,
  canCancelPurchaseOrders,
  canReceivePurchases,
  canManageVendorInvoices,
} from "@/lib/core/permissions";
import {
  isPurchaseOrderDetailTabKey,
  PURCHASE_ORDER_STATUS_TRANSITIONS,
  PURCHASE_ORDER_STATUS_LABELS,
  RECEIVABLE_PO_STATUSES,
  INVOICEABLE_PO_STATUSES,
  type PurchaseOrderDetailTabKey,
  type PurchaseOrderStatus,
} from "@/lib/energy/purchase-orders/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PurchaseOrderStatusBadge } from "./status-badge";
import { PurchaseOrderTabs } from "./po-tabs";
import { ReceiveStockForm, type PendingLineItem } from "./receive-stock-form";

export async function PurchaseOrderDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const po = await getPurchaseOrderById({ companyId: session.companyId, id });
  if (!po) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: PurchaseOrderDetailTabKey = isPurchaseOrderDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManagePurchaseOrders(session.role);
  const canCancel = canCancelPurchaseOrders(session.role);
  const canReceive = canReceivePurchases(session.role);
  const canInvoice = canManageVendorInvoices(session.role);

  const allowedTransitions = PURCHASE_ORDER_STATUS_TRANSITIONS[po.status as PurchaseOrderStatus] ?? [];
  const isReceivable = RECEIVABLE_PO_STATUSES.includes(po.status as (typeof RECEIVABLE_PO_STATUSES)[number]);
  const isInvoiceable = INVOICEABLE_PO_STATUSES.includes(po.status as (typeof INVOICEABLE_PO_STATUSES)[number]);

  return (
    <div>
      <PageHeader
        title={po.poNumber}
        description={po.vendor.name}
        actions={
          <>
            <PurchaseOrderStatusBadge status={po.status} />
            <span className="text-sm font-semibold text-slate-900">₹{po.grandTotal.toLocaleString("en-IN")}</span>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {canManage && po.status === "DRAFT" ? (
          <Link href={`/purchase/purchase-orders/${id}/edit`}>
            <Button size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
        ) : null}
        <Link href={`/purchase/purchase-orders/${id}/print`} target="_blank">
          <Button variant="secondary" size="sm">
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </Link>
        {canInvoice && isInvoiceable ? (
          <form action={createVendorInvoiceFromPurchaseOrderAction.bind(null, id)}>
            <Button type="submit" variant="secondary" size="sm">
              <FileText className="h-4 w-4" />
              Create Vendor Invoice
            </Button>
          </form>
        ) : null}
        {canManage
          ? allowedTransitions
              .filter((next) => next !== "CANCELLED" || canCancel)
              .map((next) => (
                <form key={next} action={setPurchaseOrderStatusAction.bind(null, id, next)}>
                  <Button type="submit" variant={next === "CANCELLED" ? "danger" : "secondary"} size="sm">
                    Mark as {PURCHASE_ORDER_STATUS_LABELS[next]}
                  </Button>
                </form>
              ))
          : null}
      </div>

      <PurchaseOrderTabs basePath={`/purchase/purchase-orders/${id}`} active={tab} />

      {tab === "overview" ? <OverviewTab po={po} /> : null}
      {tab === "items" ? <ItemsTab po={po} /> : null}
      {tab === "pricing" ? <PricingTab po={po} /> : null}
      {tab === "receipts" ? <ReceiptsTab po={po} companyId={session.companyId} canReceive={canReceive && isReceivable} /> : null}
      {tab === "invoices" ? <InvoicesTab po={po} /> : null}
      {tab === "activity" ? <ActivityTab companyId={session.companyId} purchaseOrderId={id} /> : null}
    </div>
  );
}

type PurchaseOrderWithRelations = NonNullable<Awaited<ReturnType<typeof getPurchaseOrderById>>>;

function OverviewTab({ po }: { po: PurchaseOrderWithRelations }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <OverviewField label="Vendor" value={po.vendor.name} />
          <OverviewField label="Vendor Mobile" value={po.vendor.mobile} />
          <OverviewField label="PO Date" value={po.poDate.toLocaleDateString()} />
          <OverviewField label="Expected Delivery" value={po.expectedDeliveryDate?.toLocaleDateString()} />
          <OverviewField label="Reference" value={po.referenceNumber} />
          {po.notes ? (
            <div className="sm:col-span-2">
              <OverviewField label="Notes" value={po.notes} />
            </div>
          ) : null}
          {po.termsAndConditions ? (
            <div className="sm:col-span-2">
              <OverviewField label="Terms & Conditions" value={po.termsAndConditions} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemsTab({ po }: { po: PurchaseOrderWithRelations }) {
  if (po.items.length === 0) {
    return <EmptyState title="No items" />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Product</th>
            <th className="px-4 py-2.5">Qty</th>
            <th className="px-4 py-2.5">Received</th>
            <th className="px-4 py-2.5">Pending</th>
            <th className="px-4 py-2.5">Rate</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {po.items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-2.5 font-medium text-slate-900">
                {item.productCode ? `${item.productCode} - ` : ""}
                {item.productName}
              </td>
              <td className="px-4 py-2.5 text-slate-600">{item.quantity}</td>
              <td className="px-4 py-2.5 text-slate-600">{item.receivedQuantity}</td>
              <td className="px-4 py-2.5 text-slate-600">{item.quantity - item.receivedQuantity}</td>
              <td className="px-4 py-2.5 text-slate-600">₹{item.unitPrice.toLocaleString("en-IN")}</td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">₹{item.lineTotal.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PricingTab({ po }: { po: PurchaseOrderWithRelations }) {
  const itemDiscountTotal = po.items.reduce((sum, item) => sum + item.discountAmount, 0);
  return (
    <Card className="max-w-md">
      <CardContent className="space-y-2 py-4 text-sm">
        <Row label="Subtotal" value={po.subtotal} />
        <Row label="Item Discounts" value={-itemDiscountTotal} />
        <Row label="Taxable Amount" value={po.taxableAmount} />
        <Row label="GST / Tax" value={po.taxAmount} />
        {po.discountPercent ? <Row label={`Overall Discount (${po.discountPercent}%)`} value={-po.discountAmount} /> : null}
        <Row label="Other Charges" value={po.otherCharges} />
        <div className="border-t border-slate-200 pt-2">
          <Row label="Grand Total" value={po.grandTotal} bold />
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

async function ReceiptsTab({
  po,
  companyId,
  canReceive,
}: {
  po: PurchaseOrderWithRelations;
  companyId: string;
  canReceive: boolean;
}) {
  const pendingItems: PendingLineItem[] = po.items
    .filter((item) => item.quantity - item.receivedQuantity > 0)
    .map((item) => ({
      id: item.id,
      productName: item.productName,
      productCode: item.productCode,
      unitLabel: item.unitLabel,
      pendingQuantity: item.quantity - item.receivedQuantity,
    }));

  const locations = await prisma.location.findMany({ where: { companyId, isActive: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-4">
      {canReceive && pendingItems.length > 0 ? (
        <Card>
          <CardContent className="py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Receive Stock</p>
            <ReceiveStockForm
              action={receiveGoodsAction.bind(null, po.id)}
              locations={locations}
              pendingItems={pendingItems}
            />
          </CardContent>
        </Card>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Receipt History</p>
        {po.receipts.length === 0 ? (
          <EmptyState title="No receipts yet" description="Stock received against this purchase order will show up here." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Receipt</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {po.receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{receipt.receiptNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600">{receipt.receiptDate.toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-slate-600">{receipt.location.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {receipt.items.reduce((sum, i) => sum + i.quantity, 0)} unit(s)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InvoicesTab({ po }: { po: PurchaseOrderWithRelations }) {
  if (po.vendorInvoices.length === 0) {
    return <EmptyState title="No vendor invoices yet" description="Use Create Vendor Invoice above once this order is confirmed." />;
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
          {po.vendorInvoices.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-2.5">
                <Link href={`/purchase/vendor-invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
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

async function ActivityTab({ companyId, purchaseOrderId }: { companyId: string; purchaseOrderId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "PurchaseOrder", entityId: purchaseOrderId },
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

function OverviewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</p>
    </div>
  );
}
