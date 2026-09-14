import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getAmcById } from "@/lib/energy/amc/queries";
import { canManageAmcs, canManageMaintenanceVisits, canManageServiceRequests } from "@/lib/core/permissions";
import { computeAmcStatus, BILLING_FREQUENCY_LABELS, type BillingFrequency } from "@/lib/energy/amc/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AmcStatusBadge } from "./status-badge";
import { AmcStatusButton, LinkInvoiceForm } from "./amc-controls";
import { VisitStatusBadge } from "@/components/maintenance-visits/status-badge";
import { ServiceRequestStatusBadge } from "@/components/service-requests/status-badge";

export async function AmcDetailView({ id }: { id: string }) {
  const session = await requireSession();
  const amc = await getAmcById({ companyId: session.companyId, id });
  if (!amc) notFound();

  const canManage = canManageAmcs(session.role);
  const canSchedule = canManageMaintenanceVisits(session.role);
  const canService = canManageServiceRequests(session.role);
  const status = computeAmcStatus(amc);

  const unlinkedInvoices = canManage
    ? await prisma.invoice.findMany({
        where: { companyId: session.companyId, clientId: amc.customerId, amcId: null, status: { not: "CANCELLED" } },
        orderBy: { invoiceDate: "desc" },
        take: 20,
      })
    : [];

  return (
    <div>
      <PageHeader
        title={amc.amcNumber}
        description={amc.customer.name}
        actions={
          <>
            <AmcStatusBadge amc={amc} />
            {canManage && status !== "CANCELLED" && status !== "COMPLETED" ? (
              <>
                <Link href={`/service/amc/${id}/edit`}>
                  <Button size="sm"><Pencil className="h-4 w-4" />Edit</Button>
                </Link>
                {amc.status === "DRAFT" ? <AmcStatusButton id={id} target="ACTIVE" label="Activate" /> : null}
                {amc.status === "ACTIVE" ? <AmcStatusButton id={id} target="COMPLETED" label="Mark Completed" /> : null}
                <AmcStatusButton id={id} target="CANCELLED" label="Cancel" danger />
              </>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <Field label="Customer" value={<Link href={`/parties/clients/${amc.customerId}`} className="text-emerald-700 hover:underline">{amc.customer.name}</Link>} />
            <Field label="Site" value={amc.site?.name} />
            <Field label="Project" value={amc.project ? <Link href={`/projects/${amc.project.id}`} className="text-emerald-700 hover:underline">{amc.project.projectNumber}</Link> : undefined} />
            <Field label="Contract Value" value={amc.contractValue ? `₹${amc.contractValue.toLocaleString("en-IN")}` : undefined} />
            <Field label="Billing Frequency" value={amc.billingFrequency ? BILLING_FREQUENCY_LABELS[amc.billingFrequency as BillingFrequency] : undefined} />
            <Field label="Start Date" value={amc.startDate.toLocaleDateString()} />
            <Field label="End Date" value={amc.endDate.toLocaleDateString()} />
            <Field label="Visits" value={`${amc.visitsUsed} used / ${amc.numberOfVisits} included (${amc.visitsRemaining} remaining)`} />
            <div className="sm:col-span-2">
              <Field label="Coverage" value={amc.coverage} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Exclusions" value={amc.exclusions} />
            </div>
            {amc.notes ? (
              <div className="sm:col-span-2">
                <Field label="Notes" value={amc.notes} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {canSchedule ? (
            <Link href={`/service/maintenance/new?customerId=${amc.customerId}&siteId=${amc.siteId ?? ""}&projectId=${amc.projectId ?? ""}&amcId=${amc.id}`}>
              <Button size="sm" className="w-full"><Plus className="h-4 w-4" />Schedule Maintenance</Button>
            </Link>
          ) : null}
          {canService ? (
            <Link href={`/service/service-requests/new?customerId=${amc.customerId}&siteId=${amc.siteId ?? ""}&projectId=${amc.projectId ?? ""}`}>
              <Button size="sm" variant="secondary" className="w-full"><Plus className="h-4 w-4" />Create Service Request</Button>
            </Link>
          ) : null}
          {canManage ? (
            <Card>
              <CardContent className="space-y-2 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Link Invoice for Billing</p>
                <LinkInvoiceForm amcId={id} invoices={unlinkedInvoices} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {amc.invoices.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Linked Invoices</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[500px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {amc.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/sales/invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{inv.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">₹{inv.grandTotal.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 text-slate-600">₹{inv.outstandingAmount.toLocaleString("en-IN")} outstanding</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Maintenance Visits</p>
          {amc.maintenanceVisits.length === 0 ? (
            <EmptyState title="No visits yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[400px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {amc.maintenanceVisits.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/service/maintenance/${v.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{v.visitNumber}</Link>
                        <p className="text-xs text-slate-500">{v.visitDate.toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-2.5"><VisitStatusBadge status={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Service Requests</p>
          {amc.serviceRequests.length === 0 ? (
            <EmptyState title="No service requests yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[400px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {amc.serviceRequests.map((sr) => (
                    <tr key={sr.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/service/service-requests/${sr.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{sr.requestNumber}</Link>
                        <p className="text-xs text-slate-500">{sr.requestDate.toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-2.5"><ServiceRequestStatusBadge status={sr.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
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
