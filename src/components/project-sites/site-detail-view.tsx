import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { getProjectSiteById } from "@/lib/energy/project-sites/queries";
import { canManageSites } from "@/lib/core/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectStatusBadge } from "@/components/projects/status-badge";
import { InstallationStatusBadge } from "@/components/installations/status-badge";
import { listInstalledEquipmentForSite } from "@/lib/energy/installed-equipment/queries";
import { EquipmentStatusBadge } from "@/components/installed-equipment/status-badge";
import { listWarrantiesForSite } from "@/lib/energy/warranties/queries";
import { WarrantyStatusBadge } from "@/components/warranties/status-badge";
import { listAmcsForSite } from "@/lib/energy/amc/queries";
import { AmcStatusBadge } from "@/components/amc/status-badge";
import { listServiceRequestsForSite } from "@/lib/energy/service-requests/queries";
import { ServiceRequestStatusBadge } from "@/components/service-requests/status-badge";
import { listMaintenanceVisitsForSite } from "@/lib/energy/maintenance-visits/queries";
import { VisitStatusBadge } from "@/components/maintenance-visits/status-badge";
import { listExpensesForSite } from "@/lib/energy/expenses/queries";
import { ExpenseStatusBadge } from "@/components/expenses/status-badge";

export async function ProjectSiteDetailView({ id }: { id: string }) {
  const session = await requireSession();
  const site = await getProjectSiteById({ companyId: session.companyId, id });
  if (!site) notFound();

  const canManage = canManageSites(session.role);

  const [equipment, warranties, amcs, serviceRequests, maintenanceVisits, expenses] = await Promise.all([
    listInstalledEquipmentForSite({ companyId: session.companyId, siteId: id }),
    listWarrantiesForSite({ companyId: session.companyId, siteId: id }),
    listAmcsForSite({ companyId: session.companyId, siteId: id }),
    listServiceRequestsForSite({ companyId: session.companyId, siteId: id }),
    listMaintenanceVisitsForSite({ companyId: session.companyId, siteId: id }),
    listExpensesForSite({ companyId: session.companyId, siteId: id }),
  ]);
  const siteExpenseTotal = expenses.reduce((sum, e) => sum + e.grandTotal, 0);

  return (
    <div>
      <PageHeader
        title={site.name}
        description={site.customer.name}
        actions={
          canManage ? (
            <Link href={`/projects/sites/${id}/edit`}>
              <Button size="sm">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <Field label="Customer" value={site.customer.name} />
            <Field label="Address" value={[site.line1, site.line2, site.city, site.state, site.pincode].filter(Boolean).join(", ")} />
            <Field label="Landmark" value={site.landmark} />
            <Field label="Contact Person" value={site.contactPerson} />
            <Field label="Contact Phone" value={site.contactPhone} />
            <Field label="Contact Email" value={site.contactEmail} />
            {site.notes ? (
              <div className="sm:col-span-2">
                <Field label="Notes" value={site.notes} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Projects at this Site</p>
          {site.projects.length === 0 ? (
            <EmptyState title="No projects yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[400px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {site.projects.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/projects/${p.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                          {p.projectNumber}
                        </Link>
                        <p className="text-xs text-slate-500">{p.name}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <ProjectStatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Installation History</p>
          {site.installations.length === 0 ? (
            <EmptyState title="No installations yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[400px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {site.installations.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/projects/installations/${i.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                          {i.installationNumber}
                        </Link>
                        <p className="text-xs text-slate-500">{i.installationDate.toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <InstallationStatusBadge status={i.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Installed Equipment</p>
        {equipment.length === 0 ? (
          <EmptyState title="No installed equipment yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[500px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {equipment.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/warranty/equipment/${e.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{e.equipmentNumber}</Link>
                      <p className="text-xs text-slate-500">{e.productName}</p>
                    </td>
                    <td className="px-4 py-2.5"><EquipmentStatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                        <Link href={`/warranty/warranties/${w.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{w.warrantyNumber}</Link>
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
                        <Link href={`/service/amc/${a.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{a.amcNumber}</Link>
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Open Service Requests</p>
          {serviceRequests.filter((sr) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(sr.status)).length === 0 ? (
            <EmptyState title="No open service requests" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[400px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {serviceRequests
                    .filter((sr) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(sr.status))
                    .map((sr) => (
                      <tr key={sr.id}>
                        <td className="px-4 py-2.5">
                          <Link href={`/service/service-requests/${sr.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{sr.requestNumber}</Link>
                          <p className="text-xs text-slate-500">{sr.issue}</p>
                        </td>
                        <td className="px-4 py-2.5"><ServiceRequestStatusBadge status={sr.status} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Maintenance History</p>
          {maintenanceVisits.length === 0 ? (
            <EmptyState title="No maintenance visits yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[400px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {maintenanceVisits.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/service/maintenance/${v.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{v.visitNumber}</Link>
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
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Site Expenses</p>
          <p className="text-sm font-medium text-slate-900">₹{siteExpenseTotal.toLocaleString("en-IN")}</p>
        </div>
        {expenses.length === 0 ? (
          <EmptyState title="No expenses recorded for this site" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[500px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/finance/expenses/${e.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{e.expenseNumber}</Link>
                      <p className="text-xs text-slate-500">{e.category.name}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">₹{e.grandTotal.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5"><ExpenseStatusBadge status={e.status} /></td>
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

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</p>
    </div>
  );
}
