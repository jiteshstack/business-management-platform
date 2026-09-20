import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createInvoiceAction } from "@/lib/energy/invoices/actions";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceForm, type ClientOption } from "./invoice-form";
import type { ProductOption } from "@/components/shared/line-items-editor";

export async function InvoiceCreateView() {
  const session = await requireSession();

  const [clients, products] = await Promise.all([
    prisma.party.findMany({
      where: { companyId: session.companyId, type: "CLIENT", isActive: true },
      orderBy: { name: "asc" },
      include: { addresses: true },
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
    siteAddresses: c.addresses.filter((a) => a.type === "SITE").map((a) => ({ id: a.id, label: a.label, line1: a.line1, city: a.city })),
    billingAddresses: c.addresses
      .filter((a) => a.type === "BILLING")
      .map((a) => ({ id: a.id, label: a.label, line1: a.line1, city: a.city })),
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
      <PageHeader title="New Invoice" description="Create a standalone energy solutions invoice." />
      <InvoiceForm
        mode="create"
        action={createInvoiceAction}
        clients={clientOptions}
        products={productOptions}
        cancelHref="/sales/invoices"
      />
    </div>
  );
}
