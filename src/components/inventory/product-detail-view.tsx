import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { getProductById, listStockMovements, listSerialNumbers, getDefaultLocation } from "@/lib/energy/inventory/queries";
import { canManageInventory } from "@/lib/core/permissions";
import {
  isProductDetailTabKey,
  IMPLEMENTED_PRODUCT_TABS,
  PRODUCT_DETAIL_TABS,
  PRODUCT_TYPE_LABELS,
  type ProductDetailTabKey,
  type ProductType,
} from "@/lib/energy/inventory/types";
import {
  stockInAction,
  openingStockAction,
  stockOutAction,
  adjustStockAction,
  damageStockAction,
  returnStockAction,
  reserveStockAction,
  releaseReservationAction,
  setProductActiveAction,
  updateSerialStatusAction,
} from "@/lib/energy/inventory/actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductTabs } from "./product-tabs";
import { InventoryTab } from "./inventory-tab";
import { MovementsSection } from "./movements-section";
import { SerialsSection } from "./serials-section";

const TAB_LABELS = Object.fromEntries(PRODUCT_DETAIL_TABS.map((t) => [t.key, t.label]));

export async function ProductDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const product = await getProductById({ companyId: session.companyId, id });
  if (!product) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: ProductDetailTabKey = isProductDetailTabKey(rawTab) ? rawTab : "overview";
  const canManage = canManageInventory(session.role);

  const defaultLocation = await getDefaultLocation(session.companyId);
  const balance = product.balances.find((b) => b.locationId === defaultLocation.id);
  const totalQty = balance?.totalQty ?? 0;
  const reservedQty = balance?.reservedQty ?? 0;
  const damagedQty = balance?.damagedQty ?? 0;

  const movements = tab === "movements" ? await listStockMovements({ companyId: session.companyId, productId: id }) : [];
  const serials =
    tab === "serials" ? await listSerialNumbers({ companyId: session.companyId, productId: id }) : [];

  return (
    <div>
      <PageHeader
        title={product.name}
        description={`${product.code} · ${PRODUCT_TYPE_LABELS[product.type as ProductType] ?? product.type}`}
        actions={
          <>
            <Badge variant={product.isActive ? "success" : "neutral"}>
              {product.isActive ? "Active" : "Inactive"}
            </Badge>
            <form action={setProductActiveAction.bind(null, id, !product.isActive)}>
              <Button type="submit" variant="secondary" size="sm">
                {product.isActive ? "Deactivate" : "Activate"}
              </Button>
            </form>
            <Link href={`/inventory/products/${id}/edit`}>
              <Button size="sm">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <ProductTabs basePath={`/inventory/products/${id}`} active={tab} />

      {tab === "overview" ? <OverviewTab product={product} /> : null}

      {tab === "inventory" ? (
        product.stockTracked ? (
          <InventoryTab
            totalQty={totalQty}
            reservedQty={reservedQty}
            damagedQty={damagedQty}
            reorderLevel={product.reorderLevel}
            unitLabel={product.unit?.name ?? "units"}
            canManage={canManage}
            resetKey={movements.length + totalQty + reservedQty + damagedQty}
            actions={{
              stockIn: stockInAction.bind(null, id),
              openingStock: openingStockAction.bind(null, id),
              stockOut: stockOutAction.bind(null, id),
              adjust: adjustStockAction.bind(null, id),
              damage: damageStockAction.bind(null, id),
              returnStock: returnStockAction.bind(null, id),
              reserve: reserveStockAction.bind(null, id),
              release: releaseReservationAction.bind(null, id),
            }}
          />
        ) : (
          <EmptyState
            title="Stock tracking is off"
            description="This is a service product and does not maintain physical stock."
          />
        )
      ) : null}

      {tab === "movements" ? <MovementsSection movements={movements} /> : null}

      {tab === "serials" ? (
        product.serialTracked ? (
          <SerialsSection serials={serials} canManage={canManage} updateStatusAction={updateSerialStatusAction} />
        ) : (
          <EmptyState
            title="Serial tracking is off"
            description="Enable serial tracking on this product to record individual serial numbers."
          />
        )
      ) : null}

      {tab === "vendors" ? <VendorsTab product={product} /> : null}

      {!IMPLEMENTED_PRODUCT_TABS.includes(tab) ? (
        <EmptyState
          title="Not built yet"
          description={`${TAB_LABELS[tab]} will show up here once that module is implemented.`}
        />
      ) : null}
    </div>
  );
}

function OverviewTab({
  product,
}: {
  product: NonNullable<Awaited<ReturnType<typeof getProductById>>>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <OverviewField label="Category" value={product.category?.name} />
          <OverviewField label="Brand" value={product.brand?.name} />
          <OverviewField label="Model" value={product.model} />
          <OverviewField label="Unit" value={product.unit?.name} />
          <OverviewField
            label="Purchase Price"
            value={product.purchasePrice != null ? `₹${product.purchasePrice.toLocaleString("en-IN")}` : undefined}
          />
          <OverviewField
            label="Selling Price"
            value={product.sellingPrice != null ? `₹${product.sellingPrice.toLocaleString("en-IN")}` : undefined}
          />
          <OverviewField label="Tax / GST Rate" value={product.taxRate != null ? `${product.taxRate}%` : undefined} />
          <OverviewField
            label="Warranty"
            value={product.warrantyMonths != null ? `${product.warrantyMonths} month(s)` : undefined}
          />
          <OverviewField label="Serial Tracking" value={product.serialTracked ? "Enabled" : "Disabled"} />
          <OverviewField label="Stock Tracking" value={product.stockTracked ? "Enabled" : "Disabled"} />
          <OverviewField label="Reorder Level" value={product.reorderLevel != null ? String(product.reorderLevel) : undefined} />
          <OverviewField label="Added on" value={product.createdAt.toLocaleDateString()} />
          {product.description ? (
            <div className="sm:col-span-2">
              <OverviewField label="Description" value={product.description} />
            </div>
          ) : null}
          {product.specifications ? (
            <div className="sm:col-span-2">
              <OverviewField label="Specifications" value={product.specifications} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function VendorsTab({
  product,
}: {
  product: NonNullable<Awaited<ReturnType<typeof getProductById>>>;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Default vendor</p>
        {product.defaultVendor ? (
          <div className="text-sm">
            <Link
              href={`/parties/vendors/${product.defaultVendor.id}`}
              className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
            >
              {product.defaultVendor.name}
            </Link>
            <p className="text-slate-500">
              {[product.defaultVendor.mobile, product.defaultVendor.email].filter(Boolean).join(" · ")}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No default vendor set.</p>
        )}
        <p className="mt-4 text-xs text-slate-400">
          Additional vendor-product associations (e.g. from purchase history) will appear here once the
          Purchase module is implemented.
        </p>
      </CardContent>
    </Card>
  );
}

function OverviewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">
        {value || <span className="text-slate-400">-</span>}
      </p>
    </div>
  );
}
