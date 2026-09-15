import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getInvoiceById } from "@/lib/energy/invoices/queries";
import { amountInWords } from "@/lib/energy/shared/amount-in-words";
import { PrintButton } from "@/components/shared/print-button";

type InvoiceWithRelations = NonNullable<Awaited<ReturnType<typeof getInvoiceById>>>;
type InvoiceItem = InvoiceWithRelations["items"][number];

function formatCompanyAddress(company: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  pincode: string | null;
}): string[] {
  return [company.addressLine1, company.addressLine2, [company.city, company.pincode].filter(Boolean).join(" - ")].filter(
    (line): line is string => Boolean(line)
  );
}

function normalizeState(state: string | null | undefined): string {
  return (state ?? "").trim().toLowerCase();
}

type TaxSplit = { label: "CGST" | "IGST"; rate: number; amount: number; label2?: "SGST"; rate2?: number; amount2?: number };

// Same-state sale -> CGST + SGST (split evenly); different-state -> IGST.
// When either party's state isn't on file yet, this defaults to CGST/SGST
// (the common case for a single-state business) rather than guessing IGST.
function splitTax(taxRate: number, taxAmount: number, sameState: boolean): TaxSplit {
  if (!sameState) {
    return { label: "IGST", rate: taxRate, amount: taxAmount };
  }
  return {
    label: "CGST",
    rate: taxRate / 2,
    amount: taxAmount / 2,
    label2: "SGST",
    rate2: taxRate / 2,
    amount2: taxAmount / 2,
  };
}

export async function InvoicePrintView({ id }: { id: string }) {
  const session = await requireSession();
  const invoice = await getInvoiceById({ companyId: session.companyId, id });
  if (!invoice) notFound();

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });

  const sameState =
    !company?.state || !invoice.client.state || normalizeState(company.state) === normalizeState(invoice.client.state);

  const companyAddressLines = company ? formatCompanyAddress(company) : [];

  const itemsTaxableTotal = invoice.items.reduce((sum, item) => sum + (item.lineSubtotal - item.discountAmount), 0);
  const itemsTaxTotal = invoice.items.reduce((sum, item) => sum + item.taxAmount, 0);
  const totalQty = invoice.items.reduce((sum, item) => sum + item.quantity, 0);

  // HSN/SAC summary — grouped by (hsnCode, taxRate), as GST invoices require.
  const hsnGroups = new Map<string, { hsnCode: string; taxRate: number; taxableValue: number; taxAmount: number }>();
  for (const item of invoice.items) {
    const hsnCode = item.product?.hsnCode ?? "";
    const taxRate = item.taxRate ?? 0;
    const key = `${hsnCode}|${taxRate}`;
    const taxableValue = item.lineSubtotal - item.discountAmount;
    const existing = hsnGroups.get(key);
    if (existing) {
      existing.taxableValue += taxableValue;
      existing.taxAmount += item.taxAmount;
    } else {
      hsnGroups.set(key, { hsnCode, taxRate, taxableValue, taxAmount: item.taxAmount });
    }
  }
  const hsnRows = Array.from(hsnGroups.values());

  // Tax summary rows shown under the item table — grouped by rate (not HSN),
  // since that's what determines a distinct CGST/SGST or IGST line on a real
  // GST invoice; a mix of e.g. 12% and 18% items needs two separate rows,
  // not one blended rate.
  const rateGroups = new Map<number, number>();
  for (const item of invoice.items) {
    const rate = item.taxRate ?? 0;
    rateGroups.set(rate, (rateGroups.get(rate) ?? 0) + item.taxAmount);
  }
  const taxSummaryRows = Array.from(rateGroups.entries())
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => a - b)
    .map(([rate, amount]) => splitTax(rate, amount, sameState));

  const hasBankDetails = Boolean(
    company?.bankAccountName || company?.bankName || company?.bankAccountNumber || company?.bankIfsc
  );

  return (
    <div className="mx-auto max-w-4xl bg-white p-4 text-[13px] text-slate-900 print:p-0">
      <div className="mb-3 flex items-center justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      <div className="border border-slate-900">
        <p className="border-b border-slate-900 py-1 text-center text-base font-bold tracking-wide">TAX INVOICE</p>

        {/* Seller details + invoice metadata */}
        <div className="grid grid-cols-2">
          <div className="border-b border-r border-slate-900 p-2">
            <p className="font-bold">{company?.name ?? "Company"}</p>
            {companyAddressLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {company?.gstin ? <p>GSTIN/UIN: {company.gstin}</p> : null}
            {company?.state ? <p>State Name: {company.state}</p> : null}
            {company?.email ? <p>E-Mail: {company.email}</p> : null}
            {company?.phone ? <p>Phone: {company.phone}</p> : null}
          </div>
          <div className="grid grid-cols-2 border-b border-slate-900 text-xs">
            <MetaCell label="Invoice No." value={invoice.invoiceNumber} />
            <MetaCell label="Dated" value={invoice.invoiceDate.toLocaleDateString("en-IN")} />
            <MetaCell label="Sales Order" value={invoice.salesOrder?.soNumber ?? "-"} />
            <MetaCell label="Due Date" value={invoice.dueDate ? invoice.dueDate.toLocaleDateString("en-IN") : "-"} />
            <MetaCell label="Payment Terms" value={invoice.paymentTerms ?? "-"} last />
          </div>
        </div>

        {/* Consignee / Buyer */}
        <div className="grid grid-cols-2">
          <div className="border-b border-r border-slate-900 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Consignee (Ship to)</p>
            <PartyBlock name={invoice.client.businessName || invoice.client.name} addressText={invoice.siteAddressText ?? invoice.billingAddressText} gstin={invoice.client.gstin} pan={invoice.client.pan} state={invoice.client.state} />
          </div>
          <div className="border-b border-slate-900 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Buyer (Bill to)</p>
            <PartyBlock name={invoice.client.businessName || invoice.client.name} addressText={invoice.billingAddressText} gstin={invoice.client.gstin} pan={invoice.client.pan} state={invoice.client.state} />
          </div>
        </div>

        {/* Line items */}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-900 text-left">
              <th className="w-8 border-r border-slate-900 px-2 py-1">Sl No.</th>
              <th className="border-r border-slate-900 px-2 py-1">Description of Goods / Services</th>
              <th className="w-20 border-r border-slate-900 px-2 py-1">HSN/SAC</th>
              <th className="w-20 border-r border-slate-900 px-2 py-1">Quantity</th>
              <th className="w-20 border-r border-slate-900 px-2 py-1 text-right">Rate</th>
              <th className="w-14 border-r border-slate-900 px-2 py-1">per</th>
              <th className="w-28 px-2 py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item: InvoiceItem, index) => (
              <tr key={item.id} className="align-top">
                <td className="border-r border-slate-900 px-2 py-1">{index + 1}</td>
                <td className="border-r border-slate-900 px-2 py-1">
                  <p className="font-semibold">
                    {item.productCode ? `${item.productCode} - ` : ""}
                    {item.productName}
                  </p>
                  {item.description ? <p className="text-slate-600">{item.description}</p> : null}
                </td>
                <td className="border-r border-slate-900 px-2 py-1">{item.product?.hsnCode ?? "-"}</td>
                <td className="border-r border-slate-900 px-2 py-1">
                  {item.quantity} {item.unitLabel ?? ""}
                </td>
                <td className="border-r border-slate-900 px-2 py-1 text-right">
                  {item.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="border-r border-slate-900 px-2 py-1">{item.unitLabel ?? "-"}</td>
                <td className="px-2 py-1 text-right">
                  {(item.lineSubtotal - item.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}

            {(() => {
              return (
                <>
                  {taxSummaryRows.map((split, i) => (
                    <Fragment key={`${split.label}-${i}`}>
                      <tr>
                        <td colSpan={6} className="border-r border-slate-900 px-2 py-1 text-right italic text-slate-600">
                          {split.label} ({split.rate.toFixed(1)}%)
                        </td>
                        <td className="px-2 py-1 text-right">
                          {split.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {split.label2 ? (
                        <tr>
                          <td colSpan={6} className="border-r border-slate-900 px-2 py-1 text-right italic text-slate-600">
                            {split.label2} ({(split.rate2 ?? 0).toFixed(1)}%)
                          </td>
                          <td className="px-2 py-1 text-right">
                            {(split.amount2 ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                  {invoice.discountAmount ? (
                    <tr>
                      <td colSpan={6} className="border-r border-slate-900 px-2 py-1 text-right italic text-slate-600">
                        Discount {invoice.discountPercent ? `(${invoice.discountPercent}%)` : ""}
                      </td>
                      <td className="px-2 py-1 text-right">
                        -{invoice.discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ) : null}
                  {invoice.otherCharges ? (
                    <tr>
                      <td colSpan={6} className="border-r border-slate-900 px-2 py-1 text-right italic text-slate-600">
                        Other Charges
                      </td>
                      <td className="px-2 py-1 text-right">
                        {invoice.otherCharges.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })()}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-900 font-semibold">
              <td colSpan={3} className="border-r border-slate-900 px-2 py-1">
                Total
              </td>
              <td className="border-r border-slate-900 px-2 py-1">{totalQty}</td>
              <td className="border-r border-slate-900 px-2 py-1" colSpan={2} />
              <td className="px-2 py-1 text-right">
                Rs. {invoice.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="border-t border-slate-900 px-2 py-1 text-xs">
          <p>
            <span className="font-semibold">Amount Chargeable (in words): </span>
            INR {amountInWords(invoice.grandTotal)}
          </p>
        </div>

        {/* HSN/SAC tax summary */}
        <table className="w-full border-collapse border-t border-slate-900 text-xs">
          <thead>
            <tr className="border-b border-slate-900 text-left">
              <th className="border-r border-slate-900 px-2 py-1">HSN/SAC</th>
              <th className="border-r border-slate-900 px-2 py-1 text-right">Taxable Value</th>
              {sameState ? (
                <>
                  <th className="border-r border-slate-900 px-2 py-1 text-right" colSpan={2}>
                    CGST
                  </th>
                  <th className="border-r border-slate-900 px-2 py-1 text-right" colSpan={2}>
                    SGST/UTGST
                  </th>
                </>
              ) : (
                <th className="border-r border-slate-900 px-2 py-1 text-right" colSpan={2}>
                  IGST
                </th>
              )}
              <th className="px-2 py-1 text-right">Total Tax</th>
            </tr>
          </thead>
          <tbody>
            {hsnRows.map((row) => {
              const split = splitTax(row.taxRate, row.taxAmount, sameState);
              return (
                <tr key={`${row.hsnCode}-${row.taxRate}`}>
                  <td className="border-r border-slate-900 px-2 py-1">{row.hsnCode || "-"}</td>
                  <td className="border-r border-slate-900 px-2 py-1 text-right">
                    {row.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border-r border-slate-900 px-2 py-1 text-right">{split.rate.toFixed(1)}%</td>
                  <td className="border-r border-slate-900 px-2 py-1 text-right">
                    {split.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  {sameState ? (
                    <>
                      <td className="border-r border-slate-900 px-2 py-1 text-right">{(split.rate2 ?? 0).toFixed(1)}%</td>
                      <td className="border-r border-slate-900 px-2 py-1 text-right">
                        {(split.amount2 ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </>
                  ) : null}
                  <td className="px-2 py-1 text-right">{row.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
            <tr className="border-t border-slate-900 font-semibold">
              <td className="border-r border-slate-900 px-2 py-1">Total</td>
              <td className="border-r border-slate-900 px-2 py-1 text-right">
                {itemsTaxableTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="border-r border-slate-900 px-2 py-1" colSpan={sameState ? 4 : 2} />
              <td className="px-2 py-1 text-right">{itemsTaxTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div className="border-t border-slate-900 px-2 py-1 text-xs">
          <p>
            <span className="font-semibold">Tax Amount (in words): </span>
            INR {amountInWords(itemsTaxTotal)}
          </p>
        </div>

        {/* Bank details, PAN, declaration, signatory */}
        <div className="grid grid-cols-2 border-t border-slate-900 text-xs">
          <div className="border-r border-slate-900 p-2">
            <p className="mb-1 font-semibold">Declaration</p>
            <p className="text-slate-600">
              We declare that this invoice shows the actual price of the goods/services described and that all
              particulars are true and correct.
            </p>
            {company?.pan ? <p className="mt-2">Company&apos;s PAN: {company.pan}</p> : null}
          </div>
          <div className="p-2">
            {hasBankDetails ? (
              <>
                <p className="mb-1 font-semibold">Company&apos;s Bank Details</p>
                <p>A/c Holder&apos;s Name: {company?.bankAccountName ?? "-"}</p>
                <p>Bank Name: {company?.bankName ?? "-"}</p>
                <p>A/c No.: {company?.bankAccountNumber ?? "-"}</p>
                <p>Branch &amp; IFS Code: {company?.bankIfsc ?? "-"}</p>
              </>
            ) : null}
            <p className="mt-8 text-right">for {company?.name ?? "the Company"}</p>
            <p className="mt-8 text-right">Authorised Signatory</p>
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-slate-500">This is a Computer Generated Invoice</p>
    </div>
  );
}

function MetaCell({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`border-slate-900 p-2 ${last ? "" : "border-b"}`}>
      <p className="text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function PartyBlock({
  name,
  addressText,
  gstin,
  pan,
  state,
}: {
  name: string;
  addressText: string | null | undefined;
  gstin: string | null;
  pan: string | null;
  state: string | null;
}) {
  return (
    <>
      <p className="font-bold">{name}</p>
      {addressText ? <p>{addressText}</p> : null}
      {gstin ? <p>GSTIN/UIN: {gstin}</p> : null}
      {pan ? <p>PAN/IT No: {pan}</p> : null}
      {state ? <p>State Name: {state}</p> : null}
    </>
  );
}
