import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/current-session";
import { getVendorInvoiceById } from "@/lib/energy/vendor-invoices/queries";
import { updateVendorInvoiceAction } from "@/lib/energy/vendor-invoices/actions";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { VendorInvoiceForm, type VendorOption } from "./invoice-form";
import type { ProductOption, LineItemRow } from "@/components/shared/line-items-editor";

export async function VendorInvoiceEditView({ id }: { id: string }) {
  const session = await requireSession();
  const invoice = await getVendorInvoiceById({ companyId: session.companyId, id });
  if (!invoice) notFound();

  if (invoice.status !== "DRAFT") {
    return (
      <div>
        <PageHeader title={`Edit ${invoice.invoiceNumber}`} />
        <EmptyState
          title="This vendor invoice can't be edited"
          description="Only draft vendor invoices can be edited directly."
          action={
            <Link href={`/purchase/vendor-invoices/${id}`}>
              <Button size="sm">Back to invoice</Button>
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
      <PageHeader title={`Edit ${invoice.invoiceNumber}`} description="Update this draft vendor invoice." />
      <VendorInvoiceForm
        mode="edit"
        action={updateVendorInvoiceAction.bind(null, id)}
        vendors={vendorOptions}
        products={productOptions}
        cancelHref={`/purchase/vendor-invoices/${id}`}
        defaults={{
          vendorId: invoice.vendorId,
          vendorInvoiceNumber: invoice.vendorInvoiceNumber,
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
          notes: invoice.notes,
          discountPercent: invoice.discountPercent,
          otherCharges: invoice.otherCharges,
          items: itemRows,
        }}
      />
    </div>
  );
}
