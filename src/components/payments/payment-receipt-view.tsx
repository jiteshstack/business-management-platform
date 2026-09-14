import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getPaymentById } from "@/lib/energy/payments/queries";
import { PAYMENT_MODE_LABELS } from "@/lib/energy/payments/types";
import { PrintButton } from "@/components/shared/print-button";

export async function PaymentReceiptView({ id }: { id: string }) {
  const session = await requireSession();
  const payment = await getPaymentById({ companyId: session.companyId, id });
  if (!payment) notFound();

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-6 flex items-center justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      <header className="mb-8 flex items-start justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-xl font-bold">{company?.name ?? "Company"}</h1>
          <p className="mt-1 text-sm text-slate-500">Energy Solutions</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">PAYMENT RECEIPT</p>
          <p className="text-sm text-slate-600">{payment.paymentNumber}</p>
          {payment.status === "CANCELLED" ? <p className="text-xs font-semibold text-red-600">CANCELLED</p> : null}
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Received From</p>
          <p className="font-medium">{payment.client.name}</p>
          {payment.client.businessName ? <p>{payment.client.businessName}</p> : null}
          {payment.client.gstin ? <p>GSTIN: {payment.client.gstin}</p> : null}
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment Details</p>
          <p>Date: {payment.paymentDate.toLocaleDateString()}</p>
          <p>Mode: {PAYMENT_MODE_LABELS[payment.mode as keyof typeof PAYMENT_MODE_LABELS] ?? payment.mode}</p>
          {payment.referenceNumber ? <p>Reference: {payment.referenceNumber}</p> : null}
          {payment.mode === "CHEQUE" && payment.chequeNumber ? <p>Cheque No: {payment.chequeNumber}</p> : null}
        </div>
      </section>

      <section className="mb-8 flex justify-end">
        <table className="w-72 text-sm">
          <tbody>
            <tr className="border-t border-slate-300">
              <td className="py-2 font-semibold">Amount Received</td>
              <td className="py-2 text-right font-semibold">₹{payment.amount.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Allocated Invoices</p>
        {payment.allocations.length === 0 ? (
          <p className="text-sm text-slate-500">This payment has not been allocated to any invoice.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Invoice</th>
                <th className="py-2 text-right">Amount Applied</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((alloc) => (
                <tr key={alloc.id} className="border-b border-slate-100">
                  <td className="py-2">{alloc.invoice.invoiceNumber}</td>
                  <td className="py-2 text-right">₹{alloc.amount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {payment.notes ? (
        <section className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{payment.notes}</p>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <p>For {company?.name ?? "the Company"}</p>
        <p className="mt-8">Authorized Signatory</p>
      </footer>
    </div>
  );
}
