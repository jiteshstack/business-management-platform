import type { StockMovement, User, Location } from "@prisma/client";
import { History } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_INCREASES_TOTAL,
  MOVEMENT_DECREASES_TOTAL,
  type MovementType,
} from "@/lib/energy/inventory/types";

type MovementWithRelations = StockMovement & { user: User | null; location: Location };

function badgeVariant(type: string): "success" | "danger" | "warning" | "neutral" {
  if (MOVEMENT_INCREASES_TOTAL.includes(type as MovementType)) return "success";
  if (MOVEMENT_DECREASES_TOTAL.includes(type as MovementType)) return "danger";
  if (type === "DAMAGE") return "danger";
  if (type === "RESERVE" || type === "RESERVE_RELEASE") return "warning";
  return "neutral";
}

export function MovementsSection({ movements }: { movements: MovementWithRelations[] }) {
  if (movements.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No stock movements yet"
        description="Stock in, stock out, adjustments and reservations will show up here."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Quantity</th>
            <th className="px-4 py-2.5">Total After</th>
            <th className="px-4 py-2.5">Reference / Reason</th>
            <th className="px-4 py-2.5">User</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                {movement.createdAt.toLocaleString()}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={badgeVariant(movement.type)}>
                  {MOVEMENT_TYPE_LABELS[movement.type as MovementType] ?? movement.type}
                </Badge>
              </td>
              <td className="px-4 py-2.5 font-medium text-slate-900">
                {MOVEMENT_DECREASES_TOTAL.includes(movement.type as MovementType) ? "-" : "+"}
                {movement.quantity}
              </td>
              <td className="px-4 py-2.5 text-slate-600">{movement.newTotalQty}</td>
              <td className="px-4 py-2.5 text-slate-600">
                {movement.reason ?? movement.reference ?? <span className="text-slate-300">-</span>}
              </td>
              <td className="px-4 py-2.5 text-slate-500">{movement.user?.name ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
