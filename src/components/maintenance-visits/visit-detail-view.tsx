import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getMaintenanceVisitById } from "@/lib/energy/maintenance-visits/queries";
import { canManageMaintenanceVisits, canCompleteMaintenanceVisits } from "@/lib/core/permissions";
import {
  isMaintenanceVisitDetailTabKey,
  MAINTENANCE_VISIT_DETAIL_TABS,
  VISIT_TYPE_LABELS,
  type MaintenanceVisitDetailTabKey,
  type VisitType,
} from "@/lib/energy/maintenance-visits/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { VisitStatusBadge } from "./status-badge";
import { VisitStatusButton, VisitChecklistForm, CompleteVisitForm, type ProductOption, type LocationOption } from "./visit-controls";

export async function VisitDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const visit = await getMaintenanceVisitById({ companyId: session.companyId, id });
  if (!visit) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: MaintenanceVisitDetailTabKey = isMaintenanceVisitDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageMaintenanceVisits(session.role);
  const canComplete = canCompleteMaintenanceVisits(session.role);
  const isOpen = visit.status === "PLANNED" || visit.status === "IN_PROGRESS";

  let products: ProductOption[] = [];
  let locations: LocationOption[] = [];
  let defaultLocationId = "";
  if (canComplete && isOpen) {
    const [productRows, locationRows] = await Promise.all([
      prisma.product.findMany({ where: { companyId: session.companyId, isActive: true, stockTracked: true }, orderBy: { name: "asc" } }),
      prisma.location.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    ]);
    products = productRows.map((p) => ({ id: p.id, name: p.name, code: p.code, stockTracked: p.stockTracked }));
    locations = locationRows.map((l) => ({ id: l.id, name: l.name }));
    defaultLocationId = locations.find((l) => l)?.id ?? "";
  }

  return (
    <div>
      <PageHeader
        title={visit.visitNumber}
        description={`${visit.customer.name}${visit.site ? ` · ${visit.site.name}` : ""}`}
        actions={<VisitStatusBadge status={visit.status} />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {canManage && visit.status === "PLANNED" ? <VisitStatusButton id={id} target="IN_PROGRESS" label="Start Visit" /> : null}
        {canManage && isOpen ? <VisitStatusButton id={id} target="CANCELLED" label="Cancel" danger /> : null}
      </div>

      <div className="mb-6 overflow-x-auto border-b border-slate-200">
        <nav className="flex min-w-max gap-1">
          {MAINTENANCE_VISIT_DETAIL_TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? `/service/maintenance/${id}` : `/service/maintenance/${id}?tab=${t.key}`}
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
                <Field label="Customer" value={<Link href={`/parties/clients/${visit.customerId}`} className="text-emerald-700 hover:underline">{visit.customer.name}</Link>} />
                <Field label="Site" value={visit.site?.name} />
                <Field label="Project" value={visit.project ? <Link href={`/projects/${visit.project.id}`} className="text-emerald-700 hover:underline">{visit.project.projectNumber}</Link> : undefined} />
                <Field label="Installed Equipment" value={visit.installedEquipment ? <Link href={`/warranty/equipment/${visit.installedEquipment.id}`} className="text-emerald-700 hover:underline">{visit.installedEquipment.equipmentNumber}</Link> : undefined} />
                <Field label="Service Request" value={visit.serviceRequest ? <Link href={`/service/service-requests/${visit.serviceRequest.id}`} className="text-emerald-700 hover:underline">{visit.serviceRequest.requestNumber}</Link> : undefined} />
                <Field label="AMC" value={visit.amc ? <Link href={`/service/amc/${visit.amc.id}`} className="text-emerald-700 hover:underline">{visit.amc.amcNumber}</Link> : undefined} />
                <Field label="Visit Type" value={VISIT_TYPE_LABELS[visit.visitType as VisitType] ?? visit.visitType} />
                <Field label="Visit Date" value={visit.visitDate.toLocaleDateString()} />
                <Field label="Technician" value={visit.technician?.name} />
                <Field label="Next Maintenance Date" value={visit.nextMaintenanceDate?.toLocaleDateString()} />
                {visit.findings ? <div className="sm:col-span-2"><Field label="Findings" value={visit.findings} /></div> : null}
                {visit.workPerformed ? <div className="sm:col-span-2"><Field label="Work Performed" value={visit.workPerformed} /></div> : null}
                {visit.result ? <div className="sm:col-span-2"><Field label="Result" value={visit.result} /></div> : null}
                {visit.customerRemarks ? <div className="sm:col-span-2"><Field label="Customer Remarks" value={visit.customerRemarks} /></div> : null}
                {visit.technicianRemarks ? <div className="sm:col-span-2"><Field label="Technician Remarks" value={visit.technicianRemarks} /></div> : null}
              </CardContent>
            </Card>
          </div>

          {canComplete && isOpen ? (
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Complete Visit</p>
                <CompleteVisitForm visitId={id} products={products} locations={locations} defaultLocationId={defaultLocationId} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "checklist" ? (
        <Card>
          <CardContent className="py-4">
            <VisitChecklistForm visitId={id} initial={visit.checklistJson ? JSON.parse(visit.checklistJson) : {}} />
          </CardContent>
        </Card>
      ) : null}

      {tab === "parts" ? (
        visit.partsUsed.length === 0 ? (
          <EmptyState title="No parts used" description="Parts consumed on this visit will show up here once it's completed." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5">Quantity</th>
                  <th className="px-4 py-2.5">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visit.partsUsed.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{p.productName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.quantity}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.location.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "activity" ? <ActivityTab companyId={session.companyId} visitId={id} /> : null}
    </div>
  );
}

async function ActivityTab({ companyId, visitId }: { companyId: string; visitId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "MaintenanceVisit", entityId: visitId },
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
