import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getInvoiceById } from "@/lib/energy/invoices/queries";
import { PrintButton } from "@/components/shared/print-button";

export async function InvoicePrintView({ id }: { id: string }) {
  const session = await requireSession();
  const invoice = await getInvoiceById({ companyId: session.companyId, id });
  if (!invoice) notFound();

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });

  const itemDiscountTotal = invoice.items.reduce((sum, item) => sum + item.discountAmount, 0);

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-6 flex items-center justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      <header className="mb-8 flex items-start justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-xl font-bold">{company?.name ?? "Company"}</h1>
          <p className="mt-1 text-sm text-slate-500">Energy Solutions</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">TAX INVOICE</p>
          <p className="text-sm text-slate-600">{invoice.invoiceNumber}</p>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Bill To</p>
          <p className="font-medium">{invoice.client.name}</p>
          {invoice.client.businessName ? <p>{invoice.client.businessName}</p> : null}
          {invoice.client.gstin ? <p>GSTIN: {invoice.client.gstin}</p> : null}
          {invoice.client.mobile ? <p>{invoice.client.mobile}</p> : null}
          {invoice.billingAddressText ? <p className="mt-2 text-slate-600">{invoice.billingAddressText}</p> : null}
          {invoice.siteAddressText ? <p className="mt-2 text-slate-600">Site: {invoice.siteAddressText}</p> : null}
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice Details</p>
          <p>Date: {invoice.invoiceDate.toLocaleDateString()}</p>
          {invoice.dueDate ? <p>Due Date: {invoice.dueDate.toLocaleDateString()}</p> : null}
          {invoice.salesOrder ? <p>Sales Order: {invoice.salesOrder.soNumber}</p> : null}
        </div>
      </section>

      <section className="mb-8">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2">Item</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Unit</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Disc %</th>
              <th className="py-2 text-right">Tax %</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-2">
                  <p className="font-medium">{item.productName}</p>
                  {item.description ? <p className="text-xs text-slate-500">{item.description}</p> : null}
                </td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2">{item.unitLabel ?? "-"}</td>
                <td className="py-2 text-right">₹{item.unitPrice.toLocaleString("en-IN")}</td>
                <td className="py-2 text-right">{item.discountPercent ?? 0}%</td>
                <td className="py-2 text-right">{item.taxRate ?? 0}%</td>
                <td className="py-2 text-right font-medium">₹{item.lineTotal.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8 flex justify-end">
        <table className="w-64 text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-slate-500">Subtotal</td>
              <td className="py-1 text-right">₹{invoice.subtotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">Item Discounts</td>
              <td className="py-1 text-right">-₹{itemDiscountTotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">Taxable Amount</td>
              <td className="py-1 text-right">₹{invoice.taxableAmount.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">GST / Tax</td>
              <td className="py-1 text-right">₹{invoice.taxAmount.toLocaleString("en-IN")}</td>
            </tr>
            {invoice.discountPercent ? (
              <tr>
                <td className="py-1 text-slate-500">Overall Discount ({invoice.discountPercent}%)</td>
                <td className="py-1 text-right">-₹{invoice.discountAmount.toLocaleString("en-IN")}</td>
              </tr>
            ) : null}
            <tr>
              <td className="py-1 text-slate-500">Other Charges</td>
              <td className="py-1 text-right">₹{invoice.otherCharges.toLocaleString("en-IN")}</td>
            </tr>
            <tr className="border-t border-slate-300">
              <td className="py-2 font-semibold">Grand Total</td>
              <td className="py-2 text-right font-semibold">₹{invoice.grandTotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">Outstanding</td>
              <td className="py-1 text-right">₹{invoice.outstandingAmount.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {invoice.paymentTerms ? (
        <section className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment Terms</p>
          <p className="text-sm text-slate-700">{invoice.paymentTerms}</p>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <p>For {company?.name ?? "the Company"}</p>
        <p className="mt-8">Authorized Signatory</p>
      </footer>
    </div>
  );
}
