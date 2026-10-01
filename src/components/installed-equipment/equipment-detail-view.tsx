import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { getInstalledEquipmentById } from "@/lib/energy/installed-equipment/queries";
import { canManageInstalledEquipment, canManageWarranties, canManageServiceRequests } from "@/lib/core/permissions";
import { isEquipmentDetailTabKey, EQUIPMENT_DETAIL_TABS, type EquipmentDetailTabKey } from "@/lib/energy/installed-equipment/types";
import { findActiveWarrantyForEquipment } from "@/lib/energy/warranties/queries";
import { findActiveAmcForCustomer } from "@/lib/energy/amc/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EquipmentStatusBadge } from "./status-badge";
import { EquipmentStatusSelect } from "./equipment-controls";
import { WarrantyStatusBadge } from "@/components/warranties/status-badge";
import { AmcStatusBadge } from "@/components/amc/status-badge";
import { ServiceRequestStatusBadge } from "@/components/service-requests/status-badge";
import { VisitStatusBadge } from "@/components/maintenance-visits/status-badge";

export async function EquipmentDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const equipment = await getInstalledEquipmentById({ companyId: session.companyId, id });
  if (!equipment) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: EquipmentDetailTabKey = isEquipmentDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageInstalledEquipment(session.role);
  const canWarranty = canManageWarranties(session.role);
  const canService = canManageServiceRequests(session.role);

  const [activeWarranty, activeAmc] = await Promise.all([
    findActiveWarrantyForEquipment({ companyId: session.companyId, installedEquipmentId: id }),
    findActiveAmcForCustomer({ companyId: session.companyId, customerId: equipment.customerId, siteId: equipment.siteId }),
  ]);

  return (
    <div>
      <PageHeader
        title={equipment.equipmentNumber}
        description={`${equipment.productName}${equipment.serialNumberText ? ` · Serial ${equipment.serialNumberText}` : ""}`}
        actions={
          <>
            <EquipmentStatusBadge status={equipment.status} />
            {canManage ? <EquipmentStatusSelect id={id} status={equipment.status} /> : null}
          </>
        }
      />

      <div className="mb-6 overflow-x-auto border-b border-slate-200">
        <nav className="flex min-w-max gap-1">
          {EQUIPMENT_DETAIL_TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? `/warranty/equipment/${id}` : `/warranty/equipment/${id}?tab=${t.key}`}
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
                <Field label="Product" value={equipment.productName} />
                <Field label="Serial Number" value={equipment.serialNumberText} />
                <Field label="Customer" value={<Link href={`/parties/clients/${equipment.customerId}`} className="text-emerald-700 hover:underline">{equipment.customer.name}</Link>} />
                <Field label="Site" value={equipment.site?.name} />
                <Field label="Project" value={<Link href={`/projects/${equipment.projectId}`} className="text-emerald-700 hover:underline">{equipment.project.projectNumber}</Link>} />
                <Field label="Installation" value={<Link href={`/projects/installations/${equipment.installationId}`} className="text-emerald-700 hover:underline">{equipment.installation.installationNumber}</Link>} />
                <Field label="Installation Date" value={equipment.installationDate.toLocaleDateString()} />
                <Field label="Quantity" value={String(equipment.quantity)} />
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-2 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Warranty</p>
                  {activeWarranty ? (
                    <>
                      <WarrantyStatusBadge warranty={activeWarranty} />
                      <p className="text-slate-600">Until {activeWarranty.endDate.toLocaleDateString()}</p>
                      <Link href={`/warranty/warranties/${activeWarranty.id}`} className="text-emerald-700 hover:underline">View warranty</Link>
                    </>
                  ) : (
                    <p className="text-slate-400">No active warranty.</p>
                  )}
                  {canWarranty ? (
                    <Link
                      href={`/warranty/warranties/new?customerId=${equipment.customerId}&siteId=${equipment.siteId ?? ""}&projectId=${equipment.projectId}&installedEquipmentId=${equipment.id}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Add warranty
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-2 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">AMC</p>
                  {activeAmc ? (
                    <>
                      <AmcStatusBadge amc={activeAmc} />
                      <p className="text-slate-600">Until {activeAmc.endDate.toLocaleDateString()}</p>
                      <Link href={`/service/amc/${activeAmc.id}`} className="text-emerald-700 hover:underline">View AMC</Link>
                    </>
                  ) : (
                    <p className="text-slate-400">No active AMC.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          {equipment.notes ? (
            <Card>
              <CardContent className="py-4">
                <Field label="Notes" value={equipment.notes} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "warranty" ? (
        <div className="space-y-4">
          {canWarranty ? (
            <div className="flex justify-end">
              <Link href={`/warranty/warranties/new?customerId=${equipment.customerId}&siteId=${equipment.siteId ?? ""}&projectId=${equipment.projectId}&installedEquipmentId=${equipment.id}`}>
                <Button size="sm"><Plus className="h-4 w-4" />Add Warranty</Button>
              </Link>
            </div>
          ) : null}
          {equipment.warranties.length === 0 ? (
            <EmptyState title="No warranty records" description="Add a warranty for this equipment." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[600px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {equipment.warranties.map((w) => (
                    <tr key={w.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/warranty/warranties/${w.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{w.warrantyNumber}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{w.startDate.toLocaleDateString()} – {w.endDate.toLocaleDateString()}</td>
                      <td className="px-4 py-2.5"><WarrantyStatusBadge warranty={w} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "amc" ? (
        activeAmc ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[500px] text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-2.5">
                    <Link href={`/service/amc/${activeAmc.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{activeAmc.amcNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{activeAmc.startDate.toLocaleDateString()} – {activeAmc.endDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5"><AmcStatusBadge amc={activeAmc} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No active AMC" description="This customer/site has no active AMC contract right now." />
        )
      ) : null}

      {tab === "service" ? (
        <div className="space-y-4">
          {canService ? (
            <div className="flex justify-end">
              <Link href={`/service/service-requests/new?customerId=${equipment.customerId}&siteId=${equipment.siteId ?? ""}&projectId=${equipment.projectId}&installedEquipmentId=${equipment.id}`}>
                <Button size="sm"><Plus className="h-4 w-4" />New Service Request</Button>
              </Link>
            </div>
          ) : null}
          {equipment.serviceRequests.length === 0 ? (
            <EmptyState title="No service history" description="Service requests logged for this equipment will show up here." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Request</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Issue</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {equipment.serviceRequests.map((sr) => (
                    <tr key={sr.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/service/service-requests/${sr.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{sr.requestNumber}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{sr.requestDate.toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-slate-700">{sr.issue}</td>
                      <td className="px-4 py-2.5"><ServiceRequestStatusBadge status={sr.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "maintenance" ? (
        equipment.maintenanceVisits.length === 0 ? (
          <EmptyState title="No maintenance visits" description="Maintenance visits for this equipment will show up here." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Visit</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Technician</th>
                  <th className="px-4 py-2.5">Next Maintenance</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equipment.maintenanceVisits.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/service/maintenance/${v.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{v.visitNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{v.visitDate.toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.technician?.name ?? "-"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.nextMaintenanceDate ? v.nextMaintenanceDate.toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-2.5"><VisitStatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
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
