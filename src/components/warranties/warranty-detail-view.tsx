import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { getWarrantyById } from "@/lib/energy/warranties/queries";
import { canManageWarranties } from "@/lib/core/permissions";
import { WARRANTY_TYPE_LABELS, type WarrantyType } from "@/lib/energy/warranties/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WarrantyStatusBadge } from "./status-badge";
import { CancelWarrantyButton } from "./warranty-controls";
import { ServiceRequestStatusBadge } from "@/components/service-requests/status-badge";

export async function WarrantyDetailView({ id }: { id: string }) {
  const session = await requireSession();
  const warranty = await getWarrantyById({ companyId: session.companyId, id });
  if (!warranty) notFound();

  const canManage = canManageWarranties(session.role);

  return (
    <div>
      <PageHeader
        title={warranty.warrantyNumber}
        description={warranty.customer.name}
        actions={
          <>
            <WarrantyStatusBadge warranty={warranty} />
            {canManage && warranty.status !== "CANCELLED" ? (
              <>
                <Link href={`/warranty/warranties/${id}/edit`}>
                  <Button size="sm"><Pencil className="h-4 w-4" />Edit</Button>
                </Link>
                <CancelWarrantyButton id={id} />
              </>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <Field label="Customer" value={<Link href={`/parties/clients/${warranty.customerId}`} className="text-emerald-700 hover:underline">{warranty.customer.name}</Link>} />
            <Field label="Site" value={warranty.site?.name} />
            <Field label="Project" value={warranty.project ? <Link href={`/projects/${warranty.project.id}`} className="text-emerald-700 hover:underline">{warranty.project.projectNumber}</Link> : undefined} />
            <Field
              label="Installed Equipment"
              value={warranty.installedEquipment ? <Link href={`/warranty/equipment/${warranty.installedEquipment.id}`} className="text-emerald-700 hover:underline">{warranty.installedEquipment.equipmentNumber} - {warranty.installedEquipment.productName}</Link> : undefined}
            />
            <Field label="Warranty Type" value={WARRANTY_TYPE_LABELS[warranty.warrantyType as WarrantyType] ?? warranty.warrantyType} />
            <Field label="Duration" value={warranty.durationMonths ? `${warranty.durationMonths} months` : undefined} />
            <Field label="Start Date" value={warranty.startDate.toLocaleDateString()} />
            <Field label="End Date" value={warranty.endDate.toLocaleDateString()} />
            <Field label="Document / Reference" value={warranty.documentReference} />
            <div className="sm:col-span-2">
              <Field label="Coverage" value={warranty.coverage} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Exclusions" value={warranty.exclusions} />
            </div>
            {warranty.terms ? (
              <div className="sm:col-span-2">
                <Field label="Terms" value={warranty.terms} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Service History</p>
        {warranty.serviceRequests.length === 0 ? (
          <EmptyState title="No service requests" description="Service requests that referenced this warranty will show up here." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {warranty.serviceRequests.map((sr) => (
                  <tr key={sr.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/service/service-requests/${sr.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{sr.requestNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{sr.requestDate.toLocaleDateString()}</td>
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

function Field({ label, value }: { label: string; value?: string | null | React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</p>
    </div>
  );
}
