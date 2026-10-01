import Link from "next/link";
import { Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listInstalledEquipment } from "@/lib/energy/installed-equipment/queries";
import { EQUIPMENT_STATUSES, EQUIPMENT_STATUS_LABELS, type EquipmentStatus } from "@/lib/energy/installed-equipment/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EquipmentStatusBadge } from "./status-badge";

function isStatus(value: string | undefined): value is EquipmentStatus {
  return (EQUIPMENT_STATUSES as readonly string[]).includes(value ?? "");
}

export async function EquipmentListView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const status = isStatus(typeof params.status === "string" ? params.status : undefined) ? (params.status as EquipmentStatus) : "all";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const { items, total, pageSize } = await listInstalledEquipment({ companyId: session.companyId, q, status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status !== "all") qs.set("status", status);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const query = qs.toString();
    return query ? `/warranty/equipment?${query}` : "/warranty/equipment";
  }

  return (
    <div>
      <PageHeader title="Installed Equipment" description="Equipment installed at customer sites - created automatically when an installation completes." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="q" name="q" defaultValue={q} placeholder="Equipment number, product, serial, customer…" className="pl-8" />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <Select id="status" name="status" defaultValue={status} className="w-48">
            <option value="all">All</option>
            {EQUIPMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No installed equipment yet"
          description="Equipment shows up here automatically once an installation is completed."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Equipment</th>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Serial</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Site</th>
                <th className="px-4 py-2.5">Installed</th>
                <th className="px-4 py-2.5">Qty</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/warranty/equipment/${e.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                      {e.equipmentNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {e.productCode ? `${e.productCode} - ` : ""}
                    {e.productName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{e.serialNumberText ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-700">{e.customer.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.site?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.installationDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.quantity}</td>
                  <td className="px-4 py-2.5">
                    <EquipmentStatusBadge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <p>Showing {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}</p>
          <div className="flex gap-2">
            {page <= 1 ? (
              <Button variant="secondary" size="sm" disabled>Previous</Button>
            ) : (
              <Link href={pageHref(page - 1)}><Button variant="secondary" size="sm">Previous</Button></Link>
            )}
            {page >= totalPages ? (
              <Button variant="secondary" size="sm" disabled>Next</Button>
            ) : (
              <Link href={pageHref(page + 1)}><Button variant="secondary" size="sm">Next</Button></Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
