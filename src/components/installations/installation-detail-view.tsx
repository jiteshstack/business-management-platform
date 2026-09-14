import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getInstallationById } from "@/lib/energy/installations/queries";
import { setInstallationStatusAction, completeInstallationAction } from "@/lib/energy/installations/actions";
import { canManageInstallations } from "@/lib/core/permissions";
import {
  isInstallationDetailTabKey,
  INSTALLATION_STATUS_TRANSITIONS,
  INSTALLATION_STATUS_LABELS,
  type InstallationDetailTabKey,
  type InstallationStatus,
} from "@/lib/energy/installations/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InstallationStatusBadge } from "./status-badge";
import { InstallationTabs } from "./installation-tabs";
import { ChecklistForm } from "./checklist-form";

export async function InstallationDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const installation = await getInstallationById({ companyId: session.companyId, id });
  if (!installation) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: InstallationDetailTabKey = isInstallationDetailTabKey(rawTab) ? rawTab : "overview";

  const canManage = canManageInstallations(session.role);
  const allowedTransitions = INSTALLATION_STATUS_TRANSITIONS[installation.status as InstallationStatus] ?? [];
  const canComplete = installation.status !== "COMPLETED" && installation.status !== "CANCELLED";

  let checklist: Record<string, boolean> = {};
  try {
    checklist = installation.checklistJson ? JSON.parse(installation.checklistJson) : {};
  } catch {
    checklist = {};
  }

  return (
    <div>
      <PageHeader
        title={installation.installationNumber}
        description={`${installation.project.customer.name} · ${installation.project.projectNumber}`}
        actions={<InstallationStatusBadge status={installation.status} />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={`/projects/${installation.projectId}`}>
          <Button variant="secondary" size="sm">
            View Project
          </Button>
        </Link>
        {canManage
          ? allowedTransitions.map((next) => (
              <form key={next} action={setInstallationStatusAction.bind(null, id, next)}>
                <Button type="submit" variant={next === "CANCELLED" ? "danger" : "secondary"} size="sm">
                  Mark as {INSTALLATION_STATUS_LABELS[next]}
                </Button>
              </form>
            ))
          : null}
        {canManage && canComplete ? (
          <form action={completeInstallationAction.bind(null, id)}>
            <Button type="submit" size="sm">
              <CheckCircle2 className="h-4 w-4" />
              Complete Installation
            </Button>
          </form>
        ) : null}
      </div>

      <InstallationTabs basePath={`/projects/installations/${id}`} active={tab} />

      {tab === "overview" ? <OverviewTab installation={installation} /> : null}
      {tab === "items" ? <ItemsTab installation={installation} /> : null}
      {tab === "checklist" ? (
        <Card>
          <CardContent className="py-4">
            <ChecklistForm installationId={id} initial={checklist} />
          </CardContent>
        </Card>
      ) : null}
      {tab === "activity" ? <ActivityTab companyId={session.companyId} installationId={id} /> : null}
    </div>
  );
}

type InstallationWithRelations = NonNullable<Awaited<ReturnType<typeof getInstallationById>>>;

function OverviewTab({ installation }: { installation: InstallationWithRelations }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <Field label="Project" value={<Link href={`/projects/${installation.projectId}`} className="text-emerald-700 hover:underline">{installation.project.projectNumber}</Link>} />
          <Field label="Customer" value={installation.project.customer.name} />
          <Field label="Site" value={installation.site?.name} />
          <Field label="Installation Date" value={installation.installationDate.toLocaleDateString()} />
          <Field label="Technician" value={installation.technician?.name} />
          <Field label="Completed At" value={installation.completedAt?.toLocaleString()} />
          {installation.notes ? (
            <div className="sm:col-span-2">
              <Field label="Notes" value={installation.notes} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemsTab({ installation }: { installation: InstallationWithRelations }) {
  if (installation.items.length === 0) {
    return <EmptyState title="No items" description="No equipment was attached to this installation." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Product</th>
            <th className="px-4 py-2.5">Quantity</th>
            <th className="px-4 py-2.5">Serial Numbers</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {installation.items.map((item) => {
            let serials: string[] = [];
            try {
              serials = item.serialNumbersJson ? JSON.parse(item.serialNumbersJson) : [];
            } catch {
              serials = [];
            }
            return (
              <tr key={item.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{item.productName}</td>
                <td className="px-4 py-2.5 text-slate-600">{item.quantity}</td>
                <td className="px-4 py-2.5 text-slate-600">{serials.length > 0 ? serials.join(", ") : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function ActivityTab({ companyId, installationId }: { companyId: string; installationId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "Installation", entityId: installationId },
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

function Field({ label, value }: { label: string; value?: string | null | React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</p>
    </div>
  );
}
