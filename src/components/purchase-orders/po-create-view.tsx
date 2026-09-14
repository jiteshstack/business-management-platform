import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createPurchaseOrderAction } from "@/lib/energy/purchase-orders/actions";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseOrderForm, type VendorOption } from "./po-form";
import type { ProductOption } from "@/components/shared/line-items-editor";

export async function PurchaseOrderCreateView() {
  const session = await requireSession();

  const [vendors, products] = await Promise.all([
    prisma.party.findMany({
      where: { companyId: session.companyId, type: "VENDOR", isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: "asc" },
      include: { unit: true },
    }),
  ]);

  const vendorOptions: VendorOption[] = vendors.map((v) => ({ id: v.id, name: v.name }));

  // LineItemsEditor prefills a row's rate from ProductOption.sellingPrice —
  // for a *purchase* order that should be the product's purchase price, so
  // purchasePrice is passed through that same slot rather than duplicating
  // the shared line-items editor for a one-field difference.
  const productOptions: ProductOption[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    unitName: p.unit?.name ?? null,
    sellingPrice: p.purchasePrice,
    taxRate: p.taxRate,
  }));

  return (
    <div>
      <PageHeader title="New Purchase Order" description="Create a purchase order for a vendor." />
      <PurchaseOrderForm
        mode="create"
        action={createPurchaseOrderAction}
        vendors={vendorOptions}
        products={productOptions}
        cancelHref="/purchase/purchase-orders"
      />
    </div>
  );
}
