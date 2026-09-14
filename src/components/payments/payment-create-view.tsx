import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { listAllocatableInvoicesForClient } from "@/lib/energy/payments/queries";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentForm, type ClientOption, type PresetInvoice } from "./payment-form";

export async function PaymentCreateView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const invoiceIdParam = typeof params.invoiceId === "string" ? params.invoiceId : undefined;

  let presetInvoice: PresetInvoice | undefined;
  if (invoiceIdParam) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceIdParam, companyId: session.companyId },
      include: { client: true },
    });
    if (!invoice) notFound();
    if (invoice.outstandingAmount <= 0) {
      // Nothing left to collect — send the user back rather than showing a
      // payment form that can never validate.
      notFound();
    }
    presetInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      outstandingAmount: invoice.outstandingAmount,
      clientId: invoice.clientId,
      clientName: invoice.client.name,
    };
  }

  let clientOptions: ClientOption[] = [];
  if (!presetInvoice) {
    const clients = await prisma.party.findMany({
      where: { companyId: session.companyId, type: "CLIENT", isActive: true },
      orderBy: { name: "asc" },
    });
    clientOptions = await Promise.all(
      clients.map(async (c) => {
        const invoices = await listAllocatableInvoicesForClient({ companyId: session.companyId, clientId: c.id });
        return {
          id: c.id,
          name: c.name,
          invoices: invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, outstandingAmount: i.outstandingAmount })),
        };
      })
    );
  }

  return (
    <div>
      <PageHeader title="Record Payment" description="Record a customer payment, with or without an invoice." />
      <PaymentForm clients={clientOptions} presetInvoice={presetInvoice} cancelHref="/sales/payments-received" />
    </div>
  );
}
