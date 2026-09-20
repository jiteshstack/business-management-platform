import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/current-session";
import { getSalesOrderById } from "@/lib/energy/sales-orders/queries";
import { updateSalesOrderAction } from "@/lib/energy/sales-orders/actions";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { SalesOrderForm, type ClientOption } from "./sales-order-form";
import type { ProductOption, LineItemRow } from "@/components/shared/line-items-editor";

export async function SalesOrderEditView({ id }: { id: string }) {
  const session = await requireSession();
  const salesOrder = await getSalesOrderById({ companyId: session.companyId, id });
  if (!salesOrder) notFound();

  if (salesOrder.status !== "DRAFT") {
    return (
      <div>
        <PageHeader title={`Edit ${salesOrder.soNumber}`} />
        <EmptyState
          title="This sales order can't be edited"
          description="Only draft sales orders can be edited directly."
          action={
            <Link href={`/sales/sales-orders/${id}`}>
              <Button size="sm">Back to sales order</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const [clients, sites, products] = await Promise.all([
    prisma.party.findMany({
      where: { companyId: session.companyId, type: "CLIENT", isActive: true },
      orderBy: { name: "asc" },
      include: { addresses: { where: { type: "SITE" } } },
    }),
    prisma.projectSite.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true, customerId: true },
    }),
    prisma.product.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: "asc" },
      include: { unit: true },
    }),
  ]);

  const clientOptions: ClientOption[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    sites: sites.filter((s) => s.customerId === c.id).map((s) => ({ id: s.id, name: s.name, city: s.city })),
    addresses: c.addresses.map((a) => ({ id: a.id, label: a.label, line1: a.line1, city: a.city })),
  }));

  const productOptions: ProductOption[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    unitName: p.unit?.name ?? null,
    sellingPrice: p.sellingPrice,
    taxRate: p.taxRate,
  }));

  const itemRows: LineItemRow[] = salesOrder.items.map((item) => ({
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
      <PageHeader title={`Edit ${salesOrder.soNumber}`} description="Update this draft sales order." />
      <SalesOrderForm
        mode="edit"
        action={updateSalesOrderAction.bind(null, id)}
        clients={clientOptions}
        products={productOptions}
        cancelHref={`/sales/sales-orders/${id}`}
        defaults={{
          clientId: salesOrder.clientId,
          siteSelection: salesOrder.siteId
            ? `site:${salesOrder.siteId}`
            : salesOrder.siteAddressId
              ? `address:${salesOrder.siteAddressId}`
              : null,
          orderDate: salesOrder.orderDate.toISOString().slice(0, 10),
          expectedDeliveryDate: salesOrder.expectedDeliveryDate
            ? salesOrder.expectedDeliveryDate.toISOString().slice(0, 10)
            : null,
          paymentTerms: salesOrder.paymentTerms,
          notes: salesOrder.notes,
          discountPercent: salesOrder.discountPercent,
          otherCharges: salesOrder.otherCharges,
          items: itemRows,
        }}
      />
    </div>
  );
}
