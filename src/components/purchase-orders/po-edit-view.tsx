import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/current-session";
import { getPurchaseOrderById } from "@/lib/energy/purchase-orders/queries";
import { updatePurchaseOrderAction } from "@/lib/energy/purchase-orders/actions";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { PurchaseOrderForm, type VendorOption } from "./po-form";
import type { ProductOption, LineItemRow } from "@/components/shared/line-items-editor";

export async function PurchaseOrderEditView({ id }: { id: string }) {
  const session = await requireSession();
  const po = await getPurchaseOrderById({ companyId: session.companyId, id });
  if (!po) notFound();

  if (po.status !== "DRAFT") {
    return (
      <div>
        <PageHeader title={`Edit ${po.poNumber}`} />
        <EmptyState
          title="This purchase order can't be edited"
          description="Only draft purchase orders can be edited directly."
          action={
            <Link href={`/purchase/purchase-orders/${id}`}>
              <Button size="sm">Back to purchase order</Button>
            </Link>
          }
        />
      </div>
    );
  }

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

  const productOptions: ProductOption[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    unitName: p.unit?.name ?? null,
    sellingPrice: p.purchasePrice,
    taxRate: p.taxRate,
  }));

  const itemRows: LineItemRow[] = po.items.map((item) => ({
    key: item.id,
    productId: item.productId ?? "",
    description: item.description ?? "",
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    discountPercent: item.discountPercent != null ? String(item.discountPercent) : "",
    taxRate: item.taxRate != null ? String(item.taxRate) : "",
  }));

  return (
    <div>
      <PageHeader title={`Edit ${po.poNumber}`} description="Update this draft purchase order." />
      <PurchaseOrderForm
        mode="edit"
        action={updatePurchaseOrderAction.bind(null, id)}
        vendors={vendorOptions}
        products={productOptions}
        cancelHref={`/purchase/purchase-orders/${id}`}
        defaults={{
          vendorId: po.vendorId,
          poDate: po.poDate.toISOString().slice(0, 10),
          expectedDeliveryDate: po.expectedDeliveryDate ? po.expectedDeliveryDate.toISOString().slice(0, 10) : null,
          referenceNumber: po.referenceNumber,
          notes: po.notes,
          termsAndConditions: po.termsAndConditions,
          discountPercent: po.discountPercent,
          otherCharges: po.otherCharges,
          items: itemRows,
        }}
      />
    </div>
  );
}
