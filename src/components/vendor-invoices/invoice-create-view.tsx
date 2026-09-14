import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { createVendorInvoiceAction } from "@/lib/energy/vendor-invoices/actions";
import { PageHeader } from "@/components/shared/page-header";
import { VendorInvoiceForm, type VendorOption } from "./invoice-form";
import type { ProductOption } from "@/components/shared/line-items-editor";

export async function VendorInvoiceCreateView() {
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
      <PageHeader title="New Vendor Invoice" description="Record a standalone vendor invoice/bill." />
      <VendorInvoiceForm
        mode="create"
        action={createVendorInvoiceAction}
        vendors={vendorOptions}
        products={productOptions}
        cancelHref="/purchase/vendor-invoices"
      />
    </div>
  );
}
