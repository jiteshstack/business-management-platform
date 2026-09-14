import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/current-session";
import { getInvoiceById } from "@/lib/energy/invoices/queries";
import { updateInvoiceAction } from "@/lib/energy/invoices/actions";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { InvoiceForm, type ClientOption } from "./invoice-form";
import type { ProductOption, LineItemRow } from "@/components/shared/line-items-editor";

export async function InvoiceEditView({ id }: { id: string }) {
  const session = await requireSession();
  const invoice = await getInvoiceById({ companyId: session.companyId, id });
  if (!invoice) notFound();

  if (invoice.status !== "DRAFT") {
    return (
      <div>
        <PageHeader title={`Edit ${invoice.invoiceNumber}`} />
        <EmptyState
          title="This invoice can't be edited"
          description="Only draft invoices can be edited directly."
          action={
            <Link href={`/sales/invoices/${id}`}>
              <Button size="sm">Back to invoice</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const [clients, products, users] = await Promise.all([
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
    prisma.user.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
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

  const itemRows: LineItemRow[] = invoice.items.map((item) => ({
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
      <PageHeader title={`Edit ${invoice.invoiceNumber}`} description="Update this draft invoice." />
      <InvoiceForm
        mode="edit"
        action={updateInvoiceAction.bind(null, id)}
        clients={clientOptions}
        products={productOptions}
        salespeople={users}
        cancelHref={`/sales/invoices/${id}`}
        defaults={{
          clientId: invoice.clientId,
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
          salespersonId: invoice.salespersonId,
          paymentTerms: invoice.paymentTerms,
          notes: invoice.notes,
          discountPercent: invoice.discountPercent,
          otherCharges: invoice.otherCharges,
          items: itemRows,
        }}
      />
    </div>
  );
}
