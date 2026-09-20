import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Copy, GitBranch, Printer, ShoppingCart } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getQuotationById, getQuotationRevisions } from "@/lib/energy/quotations/queries";
import { setQuotationStatusAction, createRevisionAction, duplicateQuotationAction } from "@/lib/energy/quotations/actions";
import { createSalesOrderFromQuotationAction } from "@/lib/energy/sales-orders/actions";
import { listSalesOrdersForQuotation } from "@/lib/energy/sales-orders/queries";
import { canManageQuotations, canApproveQuotations, canManageSalesOrders } from "@/lib/core/permissions";
import {
  isQuotationDetailTabKey,
  QUOTATION_DETAIL_TABS,
  QUOTATION_STATUS_TRANSITIONS,
  QUOTATION_STATUS_LABELS,
  QUOTATION_TYPE_LABELS,
  SOLAR_TYPES,
  DG_TYPES,
  type QuotationDetailTabKey,
  type QuotationStatus,
  type QuotationType,
} from "@/lib/energy/quotations/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuotationStatusBadge } from "./status-badge";
import { QuotationTabs } from "./quotation-tabs";

const TAB_LABELS = Object.fromEntries(QUOTATION_DETAIL_TABS.map((t) => [t.key, t.label]));
const IMPLEMENTED_TABS: readonly QuotationDetailTabKey[] = [
  "overview",
  "items",
  "technical",
  "pricing",
  "terms",
  "revisions",
  "activity",
];

function isPastValidity(validUntil: Date | null): boolean {
  return validUntil ? validUntil.getTime() < Date.now() : false;
}

export async function QuotationDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const quotation = await getQuotationById({ companyId: session.companyId, id });
  if (!quotation) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: QuotationDetailTabKey = isQuotationDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageQuotations(session.role);
  const canApprove = canApproveQuotations(session.role);
  const canCreateSalesOrder = canManageSalesOrders(session.role);
  const showsAsExpired = isPastValidity(quotation.validUntil) && ["SENT", "NEGOTIATION"].includes(quotation.status);

  const allowedTransitions = QUOTATION_STATUS_TRANSITIONS[quotation.status as QuotationStatus] ?? [];

  return (
    <div>
      <PageHeader
        title={quotation.quotationNumber}
        description={`${quotation.client.name} · ${QUOTATION_TYPE_LABELS[quotation.type as QuotationType] ?? quotation.type}${
          quotation.revisionNumber > 0 ? ` · Rev ${quotation.revisionNumber}` : ""
        }`}
        actions={
          <>
            <QuotationStatusBadge status={quotation.status} />
            {showsAsExpired ? <Badge variant="danger">Past validity</Badge> : null}
            <span className="text-sm font-semibold text-slate-900">
              ₹{quotation.grandTotal.toLocaleString("en-IN")}
            </span>
          </>
        }
      />

      {canManage ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {quotation.status === "DRAFT" ? (
            <Link href={`/sales/quotations/${id}/edit`}>
              <Button size="sm">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </Link>
          ) : null}
          <form action={duplicateQuotationAction.bind(null, id)}>
            <Button type="submit" variant="secondary" size="sm">
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
          </form>
          <form action={createRevisionAction.bind(null, id)}>
            <Button type="submit" variant="secondary" size="sm">
              <GitBranch className="h-4 w-4" />
              Create Revision
            </Button>
          </form>
          <Link href={`/sales/quotations/${id}/print`} target="_blank">
            <Button variant="secondary" size="sm">
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
          </Link>
          {canCreateSalesOrder && quotation.status === "APPROVED" ? (
            <form action={createSalesOrderFromQuotationAction.bind(null, id)}>
              <Button type="submit" variant="secondary" size="sm">
                <ShoppingCart className="h-4 w-4" />
                Create Sales Order
              </Button>
            </form>
          ) : null}
          {allowedTransitions
            .filter((next) => next !== "APPROVED" || canApprove)
            .map((next) => (
              <form key={next} action={setQuotationStatusAction.bind(null, id, next)}>
                <Button
                  type="submit"
                  variant={next === "CANCELLED" || next === "REJECTED" ? "danger" : "secondary"}
                  size="sm"
                >
                  Mark as {QUOTATION_STATUS_LABELS[next]}
                </Button>
              </form>
            ))}
        </div>
      ) : (
        <div className="mb-6">
          <Link href={`/sales/quotations/${id}/print`} target="_blank">
            <Button variant="secondary" size="sm">
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
          </Link>
        </div>
      )}

      <QuotationTabs basePath={`/sales/quotations/${id}`} active={tab} />

      {tab === "overview" ? <OverviewTab quotation={quotation} /> : null}
      {tab === "overview" ? <LinkedSalesOrdersCard companyId={session.companyId} quotationId={id} /> : null}
      {tab === "items" ? <ItemsTab quotation={quotation} /> : null}
      {tab === "technical" ? <TechnicalTab quotation={quotation} /> : null}
      {tab === "pricing" ? <PricingTab quotation={quotation} /> : null}
      {tab === "terms" ? <TermsTab quotation={quotation} /> : null}
      {tab === "revisions" ? <RevisionsTab companyId={session.companyId} quotation={quotation} currentId={id} /> : null}
      {tab === "activity" ? <ActivityTab companyId={session.companyId} quotationId={id} /> : null}

      {!IMPLEMENTED_TABS.includes(tab) ? (
        <EmptyState title="Not built yet" description={`${TAB_LABELS[tab]} will show up here once implemented.`} />
      ) : null}
    </div>
  );
}

type QuotationWithRelations = NonNullable<Awaited<ReturnType<typeof getQuotationById>>>;

function OverviewTab({ quotation }: { quotation: QuotationWithRelations }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <OverviewField label="Client" value={quotation.client.name} />
          <OverviewField label="Client Mobile" value={quotation.client.mobile} />
          <OverviewField label="Client GSTIN" value={quotation.client.gstin} />
          <OverviewField label="Site" value={quotation.siteAddressText} />
          <OverviewField label="Quotation Date" value={quotation.quotationDate.toLocaleDateString()} />
          <OverviewField label="Valid Until" value={quotation.validUntil?.toLocaleDateString()} />
          <OverviewField label="Reference" value={quotation.reference} />
          {quotation.subject ? (
            <div className="sm:col-span-2">
              <OverviewField label="Subject" value={quotation.subject} />
            </div>
          ) : null}
          {quotation.notes ? (
            <div className="sm:col-span-2">
              <OverviewField label="Notes" value={quotation.notes} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

async function LinkedSalesOrdersCard({ companyId, quotationId }: { companyId: string; quotationId: string }) {
  const salesOrders = await listSalesOrdersForQuotation({ companyId, quotationId });
  if (salesOrders.length === 0) return null;
  return (
    <Card className="mt-4">
      <CardContent className="py-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Sales Orders from this Quotation</p>
        <ul className="divide-y divide-slate-100">
          {salesOrders.map((so) => (
            <li key={so.id} className="flex items-center justify-between py-2 text-sm">
              <Link href={`/sales/sales-orders/${so.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                {so.soNumber}
              </Link>
              <span className="text-slate-500">₹{so.grandTotal.toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ItemsTab({ quotation }: { quotation: QuotationWithRelations }) {
  if (quotation.items.length === 0) {
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
          {quotation.items.map((item) => (
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

function TechnicalTab({ quotation }: { quotation: QuotationWithRelations }) {
  const type = quotation.type as QuotationType;
  const isTechnical = SOLAR_TYPES.includes(type) || DG_TYPES.includes(type);
  if (!isTechnical) {
    return <EmptyState title="No technical configuration" description="This quotation type has no technical section." />;
  }
  let config: Record<string, string> = {};
  try {
    config = quotation.technicalConfigJson ? JSON.parse(quotation.technicalConfigJson) : {};
  } catch {
    config = {};
  }
  const entries = Object.entries(config).filter(([, v]) => v);
  if (entries.length === 0) {
    return <EmptyState title="No technical details entered" />;
  }
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <OverviewField key={key} label={labelize(key)} value={value} />
        ))}
      </CardContent>
    </Card>
  );
}

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function PricingTab({ quotation }: { quotation: QuotationWithRelations }) {
  const itemDiscountTotal = quotation.items.reduce((sum, item) => sum + item.discountAmount, 0);
  return (
    <Card className="max-w-md">
      <CardContent className="space-y-2 py-4 text-sm">
        <Row label="Subtotal" value={quotation.subtotal} />
        <Row label="Item Discounts" value={-itemDiscountTotal} />
        <Row label="Taxable Amount" value={quotation.taxableAmount} />
        <Row label="GST / Tax" value={quotation.taxAmount} />
        {quotation.discountPercent ? (
          <Row label={`Overall Discount (${quotation.discountPercent}%)`} value={-quotation.discountAmount} />
        ) : null}
        <Row label="Other Charges" value={quotation.otherCharges} />
        <div className="border-t border-slate-200 pt-2">
          <Row label="Grand Total" value={quotation.grandTotal} bold />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={cnRow(bold)}>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</span>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-700"}>
        ₹{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function cnRow(bold?: boolean) {
  return `flex items-center justify-between ${bold ? "text-base" : ""}`;
}

function TermsTab({ quotation }: { quotation: QuotationWithRelations }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 py-4">
          <OverviewField label="Payment Terms" value={quotation.paymentTerms} />
          <OverviewField label="Equipment Warranty" value={quotation.equipmentWarranty} />
          <OverviewField label="Installation Warranty" value={quotation.installationWarranty} />
          <OverviewField label="Delivery Timeline" value={quotation.deliveryTimeline} />
          <OverviewField label="Installation Timeline" value={quotation.installationTimeline} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Terms & Conditions</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {quotation.termsAndConditions || <span className="text-slate-400">-</span>}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

async function RevisionsTab({
  companyId,
  quotation,
  currentId,
}: {
  companyId: string;
  quotation: QuotationWithRelations;
  currentId: string;
}) {
  const revisions = await getQuotationRevisions({ companyId, quotation });
  if (revisions.length <= 1) {
    return <EmptyState title="No revisions yet" description="Create a revision from the actions above if the client requests changes." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Revision</th>
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {revisions.map((rev) => (
            <tr key={rev.id} className={rev.id === currentId ? "bg-emerald-50/50" : undefined}>
              <td className="px-4 py-2.5">
                <Link href={`/sales/quotations/${rev.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                  Rev {rev.revisionNumber} {rev.isLatestRevision ? <Badge variant="success">Latest</Badge> : null}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{rev.quotationDate.toLocaleDateString()}</td>
              <td className="px-4 py-2.5">
                <QuotationStatusBadge status={rev.status} />
              </td>
              <td className="px-4 py-2.5 text-right text-slate-700">₹{rev.grandTotal.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function ActivityTab({ companyId, quotationId }: { companyId: string; quotationId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "Quotation", entityId: quotationId },
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
