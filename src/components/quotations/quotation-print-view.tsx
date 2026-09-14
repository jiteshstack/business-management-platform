import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getQuotationById } from "@/lib/energy/quotations/queries";
import {
  QUOTATION_TYPE_LABELS,
  SOLAR_TYPES,
  DG_TYPES,
  type QuotationType,
} from "@/lib/energy/quotations/types";
import { PrintButton } from "@/components/shared/print-button";

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export async function QuotationPrintView({ id }: { id: string }) {
  const session = await requireSession();
  const quotation = await getQuotationById({ companyId: session.companyId, id });
  if (!quotation) notFound();

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });

  const type = quotation.type as QuotationType;
  const isTechnical = SOLAR_TYPES.includes(type) || DG_TYPES.includes(type);
  let technicalConfig: [string, string][] = [];
  if (isTechnical && quotation.technicalConfigJson) {
    try {
      const parsed = JSON.parse(quotation.technicalConfigJson) as Record<string, string>;
      technicalConfig = Object.entries(parsed).filter(([, v]) => v);
    } catch {
      technicalConfig = [];
    }
  }
  const itemDiscountTotal = quotation.items.reduce((sum, item) => sum + item.discountAmount, 0);

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
          <p className="text-lg font-semibold">QUOTATION</p>
          <p className="text-sm text-slate-600">{quotation.quotationNumber}</p>
          {quotation.revisionNumber > 0 ? (
            <p className="text-xs text-slate-400">Revision {quotation.revisionNumber}</p>
          ) : null}
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</p>
          <p className="font-medium">{quotation.client.name}</p>
          {quotation.client.businessName ? <p>{quotation.client.businessName}</p> : null}
          {quotation.client.gstin ? <p>GSTIN: {quotation.client.gstin}</p> : null}
          {quotation.client.mobile ? <p>{quotation.client.mobile}</p> : null}
          {quotation.siteAddressText ? (
            <p className="mt-2 text-slate-600">Site: {quotation.siteAddressText}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Quotation Details</p>
          <p>Date: {quotation.quotationDate.toLocaleDateString()}</p>
          {quotation.validUntil ? <p>Valid Until: {quotation.validUntil.toLocaleDateString()}</p> : null}
          <p>Type: {QUOTATION_TYPE_LABELS[type] ?? quotation.type}</p>
          {quotation.subject ? <p>Subject: {quotation.subject}</p> : null}
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
            {quotation.items.map((item) => (
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
              <td className="py-1 text-right">₹{quotation.subtotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">Item Discounts</td>
              <td className="py-1 text-right">-₹{itemDiscountTotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">Taxable Amount</td>
              <td className="py-1 text-right">₹{quotation.taxableAmount.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">GST / Tax</td>
              <td className="py-1 text-right">₹{quotation.taxAmount.toLocaleString("en-IN")}</td>
            </tr>
            {quotation.discountPercent ? (
              <tr>
                <td className="py-1 text-slate-500">Overall Discount ({quotation.discountPercent}%)</td>
                <td className="py-1 text-right">-₹{quotation.discountAmount.toLocaleString("en-IN")}</td>
              </tr>
            ) : null}
            <tr>
              <td className="py-1 text-slate-500">Other Charges</td>
              <td className="py-1 text-right">₹{quotation.otherCharges.toLocaleString("en-IN")}</td>
            </tr>
            <tr className="border-t border-slate-300">
              <td className="py-2 font-semibold">Grand Total</td>
              <td className="py-2 text-right font-semibold">₹{quotation.grandTotal.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {technicalConfig.length > 0 ? (
        <section className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Technical Configuration</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {technicalConfig.map(([key, value]) => (
              <p key={key}>
                <span className="text-slate-500">{labelize(key)}:</span> {value}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment & Warranty</p>
          {quotation.paymentTerms ? <p>Payment Terms: {quotation.paymentTerms}</p> : null}
          {quotation.equipmentWarranty ? <p>Equipment Warranty: {quotation.equipmentWarranty}</p> : null}
          {quotation.installationWarranty ? <p>Installation Warranty: {quotation.installationWarranty}</p> : null}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Delivery</p>
          {quotation.deliveryTimeline ? <p>Delivery: {quotation.deliveryTimeline}</p> : null}
          {quotation.installationTimeline ? <p>Installation: {quotation.installationTimeline}</p> : null}
        </div>
      </section>

      {quotation.termsAndConditions ? (
        <section className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Terms & Conditions</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{quotation.termsAndConditions}</p>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <p>For {company?.name ?? "the Company"}</p>
        <p className="mt-8">Authorized Signatory</p>
      </footer>
    </div>
  );
}
