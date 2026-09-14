import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { getPartyById, getPartyDocuments } from "@/lib/core/parties/queries";
import {
  isPartyDetailTabKey,
  IMPLEMENTED_TABS,
  PARTY_DETAIL_TABS,
  type PartyDetailTabKey,
  type PartyType,
} from "@/lib/core/parties/types";
import {
  addAddressAction,
  addContactAction,
  addNoteAction,
  deleteAddressAction,
  deleteContactAction,
  deleteDocumentAction,
  setPartyActiveAction,
  uploadDocumentAction,
} from "@/lib/core/parties/actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listQuotationsForParty } from "@/lib/energy/quotations/queries";
import { QUOTATION_TYPE_LABELS, type QuotationType } from "@/lib/energy/quotations/types";
import { QuotationStatusBadge } from "@/components/quotations/status-badge";
import { listSalesOrdersForParty } from "@/lib/energy/sales-orders/queries";
import { SalesOrderStatusBadge } from "@/components/sales-orders/status-badge";
import { listInvoicesForParty } from "@/lib/energy/invoices/queries";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { listPaymentsForParty, listReceivables, getClientFinancialSummary } from "@/lib/energy/payments/queries";
import { PaymentStatusBadge } from "@/components/payments/status-badge";
import { CustomerLedgerView } from "@/components/payments/customer-ledger-view";
import { listPurchaseOrdersForParty } from "@/lib/energy/purchase-orders/queries";
import { PurchaseOrderStatusBadge } from "@/components/purchase-orders/status-badge";
import { listVendorInvoicesForParty } from "@/lib/energy/vendor-invoices/queries";
import { VendorInvoiceStatusBadge } from "@/components/vendor-invoices/status-badge";
import {
  listVendorPaymentsForParty,
  listPayables,
  getVendorFinancialSummary,
} from "@/lib/energy/vendor-payments/queries";
import { VendorPaymentStatusBadge } from "@/components/vendor-payments/status-badge";
import { VendorLedgerView } from "@/components/vendor-payments/vendor-ledger-view";
import { listProjectsForParty } from "@/lib/energy/projects/queries";
import { ProjectStatusBadge } from "@/components/projects/status-badge";
import { listSitesForParty } from "@/lib/energy/project-sites/queries";
import { listInstalledEquipmentForParty } from "@/lib/energy/installed-equipment/queries";
import { EquipmentStatusBadge } from "@/components/installed-equipment/status-badge";
import { listWarrantiesForParty } from "@/lib/energy/warranties/queries";
import { WarrantyStatusBadge } from "@/components/warranties/status-badge";
import { listAmcsForParty } from "@/lib/energy/amc/queries";
import { AmcStatusBadge } from "@/components/amc/status-badge";
import { listServiceRequestsForParty } from "@/lib/energy/service-requests/queries";
import { ServiceRequestStatusBadge } from "@/components/service-requests/status-badge";
import { PartyStatusBadge } from "./status-badge";
import { PartyTabs } from "./party-tabs";
import { ContactsSection } from "./contacts-section";
import { AddressesSection } from "./addresses-section";
import { NotesSection } from "./notes-section";
import { DocumentsSection } from "./documents-section";

const TAB_LABELS = Object.fromEntries(PARTY_DETAIL_TABS.map((t) => [t.key, t.label]));

export async function PartyDetailView({
  type,
  id,
  searchParams,
}: {
  type: PartyType;
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const party = await getPartyById({ companyId: session.companyId, type, id });
  if (!party) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: PartyDetailTabKey = isPartyDetailTabKey(rawTab) ? rawTab : "overview";

  const basePath = type === "CLIENT" ? "/parties/clients" : "/parties/vendors";

  const documents = tab === "documents" ? await getPartyDocuments({ companyId: session.companyId, partyId: id }) : [];
  const quotations =
    tab === "quotations" && type === "CLIENT"
      ? await listQuotationsForParty({ companyId: session.companyId, clientId: id })
      : [];
  const salesOrders =
    tab === "sales-orders" && type === "CLIENT"
      ? await listSalesOrdersForParty({ companyId: session.companyId, clientId: id })
      : [];
  const invoices =
    tab === "invoices" && type === "CLIENT"
      ? await listInvoicesForParty({ companyId: session.companyId, clientId: id })
      : [];
  const payments =
    tab === "payments" && type === "CLIENT"
      ? await listPaymentsForParty({ companyId: session.companyId, clientId: id })
      : [];
  const outstandingInvoices =
    tab === "outstanding" && type === "CLIENT"
      ? (await listReceivables({ companyId: session.companyId, clientId: id })).items
      : [];
  const financialSummary =
    (tab === "overview" || tab === "outstanding") && type === "CLIENT"
      ? await getClientFinancialSummary(session.companyId, id)
      : null;

  const purchaseOrders =
    tab === "purchase-orders" && type === "VENDOR"
      ? await listPurchaseOrdersForParty({ companyId: session.companyId, vendorId: id })
      : [];
  const vendorInvoices =
    tab === "invoices" && type === "VENDOR"
      ? await listVendorInvoicesForParty({ companyId: session.companyId, vendorId: id })
      : [];
  const vendorPayments =
    tab === "payments" && type === "VENDOR"
      ? await listVendorPaymentsForParty({ companyId: session.companyId, vendorId: id })
      : [];
  const payableInvoices =
    tab === "outstanding" && type === "VENDOR"
      ? (await listPayables({ companyId: session.companyId, vendorId: id })).items
      : [];
  const vendorFinancialSummary =
    (tab === "overview" || tab === "outstanding") && type === "VENDOR"
      ? await getVendorFinancialSummary(session.companyId, id)
      : null;

  const clientProjects =
    tab === "projects" && type === "CLIENT"
      ? await listProjectsForParty({ companyId: session.companyId, customerId: id })
      : [];
  const clientSites =
    tab === "sites" && type === "CLIENT"
      ? await listSitesForParty({ companyId: session.companyId, customerId: id })
      : [];
  const installedEquipment =
    tab === "equipment" && type === "CLIENT"
      ? await listInstalledEquipmentForParty({ companyId: session.companyId, customerId: id })
      : [];
  const warranties =
    tab === "warranty-amc" && type === "CLIENT"
      ? await listWarrantiesForParty({ companyId: session.companyId, customerId: id })
      : [];
  const amcs =
    tab === "warranty-amc" && type === "CLIENT"
      ? await listAmcsForParty({ companyId: session.companyId, customerId: id })
      : [];
  const serviceRequests =
    tab === "service" && type === "CLIENT"
      ? await listServiceRequestsForParty({ companyId: session.companyId, customerId: id })
      : [];

  return (
    <div>
      <PageHeader
        title={party.name}
        description={[party.businessName, party.city, party.state].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <PartyStatusBadge isActive={party.isActive} />
            <form action={setPartyActiveAction.bind(null, type, id, !party.isActive)}>
              <Button type="submit" variant="secondary" size="sm">
                {party.isActive ? "Deactivate" : "Activate"}
              </Button>
            </form>
            <Link href={`${basePath}/${id}/edit`}>
              <Button size="sm">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <PartyTabs basePath={`${basePath}/${id}`} active={tab} />

      {tab === "overview" ? (
        <OverviewTab party={party} financialSummary={financialSummary} vendorSummary={vendorFinancialSummary} />
      ) : null}

      {tab === "contacts" ? (
        <ContactsSection
          contacts={party.contacts}
          addAction={addContactAction.bind(null, type, id)}
          deleteAction={deleteContactAction.bind(null, type, id)}
        />
      ) : null}

      {tab === "addresses" ? (
        <AddressesSection
          addresses={party.addresses}
          addAction={addAddressAction.bind(null, type, id)}
          deleteAction={deleteAddressAction.bind(null, type, id)}
        />
      ) : null}

      {tab === "notes" ? (
        <NotesSection notes={party.notes} addAction={addNoteAction.bind(null, type, id)} />
      ) : null}

      {tab === "documents" ? (
        <DocumentsSection
          documents={documents}
          uploadAction={uploadDocumentAction.bind(null, type, id)}
          deleteAction={deleteDocumentAction.bind(null, type, id)}
        />
      ) : null}

      {tab === "quotations" && type === "CLIENT" ? (
        quotations.length === 0 ? (
          <EmptyState title="No quotations yet" description="Quotations created for this client will show up here." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Number</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/sales/quotations/${q.id}`}
                        className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {q.quotationNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{q.quotationDate.toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {QUOTATION_TYPE_LABELS[q.type as QuotationType] ?? q.type}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">₹{q.grandTotal.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5">
                      <QuotationStatusBadge status={q.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "sales-orders" && type === "CLIENT" ? (
        salesOrders.length === 0 ? (
          <EmptyState title="No sales orders yet" description="Sales orders created for this client will show up here." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Number</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesOrders.map((so) => (
                  <tr key={so.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/sales/sales-orders/${so.id}`}
                        className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {so.soNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{so.orderDate.toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-slate-700">₹{so.grandTotal.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5">
                      <SalesOrderStatusBadge status={so.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "invoices" && type === "CLIENT" ? (
        invoices.length === 0 ? (
          <EmptyState title="No invoices yet" description="Invoices created for this client will show up here." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Number</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Outstanding</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/sales/invoices/${inv.id}`}
                        className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{inv.invoiceDate.toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-slate-700">₹{inv.grandTotal.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 text-slate-700">₹{inv.outstandingAmount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "payments" && type === "CLIENT" ? (
        <PaymentsTab payments={payments} />
      ) : null}

      {tab === "outstanding" && type === "CLIENT" ? (
        <OutstandingTab invoices={outstandingInvoices} summary={financialSummary} />
      ) : null}

      {tab === "ledger" && type === "CLIENT" ? (
        <CustomerLedgerView companyId={session.companyId} clientId={id} />
      ) : null}

      {tab === "purchase-orders" && type === "VENDOR" ? <VendorPurchaseOrdersTab purchaseOrders={purchaseOrders} /> : null}

      {tab === "invoices" && type === "VENDOR" ? <VendorInvoicesTab invoices={vendorInvoices} /> : null}

      {tab === "payments" && type === "VENDOR" ? <VendorPaymentsTab payments={vendorPayments} /> : null}

      {tab === "outstanding" && type === "VENDOR" ? (
        <VendorOutstandingTab invoices={payableInvoices} summary={vendorFinancialSummary} />
      ) : null}

      {tab === "ledger" && type === "VENDOR" ? (
        <VendorLedgerView companyId={session.companyId} vendorId={id} />
      ) : null}

      {tab === "projects" && type === "CLIENT" ? <ClientProjectsTab projects={clientProjects} /> : null}

      {tab === "sites" && type === "CLIENT" ? <ClientSitesTab sites={clientSites} customerId={id} /> : null}

      {tab === "equipment" && type === "CLIENT" ? <ClientEquipmentTab items={installedEquipment} /> : null}

      {tab === "warranty-amc" && type === "CLIENT" ? <ClientWarrantyAmcTab warranties={warranties} amcs={amcs} /> : null}

      {tab === "service" && type === "CLIENT" ? <ClientServiceTab requests={serviceRequests} /> : null}

      {!IMPLEMENTED_TABS.includes(tab) &&
      !(tab === "quotations" && type === "CLIENT") &&
      !(tab === "sales-orders" && type === "CLIENT") &&
      !(tab === "invoices" && type === "CLIENT") &&
      !(tab === "payments" && type === "CLIENT") &&
      !(tab === "outstanding" && type === "CLIENT") &&
      !(tab === "ledger" && type === "CLIENT") &&
      !(tab === "purchase-orders" && type === "VENDOR") &&
      !(tab === "invoices" && type === "VENDOR") &&
      !(tab === "payments" && type === "VENDOR") &&
      !(tab === "outstanding" && type === "VENDOR") &&
      !(tab === "ledger" && type === "VENDOR") &&
      !(tab === "projects" && type === "CLIENT") &&
      !(tab === "sites" && type === "CLIENT") &&
      !(tab === "equipment" && type === "CLIENT") &&
      !(tab === "warranty-amc" && type === "CLIENT") &&
      !(tab === "service" && type === "CLIENT") ? (
        <EmptyState
          title="Not built yet"
          description={`${TAB_LABELS[tab]} will show up here once that module is implemented.`}
        />
      ) : null}
    </div>
  );
}

type FinancialSummary = Awaited<ReturnType<typeof getClientFinancialSummary>>;
type VendorFinancialSummary = Awaited<ReturnType<typeof getVendorFinancialSummary>>;

function OverviewTab({
  party,
  financialSummary,
  vendorSummary,
}: {
  party: NonNullable<Awaited<ReturnType<typeof getPartyById>>>;
  financialSummary: FinancialSummary | null;
  vendorSummary: VendorFinancialSummary | null;
}) {
  const primaryContact = party.contacts.find((c) => c.isPrimary) ?? party.contacts[0];
  const defaultAddress = party.addresses.find((a) => a.isDefault) ?? party.addresses[0];

  return (
    <div className="space-y-4">
      {financialSummary ? (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
            <FinancialStat label="Total Invoiced" value={financialSummary.totalInvoiced} />
            <FinancialStat label="Total Paid" value={financialSummary.totalPaid} />
            <FinancialStat label="Total Outstanding" value={financialSummary.totalOutstanding} />
            <FinancialStat label="Overdue" value={financialSummary.overdue} highlight={financialSummary.overdue > 0} />
          </CardContent>
        </Card>
      ) : null}

      {vendorSummary ? (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-3 lg:grid-cols-6">
            <FinancialStat label="Total Purchases" value={vendorSummary.totalPurchases} />
            <FinancialStat label="Total Invoiced" value={vendorSummary.totalInvoiced} />
            <FinancialStat label="Total Paid" value={vendorSummary.totalPaid} />
            <FinancialStat label="Total Outstanding" value={vendorSummary.totalOutstanding} />
            <FinancialStat label="Overdue" value={vendorSummary.overdue} highlight={vendorSummary.overdue > 0} />
            <FinancialStat label="Advance Balance" value={vendorSummary.advanceBalance} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <OverviewField label="Business / Company Name" value={party.businessName} />
          <OverviewField label="Category" value={party.category} />
          <OverviewField label="Mobile" value={party.mobile} />
          <OverviewField label="Email" value={party.email} />
          <OverviewField label="GSTIN" value={party.gstin} />
          <OverviewField label="PAN" value={party.pan} />
          <OverviewField label="City" value={party.city} />
          <OverviewField label="State" value={party.state} />
          <OverviewField label="Payment Terms" value={party.paymentTerms} />
          <OverviewField label="Added on" value={party.createdAt.toLocaleDateString()} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Primary contact
            </p>
            {primaryContact ? (
              <div className="text-sm">
                <p className="font-medium text-slate-900">{primaryContact.name}</p>
                <p className="text-slate-500">
                  {[primaryContact.designation, primaryContact.phone, primaryContact.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No contact added yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Default address
            </p>
            {defaultAddress ? (
              <p className="text-sm text-slate-600">
                {[defaultAddress.line1, defaultAddress.line2, defaultAddress.city, defaultAddress.state, defaultAddress.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : (
              <p className="text-sm text-slate-400">No address added yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

function FinancialStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${highlight ? "text-red-600" : "text-slate-900"}`}>
        ₹{value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function PaymentsTab({ payments }: { payments: Awaited<ReturnType<typeof listPaymentsForParty>> }) {
  const advanceBalance = payments
    .filter((p) => p.status !== "CANCELLED")
    .reduce((sum, p) => sum + p.unallocatedAmount, 0);

  if (payments.length === 0) {
    return <EmptyState title="No payments yet" description="Payments received from this client will show up here." />;
  }

  return (
    <div className="space-y-4">
      {advanceBalance > 0 ? (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-slate-600">Available advance / unallocated balance</p>
            <p className="text-lg font-semibold text-emerald-700">₹{advanceBalance.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Number</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Unallocated</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/sales/payments-received/${p.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                    {p.paymentNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{p.paymentDate.toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-slate-700">₹{p.amount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-slate-700">₹{p.unallocatedAmount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5">
                  <PaymentStatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutstandingTab({
  invoices,
  summary,
}: {
  invoices: Awaited<ReturnType<typeof listReceivables>>["items"];
  summary: FinancialSummary | null;
}) {
  if (invoices.length === 0) {
    return <EmptyState title="No outstanding invoices" description="This client has no open balance right now." />;
  }
  return (
    <div className="space-y-4">
      {summary ? (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
            <FinancialStat label="Total Outstanding" value={summary.totalOutstanding} />
            <FinancialStat label="Overdue" value={summary.overdue} highlight={summary.overdue > 0} />
          </CardContent>
        </Card>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Invoice</th>
              <th className="px-4 py-2.5">Due Date</th>
              <th className="px-4 py-2.5">Total</th>
              <th className="px-4 py-2.5">Paid</th>
              <th className="px-4 py-2.5">Outstanding</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/sales/invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{inv.dueDate ? inv.dueDate.toLocaleDateString() : "-"}</td>
                <td className="px-4 py-2.5 text-slate-700">₹{inv.grandTotal.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-slate-600">₹{inv.paidAmount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">₹{inv.outstandingAmount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorPurchaseOrdersTab({ purchaseOrders }: { purchaseOrders: Awaited<ReturnType<typeof listPurchaseOrdersForParty>> }) {
  if (purchaseOrders.length === 0) {
    return <EmptyState title="No purchase orders yet" description="Purchase orders created for this vendor will show up here." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Number</th>
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Amount</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {purchaseOrders.map((po) => (
            <tr key={po.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <Link href={`/purchase/purchase-orders/${po.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                  {po.poNumber}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{po.poDate.toLocaleDateString()}</td>
              <td className="px-4 py-2.5 text-slate-700">₹{po.grandTotal.toLocaleString("en-IN")}</td>
              <td className="px-4 py-2.5">
                <PurchaseOrderStatusBadge status={po.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VendorInvoicesTab({ invoices }: { invoices: Awaited<ReturnType<typeof listVendorInvoicesForParty>> }) {
  if (invoices.length === 0) {
    return <EmptyState title="No vendor invoices yet" description="Bills recorded for this vendor will show up here." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Number</th>
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Amount</th>
            <th className="px-4 py-2.5">Outstanding</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <Link href={`/purchase/vendor-invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                  {inv.invoiceNumber}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{inv.invoiceDate.toLocaleDateString()}</td>
              <td className="px-4 py-2.5 text-slate-700">₹{inv.grandTotal.toLocaleString("en-IN")}</td>
              <td className="px-4 py-2.5 text-slate-700">₹{inv.outstandingAmount.toLocaleString("en-IN")}</td>
              <td className="px-4 py-2.5">
                <VendorInvoiceStatusBadge status={inv.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VendorPaymentsTab({ payments }: { payments: Awaited<ReturnType<typeof listVendorPaymentsForParty>> }) {
  const advanceBalance = payments
    .filter((p) => p.status !== "CANCELLED")
    .reduce((sum, p) => sum + p.unallocatedAmount, 0);

  if (payments.length === 0) {
    return <EmptyState title="No payments yet" description="Payments made to this vendor will show up here." />;
  }

  return (
    <div className="space-y-4">
      {advanceBalance > 0 ? (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-slate-600">Available advance / unallocated balance</p>
            <p className="text-lg font-semibold text-emerald-700">₹{advanceBalance.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Number</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Unallocated</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/purchase/payments-made/${p.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                    {p.paymentNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{p.paymentDate.toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-slate-700">₹{p.amount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-slate-700">₹{p.unallocatedAmount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5">
                  <VendorPaymentStatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorOutstandingTab({
  invoices,
  summary,
}: {
  invoices: Awaited<ReturnType<typeof listPayables>>["items"];
  summary: VendorFinancialSummary | null;
}) {
  if (invoices.length === 0) {
    return <EmptyState title="No outstanding invoices" description="This vendor has no open balance right now." />;
  }
  return (
    <div className="space-y-4">
      {summary ? (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
            <FinancialStat label="Total Outstanding" value={summary.totalOutstanding} />
            <FinancialStat label="Overdue" value={summary.overdue} highlight={summary.overdue > 0} />
          </CardContent>
        </Card>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Invoice</th>
              <th className="px-4 py-2.5">Due Date</th>
              <th className="px-4 py-2.5">Total</th>
              <th className="px-4 py-2.5">Paid</th>
              <th className="px-4 py-2.5">Outstanding</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/purchase/vendor-invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{inv.dueDate ? inv.dueDate.toLocaleDateString() : "-"}</td>
                <td className="px-4 py-2.5 text-slate-700">₹{inv.grandTotal.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-slate-600">₹{inv.paidAmount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">₹{inv.outstandingAmount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5">
                  <VendorInvoiceStatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientProjectsTab({ projects }: { projects: Awaited<ReturnType<typeof listProjectsForParty>> }) {
  if (projects.length === 0) {
    return <EmptyState title="No projects yet" description="Projects created for this client will show up here." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Number</th>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Site</th>
            <th className="px-4 py-2.5">Start Date</th>
            <th className="px-4 py-2.5">Completion</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {projects.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                  {p.projectNumber}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-slate-700">{p.name}</td>
              <td className="px-4 py-2.5 text-slate-600">{p.site?.name ?? "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">{p.startDate ? p.startDate.toLocaleDateString() : "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">
                {p.actualCompletionDate ? p.actualCompletionDate.toLocaleDateString() : "-"}
              </td>
              <td className="px-4 py-2.5">
                <ProjectStatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientSitesTab({ sites, customerId }: { sites: Awaited<ReturnType<typeof listSitesForParty>>; customerId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href={`/projects/sites/new?customerId=${customerId}`}>
          <Button size="sm">Add Site</Button>
        </Link>
      </div>
      {sites.length === 0 ? (
        <EmptyState title="No sites yet" description="Add this customer's installation locations." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Site</th>
                <th className="px-4 py-2.5">City</th>
                <th className="px-4 py-2.5">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/sites/${s.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{s.city ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.contactPerson ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ClientEquipmentTab({ items }: { items: Awaited<ReturnType<typeof listInstalledEquipmentForParty>> }) {
  if (items.length === 0) {
    return <EmptyState title="No installed equipment yet" description="Equipment installed at this client's projects will show up here." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Equipment</th>
            <th className="px-4 py-2.5">Site</th>
            <th className="px-4 py-2.5">Project</th>
            <th className="px-4 py-2.5">Installed</th>
            <th className="px-4 py-2.5">Qty</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-2.5 font-medium text-slate-900">
                <Link href={`/warranty/equipment/${item.id}`} className="hover:text-emerald-700 hover:underline">
                  {item.equipmentNumber}
                </Link>
                <p className="text-xs font-normal text-slate-500">{item.productName}</p>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{item.site?.name ?? "-"}</td>
              <td className="px-4 py-2.5">
                <Link href={`/projects/${item.project.id}`} className="text-emerald-700 hover:underline">
                  {item.project.projectNumber}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{item.installationDate.toLocaleDateString()}</td>
              <td className="px-4 py-2.5 text-slate-600">{item.quantity}</td>
              <td className="px-4 py-2.5">
                <EquipmentStatusBadge status={item.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientWarrantyAmcTab({
  warranties,
  amcs,
}: {
  warranties: Awaited<ReturnType<typeof listWarrantiesForParty>>;
  amcs: Awaited<ReturnType<typeof listAmcsForParty>>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Warranties</p>
        {warranties.length === 0 ? (
          <EmptyState title="No warranties" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[400px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {warranties.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/warranty/warranties/${w.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{w.warrantyNumber}</Link>
                      <p className="text-xs text-slate-500">{w.installedEquipment?.productName ?? "-"}</p>
                    </td>
                    <td className="px-4 py-2.5"><WarrantyStatusBadge warranty={w} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">AMC Contracts</p>
        {amcs.length === 0 ? (
          <EmptyState title="No AMC contracts" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[400px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {amcs.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/service/amc/${a.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{a.amcNumber}</Link>
                      <p className="text-xs text-slate-500">{a.site?.name ?? "-"}</p>
                    </td>
                    <td className="px-4 py-2.5"><AmcStatusBadge amc={a} /></td>
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

function ClientServiceTab({ requests }: { requests: Awaited<ReturnType<typeof listServiceRequestsForParty>> }) {
  if (requests.length === 0) {
    return <EmptyState title="No service requests yet" description="Service requests logged for this client will show up here." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Request</th>
            <th className="px-4 py-2.5">Issue</th>
            <th className="px-4 py-2.5">Assigned</th>
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {requests.map((sr) => (
            <tr key={sr.id}>
              <td className="px-4 py-2.5">
                <Link href={`/service/service-requests/${sr.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{sr.requestNumber}</Link>
              </td>
              <td className="px-4 py-2.5 text-slate-700">{sr.issue}</td>
              <td className="px-4 py-2.5 text-slate-600">{sr.assignedTo?.name ?? "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">{sr.requestDate.toLocaleDateString()}</td>
              <td className="px-4 py-2.5"><ServiceRequestStatusBadge status={sr.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverviewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</p>
    </div>
  );
}
