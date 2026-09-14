import { requireSession } from "@/lib/auth/current-session";
import { listSerialNumbers } from "@/lib/energy/inventory/queries";
import { canManageInventory } from "@/lib/core/permissions";
import { updateSerialStatusAction } from "@/lib/energy/inventory/actions";
import { SERIAL_STATUSES, SERIAL_STATUS_LABELS, type SerialStatus } from "@/lib/energy/inventory/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanLine } from "lucide-react";
import Link from "next/link";
import { SerialStatusInlineForm } from "./serial-status-inline-form";

function statusBadgeVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "IN_STOCK") return "success";
  if (status === "DAMAGED" || status === "RETIRED") return "danger";
  if (status === "RESERVED" || status === "UNDER_SERVICE") return "warning";
  return "neutral";
}

export async function SerialNumbersListView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const canManage = canManageInventory(session.role);

  const serials = await listSerialNumbers({ companyId: session.companyId, q, status });

  return (
    <div>
      <PageHeader title="Serial Numbers" description="Individually tracked equipment across all products." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">
            Search
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Serial number…" />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="w-44">
            <option value="all">All</option>
            {SERIAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SERIAL_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {serials.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          title="No serial numbers yet"
          description="Enable serial tracking on a product, then record Stock In or Opening Stock with serial numbers."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Serial Number</th>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5">Added</th>
                {canManage ? <th className="px-4 py-2.5">Update status</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {serials.map((serial) => (
                <tr key={serial.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{serial.serialNumber}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/inventory/products/${serial.productId}`}
                      className="text-slate-700 hover:text-emerald-700 hover:underline"
                    >
                      {serial.product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusBadgeVariant(serial.status)}>
                      {SERIAL_STATUS_LABELS[serial.status as SerialStatus] ?? serial.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{serial.location?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    {serial.createdAt.toLocaleDateString()}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-2.5">
                      <SerialStatusInlineForm
                        serialId={serial.id}
                        currentStatus={serial.status}
                        updateStatusAction={updateSerialStatusAction}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
