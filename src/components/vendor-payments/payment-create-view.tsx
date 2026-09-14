import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { listAllocatableVendorInvoicesForVendor } from "@/lib/energy/vendor-payments/queries";
import { PageHeader } from "@/components/shared/page-header";
import { VendorPaymentForm, type VendorOption, type PresetVendorInvoice } from "./payment-form";

export async function VendorPaymentCreateView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const invoiceIdParam = typeof params.vendorInvoiceId === "string" ? params.vendorInvoiceId : undefined;

  let presetInvoice: PresetVendorInvoice | undefined;
  if (invoiceIdParam) {
    const invoice = await prisma.vendorInvoice.findFirst({
      where: { id: invoiceIdParam, companyId: session.companyId },
      include: { vendor: true },
    });
    if (!invoice) notFound();
    if (invoice.outstandingAmount <= 0) {
      notFound();
    }
    presetInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      outstandingAmount: invoice.outstandingAmount,
      vendorId: invoice.vendorId,
      vendorName: invoice.vendor.name,
    };
  }

  let vendorOptions: VendorOption[] = [];
  if (!presetInvoice) {
    const vendors = await prisma.party.findMany({
      where: { companyId: session.companyId, type: "VENDOR", isActive: true },
      orderBy: { name: "asc" },
    });
    vendorOptions = await Promise.all(
      vendors.map(async (v) => {
        const invoices = await listAllocatableVendorInvoicesForVendor({ companyId: session.companyId, vendorId: v.id });
        return {
          id: v.id,
          name: v.name,
          invoices: invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, outstandingAmount: i.outstandingAmount })),
        };
      })
    );
  }

  return (
    <div>
      <PageHeader title="Record Vendor Payment" description="Record a payment to a vendor, with or without an invoice." />
      <VendorPaymentForm vendors={vendorOptions} presetInvoice={presetInvoice} cancelHref="/purchase/payments-made" />
    </div>
  );
}
