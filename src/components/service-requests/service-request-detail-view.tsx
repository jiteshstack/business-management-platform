import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getServiceRequestById } from "@/lib/energy/service-requests/queries";
import { canManageServiceRequests, canAssignServiceRequests, canManageMaintenanceVisits } from "@/lib/core/permissions";
import {
  isServiceRequestDetailTabKey,
  SERVICE_REQUEST_DETAIL_TABS,
  SERVICE_REQUEST_STATUS_TRANSITIONS,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_SOURCE_LABELS,
  type ServiceRequestDetailTabKey,
  type ServiceRequestStatus,
  type ServiceRequestSource,
} from "@/lib/energy/service-requests/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ServiceRequestStatusBadge, ServiceRequestPriorityBadge } from "./status-badge";
import { AssignServiceRequestForm, ServiceRequestStatusButton, ResolveServiceRequestForm, CreateServiceInvoiceForm } from "./service-request-controls";
import { WarrantyStatusBadge } from "@/components/warranties/status-badge";
import { AmcStatusBadge } from "@/components/amc/status-badge";
import { VisitStatusBadge } from "@/components/maintenance-visits/status-badge";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";

export async function ServiceRequestDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const request = await getServiceRequestById({ companyId: session.companyId, id });
  if (!request) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: ServiceRequestDetailTabKey = isServiceRequestDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageServiceRequests(session.role);
  const canAssign = canAssignServiceRequests(session.role);
  const canVisit = canManageMaintenanceVisits(session.role);
  const allowedTransitions = SERVICE_REQUEST_STATUS_TRANSITIONS[request.status as ServiceRequestStatus] ?? [];

  const users = canAssign
    ? await prisma.user.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  return (
    <div>
      <PageHeader
        title={request.requestNumber}
        description={`${request.customer.name}${request.site ? ` · ${request.site.name}` : ""}`}
        actions={
          <>
            <ServiceRequestStatusBadge status={request.status} />
            <ServiceRequestPriorityBadge priority={request.priority} />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {canVisit && !["CLOSED", "CANCELLED", "RESOLVED"].includes(request.status) ? (
          <Link href={`/service/maintenance/new?customerId=${request.customerId}&siteId=${request.siteId ?? ""}&projectId=${request.projectId ?? ""}&installedEquipmentId=${request.installedEquipmentId ?? ""}&serviceRequestId=${request.id}`}>
            <Button size="sm" variant="secondary"><Plus className="h-4 w-4" />Schedule Visit</Button>
          </Link>
        ) : null}
        {canManage
          ? allowedTransitions
              .filter((s) => s !== "RESOLVED")
              .map((s) => <ServiceRequestStatusButton key={s} id={id} target={s} label={`Mark ${SERVICE_REQUEST_STATUS_LABELS[s]}`} />)
          : null}
      </div>

      <div className="mb-6 overflow-x-auto border-b border-slate-200">
        <nav className="flex min-w-max gap-1">
          {SERVICE_REQUEST_DETAIL_TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? `/service/service-requests/${id}` : `/service/service-requests/${id}?tab=${t.key}`}
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
                <Field label="Customer" value={<Link href={`/parties/clients/${request.customerId}`} className="text-emerald-700 hover:underline">{request.customer.name}</Link>} />
                <Field label="Site" value={request.site?.name} />
                <Field label="Project" value={request.project ? <Link href={`/projects/${request.project.id}`} className="text-emerald-700 hover:underline">{request.project.projectNumber}</Link> : undefined} />
                <Field
                  label="Installed Equipment"
                  value={request.installedEquipment ? <Link href={`/warranty/equipment/${request.installedEquipment.id}`} className="text-emerald-700 hover:underline">{request.installedEquipment.equipmentNumber} - {request.installedEquipment.productName}</Link> : undefined}
                />
                <Field label="Serial Number" value={request.installedEquipment?.serialNumberText} />
                <Field label="Source" value={SERVICE_REQUEST_SOURCE_LABELS[request.source as ServiceRequestSource] ?? request.source} />
                <Field label="Request Date" value={request.requestDate.toLocaleDateString()} />
                <Field label="Expected Visit Date" value={request.expectedVisitDate?.toLocaleDateString()} />
                <div className="sm:col-span-2">
                  <Field label="Issue" value={request.issue} />
                </div>
                {request.description ? (
                  <div className="sm:col-span-2">
                    <Field label="Description" value={request.description} />
                  </div>
                ) : null}
                {request.resolution ? (
                  <div className="sm:col-span-2">
                    <Field label="Resolution" value={request.resolution} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-2 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage at time of request</p>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Warranty</span>
                    <span>{request.warrantyStatusAtRequest ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">AMC</span>
                    <span>{request.amcStatusAtRequest ?? "-"}</span>
                  </div>
                  {request.warranty ? <WarrantyStatusBadge warranty={request.warranty} /> : null}
                  {request.amc ? <AmcStatusBadge amc={request.amc} /> : null}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-2 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assignment</p>
                  {canAssign ? (
                    <AssignServiceRequestForm id={id} users={users} currentAssignedToId={request.assignedToId} />
                  ) : (
                    <p className="text-sm text-slate-700">{request.assignedTo?.name ?? "Unassigned"}</p>
                  )}
                </CardContent>
              </Card>
              {canManage && allowedTransitions.includes("RESOLVED") ? (
                <Card>
                  <CardContent className="py-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Resolve</p>
                    <ResolveServiceRequestForm id={id} />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "visits" ? (
        request.maintenanceVisits.length === 0 ? (
          <EmptyState title="No maintenance visits yet" description="Schedule a visit to service this request." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Visit</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Technician</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {request.maintenanceVisits.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/service/maintenance/${v.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{v.visitNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{v.visitDate.toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.technician?.name ?? "-"}</td>
                    <td className="px-4 py-2.5"><VisitStatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "financial" ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4 text-sm text-slate-600">
              <p><span className="font-medium text-slate-900">Service Type:</span> {request.serviceType}</p>
              <p className="mt-1 text-xs text-slate-400">Warranty and AMC service is not chargeable by default; only chargeable requests create an invoice.</p>
            </CardContent>
          </Card>
          {request.invoice ? (
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <Link href={`/sales/invoices/${request.invoice.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{request.invoice.invoiceNumber}</Link>
                  <p className="text-sm text-slate-600">₹{request.invoice.grandTotal.toLocaleString("en-IN")} · ₹{request.invoice.outstandingAmount.toLocaleString("en-IN")} outstanding</p>
                </div>
                <InvoiceStatusBadge status={request.invoice.status} />
              </CardContent>
            </Card>
          ) : request.serviceType === "CHARGEABLE" && canManage ? (
            <Card>
              <CardContent className="py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Create Invoice</p>
                <CreateServiceInvoiceForm id={id} />
              </CardContent>
            </Card>
          ) : (
            <EmptyState title="No invoice" description="This request has not been invoiced." />
          )}
        </div>
      ) : null}

      {tab === "activity" ? <ActivityTab companyId={session.companyId} requestId={id} /> : null}
    </div>
  );
}

async function ActivityTab({ companyId, requestId }: { companyId: string; requestId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "ServiceRequest", entityId: requestId },
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
