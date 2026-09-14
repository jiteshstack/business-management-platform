import Link from "next/link";
import { Boxes, PackageX, AlertTriangle, Lock, ShieldAlert, ScanLine } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { getInventoryDashboard } from "@/lib/energy/inventory/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/energy/inventory/types";

export async function InventoryDashboardView() {
  const session = await requireSession();
  const data = await getInventoryDashboard(session.companyId);

  const stats = [
    { label: "Total Products", value: data.totalProducts, icon: Boxes },
    { label: "Stock-Tracked", value: data.stockTrackedProducts, icon: Boxes },
    { label: "Low Stock", value: data.lowStockCount, icon: AlertTriangle },
    { label: "Out of Stock", value: data.outOfStockCount, icon: PackageX },
    { label: "Reserved Units", value: data.totalReserved, icon: Lock },
    { label: "Damaged Units", value: data.totalDamaged, icon: ShieldAlert },
    { label: "Serial-Tracked", value: data.serialTrackedProducts, icon: ScanLine },
  ];

  return (
    <div>
      <PageHeader title="Stock" description="Inventory overview across all products." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-start justify-between py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low stock</CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStockItems.length === 0 ? (
              <EmptyState title="Nothing low on stock" description="All tracked products are above their reorder level." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.lowStockItems.map((balance) => {
                  const available = balance.totalQty - balance.reservedQty - balance.damagedQty;
                  return (
                    <li key={balance.id} className="flex items-center justify-between py-2 text-sm">
                      <Link
                        href={`/inventory/products/${balance.productId}`}
                        className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {balance.product.name}
                      </Link>
                      <span className="flex items-center gap-2 text-slate-500">
                        {available} / reorder {balance.product.reorderLevel}
                        <Badge variant={balance.totalQty <= 0 ? "danger" : "warning"}>
                          {balance.totalQty <= 0 ? "Out" : "Low"}
                        </Badge>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent stock movements</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentMovements.length === 0 ? (
              <EmptyState title="No movements yet" description="Stock in, out, and adjustments will show up here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentMovements.map((movement) => (
                  <li key={movement.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <Link
                        href={`/inventory/products/${movement.productId}`}
                        className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {movement.product.name}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {MOVEMENT_TYPE_LABELS[movement.type as MovementType] ?? movement.type} ·{" "}
                        {movement.user?.name ?? "-"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {movement.createdAt.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
