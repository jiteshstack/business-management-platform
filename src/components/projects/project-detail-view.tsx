import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Wrench } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import {
  getProjectById,
  getProjectDocuments,
  getProjectCommercialSummary,
} from "@/lib/energy/projects/queries";
import { setProjectStatusAction, uploadProjectDocumentAction, deleteProjectDocumentAction } from "@/lib/energy/projects/actions";
import { canManageProjects, canCancelProjects, canManageInstallations } from "@/lib/core/permissions";
import {
  isProjectDetailTabKey,
  PROJECT_STATUS_TRANSITIONS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type ProjectDetailTabKey,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/energy/projects/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectStatusBadge } from "./status-badge";
import { ProjectTabs } from "./project-tabs";
import { InstallationStatusBadge } from "@/components/installations/status-badge";
import { DocumentsSection } from "@/components/parties/documents-section";
import { MilestoneRow, AddMilestoneForm } from "./milestone-controls";
import { AssignQuantityForm, AssignSerialForm, UnassignSerialButton } from "./assign-controls";
import { listInstalledEquipmentForProject } from "@/lib/energy/installed-equipment/queries";
import { EquipmentStatusBadge } from "@/components/installed-equipment/status-badge";
import { listWarrantiesForProject } from "@/lib/energy/warranties/queries";
import { WarrantyStatusBadge } from "@/components/warranties/status-badge";
import { listAmcsForProject } from "@/lib/energy/amc/queries";
import { AmcStatusBadge } from "@/components/amc/status-badge";
import { listServiceRequestsForProject } from "@/lib/energy/service-requests/queries";
import { ServiceRequestStatusBadge } from "@/components/service-requests/status-badge";
import { getProjectProfitability } from "@/lib/energy/reporting/project-profitability";
import { canViewProfitability, canManageExpenses } from "@/lib/core/permissions";
import { getProjectExpenseTotal } from "@/lib/energy/expenses/queries";

export async function ProjectDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const project = await getProjectById({ companyId: session.companyId, id });
  if (!project) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: ProjectDetailTabKey = isProjectDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageProjects(session.role);
  const canCancel = canCancelProjects(session.role);
  const canInstall = canManageInstallations(session.role);

  const allowedTransitions = PROJECT_STATUS_TRANSITIONS[project.status as ProjectStatus] ?? [];

  const documents = tab === "documents" ? await getProjectDocuments({ companyId: session.companyId, projectId: id }) : [];
  const commercialSummary =
    tab === "overview" ? await getProjectCommercialSummary({ companyId: session.companyId, salesOrderId: project.salesOrderId }) : null;
  const projectExpenseTotal =
    tab === "overview" ? await getProjectExpenseTotal({ companyId: session.companyId, projectId: id }) : 0;

  const totalRequired = project.items.reduce((sum, i) => sum + i.requiredQuantity, 0);
  const totalInstalled = project.items.reduce((sum, i) => sum + i.installedQuantity, 0);
  const itemProgress = totalRequired > 0 ? Math.round((totalInstalled / totalRequired) * 100) : 0;
  const completedMilestones = project.milestones.filter((m) => m.status === "COMPLETED" || m.status === "SKIPPED").length;
  const milestoneProgress =
    project.milestones.length > 0 ? Math.round((completedMilestones / project.milestones.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={project.projectNumber}
        description={`${project.customer.name}${project.site ? ` · ${project.site.name}` : ""}`}
        actions={
          <>
            <ProjectStatusBadge status={project.status} />
            <span className="text-sm font-semibold text-slate-900">{project.name}</span>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {canManage && project.status !== "COMPLETED" && project.status !== "CANCELLED" ? (
          <Link href={`/projects/${id}/edit`}>
            <Button size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
        ) : null}
        {canInstall && project.status === "IN_PROGRESS" ? (
          <Link href={`/projects/installations/new?projectId=${id}`}>
            <Button variant="secondary" size="sm">
              <Wrench className="h-4 w-4" />
              Create Installation
            </Button>
          </Link>
        ) : null}
        {canManage
          ? allowedTransitions
              .filter((next) => next !== "CANCELLED" || canCancel)
              .map((next) => (
                <form key={next} action={setProjectStatusAction.bind(null, id, next)}>
                  <Button type="submit" variant={next === "CANCELLED" ? "danger" : "secondary"} size="sm">
                    Mark as {PROJECT_STATUS_LABELS[next]}
                  </Button>
                </form>
              ))
          : null}
      </div>

      <ProjectTabs basePath={`/projects/${id}`} active={tab} />

      {tab === "overview" ? (
        <OverviewTab
          project={project}
          commercialSummary={commercialSummary}
          itemProgress={itemProgress}
          milestoneProgress={milestoneProgress}
          projectExpenseTotal={projectExpenseTotal}
          canLogExpense={canManageExpenses(session.role)}
        />
      ) : null}
      {tab === "scope" ? <ScopeTab project={project} companyId={session.companyId} canManage={canManage} /> : null}
      {tab === "milestones" ? <MilestonesTab project={project} canManage={canManage} /> : null}
      {tab === "installations" ? <InstallationsTab project={project} /> : null}
      {tab === "service" ? <ProjectServiceTab companyId={session.companyId} projectId={id} /> : null}
      {tab === "profitability" ? (
        canViewProfitability(session.role) ? (
          <ProjectProfitabilityTab companyId={session.companyId} projectId={id} />
        ) : (
          <EmptyState title="Access restricted" description="Only Owner/Admin and Accounts can view project profitability." />
        )
      ) : null}
      {tab === "documents" ? (
        <DocumentsSection
          documents={documents}
          uploadAction={uploadProjectDocumentAction.bind(null, id)}
          deleteAction={deleteProjectDocumentAction.bind(null, id)}
        />
      ) : null}
      {tab === "activity" ? <ActivityTab companyId={session.companyId} projectId={id} /> : null}
    </div>
  );
}

type ProjectWithRelations = NonNullable<Awaited<ReturnType<typeof getProjectById>>>;

function OverviewTab({
  project,
  commercialSummary,
  itemProgress,
  milestoneProgress,
  projectExpenseTotal,
  canLogExpense,
}: {
  project: ProjectWithRelations;
  commercialSummary: Awaited<ReturnType<typeof getProjectCommercialSummary>>;
  itemProgress: number;
  milestoneProgress: number;
  projectExpenseTotal: number;
  canLogExpense: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <Field label="Customer" value={project.customer.name} />
            <Field label="Site" value={project.site?.name} />
            <Field label="Project Type" value={PROJECT_TYPE_LABELS[project.type as ProjectType] ?? project.type} />
            <Field label="Priority" value={project.priority} />
            <Field
              label="Source Sales Order"
              value={
                project.salesOrder ? (
                  <Link href={`/sales/sales-orders/${project.salesOrder.id}`} className="text-emerald-700 hover:underline">
                    {project.salesOrder.soNumber}
                  </Link>
                ) : undefined
              }
            />
            <Field label="Start Date" value={project.startDate?.toLocaleDateString()} />
            <Field label="Expected Completion" value={project.expectedCompletionDate?.toLocaleDateString()} />
            <Field label="Actual Completion" value={project.actualCompletionDate?.toLocaleDateString()} />
            {project.description ? (
              <div className="sm:col-span-2">
                <Field label="Description" value={project.description} />
              </div>
            ) : null}
            {project.notes ? (
              <div className="sm:col-span-2">
                <Field label="Notes" value={project.notes} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Progress</p>
              <ProgressRow label="Equipment Installed" percent={itemProgress} />
              <ProgressRow label="Milestones" percent={milestoneProgress} />
            </CardContent>
          </Card>
        </div>
      </div>

      {commercialSummary ? (
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Commercial Summary - {commercialSummary.soNumber}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FinancialStat label="Contract Value" value={commercialSummary.contractValue} />
              <FinancialStat label="Invoiced" value={commercialSummary.invoiced} />
              <FinancialStat label="Paid" value={commercialSummary.paid} />
              <FinancialStat label="Outstanding" value={commercialSummary.outstanding} highlight={commercialSummary.outstanding > 0} />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Figures are read live from the linked Sales Order and its invoices/payments - not stored separately.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Project Expenses</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">₹{projectExpenseTotal.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs text-slate-400">Sum of approved/paid expenses linked to this project - derived, never manually entered.</p>
          </div>
          {canLogExpense ? (
            <Link href={`/finance/expenses/new?projectId=${project.id}`}>
              <Button variant="secondary" size="sm">Log Expense</Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressRow({ label, percent }: { label: string; percent: number }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, percent)}%` }} />
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

async function ScopeTab({
  project,
  companyId,
  canManage,
}: {
  project: ProjectWithRelations;
  companyId: string;
  canManage: boolean;
}) {
  if (project.items.length === 0) {
    return <EmptyState title="No scope items" description="This project has no equipment/product scope defined." />;
  }

  const serialTrackedProductIds = project.items.filter((i) => i.product?.serialTracked).map((i) => i.productId!);
  const assignedSerials = serialTrackedProductIds.length
    ? await prisma.serialNumber.findMany({
        where: { companyId, projectId: project.id, productId: { in: serialTrackedProductIds } },
        orderBy: { serialNumber: "asc" },
      })
    : [];
  const availableSerialsByProduct = new Map<string, { id: string; serialNumber: string }[]>();
  for (const productId of serialTrackedProductIds) {
    const serials = await prisma.serialNumber.findMany({
      where: { companyId, productId, status: { in: ["IN_STOCK", "RESERVED"] } },
      orderBy: { serialNumber: "asc" },
      select: { id: true, serialNumber: true },
    });
    availableSerialsByProduct.set(productId, serials);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Required</th>
              <th className="px-4 py-2.5">Reserved</th>
              <th className="px-4 py-2.5">Assigned</th>
              <th className="px-4 py-2.5">Installed</th>
              <th className="px-4 py-2.5">Pending</th>
              {canManage ? <th className="px-4 py-2.5">Assign</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {project.items.map((item) => {
              const pendingAssign = item.requiredQuantity - item.assignedQuantity;
              // Reservation is derived from the linked Sales Order's own
              // stockReserved flag (Phase 5) — never a second reservation
              // mechanism.
              const reserved = project.salesOrder?.stockReserved ? item.requiredQuantity : 0;
              return (
                <tr key={item.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {item.productCode ? `${item.productCode} - ` : ""}
                    {item.productName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{item.requiredQuantity}</td>
                  <td className="px-4 py-2.5 text-slate-600">{reserved}</td>
                  <td className="px-4 py-2.5 text-slate-600">{item.assignedQuantity}</td>
                  <td className="px-4 py-2.5 text-slate-600">{item.installedQuantity}</td>
                  <td className="px-4 py-2.5 text-slate-600">{item.requiredQuantity - item.assignedQuantity}</td>
                  {canManage ? (
                    <td className="px-4 py-2.5">
                      {pendingAssign <= 0 ? (
                        <span className="text-xs text-slate-400">Fully assigned</span>
                      ) : item.product?.serialTracked ? (
                        <AssignSerialForm
                          projectId={project.id}
                          projectItemId={item.id}
                          options={availableSerialsByProduct.get(item.productId!) ?? []}
                        />
                      ) : (
                        <AssignQuantityForm projectId={project.id} projectItemId={item.id} max={pendingAssign} />
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {assignedSerials.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Assigned / Installed Serials</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[400px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {assignedSerials.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{s.serialNumber}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={s.status === "INSTALLED" ? "success" : "warning"}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {canManage && s.status === "ASSIGNED" ? <UnassignSerialButton projectId={project.id} serialId={s.id} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MilestonesTab({ project, canManage }: { project: ProjectWithRelations; canManage: boolean }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Milestone</th>
              <th className="px-4 py-2.5">Planned Date</th>
              <th className="px-4 py-2.5">Actual Date</th>
              <th className="px-4 py-2.5">Status</th>
              {canManage ? <th className="px-4 py-2.5">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {project.milestones.map((m) => (
              <MilestoneRow key={m.id} projectId={project.id} milestone={m} canManage={canManage} />
            ))}
          </tbody>
        </table>
      </div>
      {canManage ? (
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Add Milestone</p>
            <AddMilestoneForm projectId={project.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function InstallationsTab({ project }: { project: ProjectWithRelations }) {
  if (project.installations.length === 0) {
    return <EmptyState title="No installations yet" description="Create an installation once the project is in progress." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Installation</th>
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Site</th>
            <th className="px-4 py-2.5">Technician</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {project.installations.map((i) => (
            <tr key={i.id}>
              <td className="px-4 py-2.5">
                <Link href={`/projects/installations/${i.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                  {i.installationNumber}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{i.installationDate.toLocaleDateString()}</td>
              <td className="px-4 py-2.5 text-slate-600">{i.site?.name ?? "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">{i.technician?.name ?? "-"}</td>
              <td className="px-4 py-2.5">
                <InstallationStatusBadge status={i.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Read-only, relationship-driven — never duplicates the underlying
// InstalledEquipment/Warranty/AMC/ServiceRequest records (spec section 37).
async function ProjectServiceTab({ companyId, projectId }: { companyId: string; projectId: string }) {
  const [equipment, warranties, amcs, serviceRequests] = await Promise.all([
    listInstalledEquipmentForProject({ companyId, projectId }),
    listWarrantiesForProject({ companyId, projectId }),
    listAmcsForProject({ companyId, projectId }),
    listServiceRequestsForProject({ companyId, projectId }),
  ]);

  return (
    <div className="space-y-6">
      <div>
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

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Post-installation Service Requests</p>
        {serviceRequests.length === 0 ? (
          <EmptyState title="No service requests yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[500px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {serviceRequests.map((sr) => (
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
    </div>
  );
}

// Estimated / operational profitability — never statutory accounting
// profit. Revenue is invoiced amount (Invoice records); cost is derived
// from installed quantity × product.purchasePrice (material), consumed
// service parts, and project expenses — see
// src/lib/energy/reporting/project-profitability.ts for the full
// methodology and its documented limitations.
async function ProjectProfitabilityTab({ companyId, projectId }: { companyId: string; projectId: string }) {
  const profitability = await getProjectProfitability({ companyId, projectId });
  if (!profitability) return <EmptyState title="No profitability data" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Commercial</p>
            <FinancialStat label="Sales Order Value" value={profitability.contractValue} />
            <div className="mt-3">
              <FinancialStat label="Invoiced (Revenue)" value={profitability.revenue} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Estimated Costs</p>
            <div className="grid grid-cols-3 gap-3">
              <FinancialStat label="Material" value={profitability.materialCost} />
              <FinancialStat label="Service" value={profitability.serviceCost} />
              <FinancialStat label="Expenses" value={profitability.expenseCost} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Estimated Result</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FinancialStat label="Estimated Revenue" value={profitability.revenue} />
            <FinancialStat label="Estimated Cost" value={profitability.totalCost} />
            <FinancialStat
              label="Estimated Gross Profit"
              value={profitability.estimatedProfit}
              highlight={profitability.estimatedProfit < 0}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Estimated Margin</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{profitability.estimatedMargin}%</p>
            </div>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
            Estimated / Operational figures - material cost uses installed quantity × product purchase price (not a
            weighted-average/FIFO cost), so this is an operational estimate, not statutory accounting profit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

async function ActivityTab({ companyId, projectId }: { companyId: string; projectId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "EnergyProject", entityId: projectId },
    orderBy: { createdAt: "asc" },
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

function Field({ label, value }: { label: string; value?: string | null | React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</p>
    </div>
  );
}
