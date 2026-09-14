import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getPurchaseOrderById } from "@/lib/energy/purchase-orders/queries";
import { PrintButton } from "@/components/shared/print-button";

export async function PurchaseOrderPrintView({ id }: { id: string }) {
  const session = await requireSession();
  const po = await getPurchaseOrderById({ companyId: session.companyId, id });
  if (!po) notFound();

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });
  const itemDiscountTotal = po.items.reduce((sum, item) => sum + item.discountAmount, 0);

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
          <p className="text-lg font-semibold">PURCHASE ORDER</p>
          <p className="text-sm text-slate-600">{po.poNumber}</p>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Vendor</p>
          <p className="font-medium">{po.vendor.name}</p>
          {po.vendor.businessName ? <p>{po.vendor.businessName}</p> : null}
          {po.vendor.gstin ? <p>GSTIN: {po.vendor.gstin}</p> : null}
          {po.vendor.mobile ? <p>{po.vendor.mobile}</p> : null}
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Order Details</p>
          <p>Date: {po.poDate.toLocaleDateString()}</p>
          {po.expectedDeliveryDate ? <p>Expected Delivery: {po.expectedDeliveryDate.toLocaleDateString()}</p> : null}
          {po.referenceNumber ? <p>Reference: {po.referenceNumber}</p> : null}
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
            {po.items.map((item) => (
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
              <td className="py-1 text-right">₹{po.subtotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">Item Discounts</td>
              <td className="py-1 text-right">-₹{itemDiscountTotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">Taxable Amount</td>
              <td className="py-1 text-right">₹{po.taxableAmount.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">GST / Tax</td>
              <td className="py-1 text-right">₹{po.taxAmount.toLocaleString("en-IN")}</td>
            </tr>
            {po.discountPercent ? (
              <tr>
                <td className="py-1 text-slate-500">Overall Discount ({po.discountPercent}%)</td>
                <td className="py-1 text-right">-₹{po.discountAmount.toLocaleString("en-IN")}</td>
              </tr>
            ) : null}
            <tr>
              <td className="py-1 text-slate-500">Other Charges</td>
              <td className="py-1 text-right">₹{po.otherCharges.toLocaleString("en-IN")}</td>
            </tr>
            <tr className="border-t border-slate-300">
              <td className="py-2 font-semibold">Grand Total</td>
              <td className="py-2 text-right font-semibold">₹{po.grandTotal.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {po.termsAndConditions ? (
        <section className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Terms & Conditions</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{po.termsAndConditions}</p>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <p>For {company?.name ?? "the Company"}</p>
        <p className="mt-8">Authorized Signatory</p>
      </footer>
    </div>
  );
}
