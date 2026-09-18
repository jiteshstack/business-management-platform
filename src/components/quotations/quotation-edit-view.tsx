import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/current-session";
import { getQuotationById } from "@/lib/energy/quotations/queries";
import { updateQuotationAction } from "@/lib/energy/quotations/actions";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { QuotationForm, type ClientOption } from "./quotation-form";
import { parseProposalContent } from "@/lib/energy/quotations/proposal-content";
import type { ProductOption } from "@/components/shared/line-items-editor";
import type { LineItemRow } from "@/components/shared/line-items-editor";

export async function QuotationEditView({ id }: { id: string }) {
  const session = await requireSession();
  const quotation = await getQuotationById({ companyId: session.companyId, id });
  if (!quotation) notFound();

  if (quotation.status !== "DRAFT") {
    return (
      <div>
        <PageHeader title={`Edit ${quotation.quotationNumber}`} />
        <EmptyState
          title="This quotation can't be edited"
          description={`Only draft quotations can be edited directly. Create a revision from the detail page instead.`}
          action={
            <Link href={`/sales/quotations/${id}`}>
              <Button size="sm">Back to quotation</Button>
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
      include: { addresses: { where: { type: "SITE" } } },
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

  const itemRows: LineItemRow[] = quotation.items.map((item) => ({
    key: item.id,
    productId: item.productId ?? "",
    description: item.description ?? "",
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    discountPercent: item.discountPercent != null ? String(item.discountPercent) : "",
    taxRate: item.taxRate != null ? String(item.taxRate) : "",
  }));

  let technicalConfig: Record<string, string> | undefined;
  if (quotation.technicalConfigJson) {
    try {
      technicalConfig = JSON.parse(quotation.technicalConfigJson);
    } catch {
      technicalConfig = undefined;
    }
  }

  return (
    <div>
      <PageHeader title={`Edit ${quotation.quotationNumber}`} description="Update this draft quotation." />
      <QuotationForm
        mode="edit"
        action={updateQuotationAction.bind(null, id)}
        clients={clientOptions}
        products={productOptions}
        salespeople={users}
        cancelHref={`/sales/quotations/${id}`}
        defaults={{
          clientId: quotation.clientId,
          siteAddressId: quotation.siteAddressId,
          type: quotation.type,
          quotationDate: quotation.quotationDate.toISOString().slice(0, 10),
          validUntil: quotation.validUntil ? quotation.validUntil.toISOString().slice(0, 10) : null,
          salespersonId: quotation.salespersonId,
          reference: quotation.reference,
          subject: quotation.subject,
          notes: quotation.notes,
          paymentTerms: quotation.paymentTerms,
          equipmentWarranty: quotation.equipmentWarranty,
          installationWarranty: quotation.installationWarranty,
          deliveryTimeline: quotation.deliveryTimeline,
          installationTimeline: quotation.installationTimeline,
          termsAndConditions: quotation.termsAndConditions,
          discountPercent: quotation.discountPercent,
          otherCharges: quotation.otherCharges,
          technicalConfig,
          proposalContent: parseProposalContent(quotation.proposalContentJson),
          items: itemRows,
        }}
      />
    </div>
  );
}
