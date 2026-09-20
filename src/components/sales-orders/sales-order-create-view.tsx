import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createSalesOrderAction } from "@/lib/energy/sales-orders/actions";
import { PageHeader } from "@/components/shared/page-header";
import { SalesOrderForm, type ClientOption } from "./sales-order-form";
import type { ProductOption } from "@/components/shared/line-items-editor";

export async function SalesOrderCreateView() {
  const session = await requireSession();

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

  return (
    <div>
      <PageHeader title="New Sales Order" description="Create a standalone energy solutions sales order." />
      <SalesOrderForm
        mode="create"
        action={createSalesOrderAction}
        clients={clientOptions}
        products={productOptions}
        cancelHref="/sales/sales-orders"
      />
    </div>
  );
}
