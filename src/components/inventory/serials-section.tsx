import type { SerialNumber } from "@prisma/client";
import { ScanLine } from "lucide-react";
import type { FormActionState } from "@/lib/core/form-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { SERIAL_STATUS_LABELS, type SerialStatus } from "@/lib/energy/inventory/types";
import { SerialStatusInlineForm } from "./serial-status-inline-form";

function statusBadgeVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "IN_STOCK") return "success";
  if (status === "DAMAGED" || status === "RETIRED") return "danger";
  if (status === "RESERVED" || status === "UNDER_SERVICE") return "warning";
  return "neutral";
}

export function SerialsSection({
  serials,
  canManage,
  updateStatusAction,
}: {
  serials: SerialNumber[];
  canManage: boolean;
  updateStatusAction: (
    serialId: string,
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
}) {
  if (serials.length === 0) {
    return (
      <EmptyState
        icon={ScanLine}
        title="No serial numbers yet"
        description="Serial numbers are added when you record Stock In or Opening Stock for a serial-tracked product."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Serial Number</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Added</th>
            {canManage ? <th className="px-4 py-2.5">Update status</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {serials.map((serial) => (
            <tr key={serial.id}>
              <td className="px-4 py-2.5 font-medium text-slate-900">{serial.serialNumber}</td>
              <td className="px-4 py-2.5">
                <Badge variant={statusBadgeVariant(serial.status)}>
                  {SERIAL_STATUS_LABELS[serial.status as SerialStatus] ?? serial.status}
                </Badge>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                {serial.createdAt.toLocaleDateString()}
              </td>
              {canManage ? (
                <td className="px-4 py-2.5">
                  <SerialStatusInlineForm
                    serialId={serial.id}
                    currentStatus={serial.status}
                    updateStatusAction={updateStatusAction}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
