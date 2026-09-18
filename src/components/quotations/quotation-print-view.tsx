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
import { parseProposalContent } from "@/lib/energy/quotations/proposal-content";
import { amountInWords } from "@/lib/energy/shared/amount-in-words";

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

type TechConfig = Record<string, string>;

function SpecTable({ title, rows }: { title: string; rows: [string, string | undefined][] }) {
  const filled = rows.filter((r): r is [string, string] => Boolean(r[1]));
  if (filled.length === 0) return null;
  return (
    <div className="mb-4 print:break-inside-avoid">
      <p className="mb-1 border-b border-slate-900 pb-1 text-xs font-bold uppercase tracking-wide">{title}</p>
      <table className="w-full text-xs">
        <tbody>
          {filled.map(([label, value]) => (
            <tr key={label} className="border-b border-slate-100">
              <td className="w-1/3 py-1 pr-2 text-slate-500">{label}</td>
              <td className="py-1">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MultilineList({ text }: { text?: string }) {
  if (!text) return null;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <ul className="list-inside list-disc space-y-0.5">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

export async function QuotationPrintView({ id }: { id: string }) {
  const session = await requireSession();
  const quotation = await getQuotationById({ companyId: session.companyId, id });
  if (!quotation) notFound();

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });

  const type = quotation.type as QuotationType;
  const isSolar = SOLAR_TYPES.includes(type);
  const isDg = DG_TYPES.includes(type);

  let config: TechConfig = {};
  if (quotation.technicalConfigJson) {
    try {
      config = JSON.parse(quotation.technicalConfigJson) as TechConfig;
    } catch {
      config = {};
    }
  }

  // For DG (or anything else with a technicalConfigJson blob but no dedicated
  // structured layout below), fall back to a generic key/value dump so no
  // captured data is silently dropped from the print view.
  const genericConfigEntries = Object.entries(config).filter(([, v]) => v);
  const hasSolarTechnicalData = genericConfigEntries.length > 0;
  const hasDesignInputs = Boolean(config.projectType || config.areaAvailable || config.siteSurveyStatus);

  const proposal = parseProposalContent(quotation.proposalContentJson);
  const hasPhilosophy = Boolean(proposal.vision || proposal.mission || proposal.philosophy);
  const standardClauses = (
    [
      ["Delivery", proposal.deliveryTerms],
      ["Inspection", proposal.inspectionTerms],
      ["Cancellation", proposal.cancellationTerms],
      ["Demurrage", proposal.demurrageTerms],
      ["Warranty", proposal.warrantyClause],
      ["Force Majeure", proposal.forceMajeureTerms],
    ] as [string, string | undefined][]
  ).filter((pair): pair is [string, string] => Boolean(pair[1]));

  const itemDiscountTotal = quotation.items.reduce((sum, item) => sum + item.discountAmount, 0);

  const companyAddressLines = company
    ? [company.addressLine1, company.addressLine2, [company.city, company.pincode].filter(Boolean).join(" - ")].filter(
        (line): line is string => Boolean(line)
      )
    : [];

  const hasBankDetails = Boolean(
    company?.bankAccountName || company?.bankName || company?.bankAccountNumber || company?.bankIfsc
  );

  return (
    <div className="mx-auto max-w-4xl bg-white p-4 text-[13px] text-slate-900 print:p-0">
      <div className="mb-3 flex items-center justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      {/* Letterhead */}
      <header className="mb-4 border-b-2 border-slate-900 pb-3 text-center">
        <h1 className="text-xl font-bold">{company?.name ?? "Company"}</h1>
        {company?.tagline ? <p className="text-sm font-medium text-slate-600">{company.tagline}</p> : null}
        {companyAddressLines.length > 0 ? <p className="text-xs text-slate-500">{companyAddressLines.join(", ")}</p> : null}
        <p className="text-xs text-slate-500">
          {[company?.email, company?.phone, company?.website].filter(Boolean).join("  |  ")}
        </p>
      </header>

      {/* Title + reference */}
      <section className="mb-4 flex items-start justify-between text-sm">
        <div>
          <p className="text-lg font-bold">QUOTATION</p>
          <p>
            Ref No.: <span className="font-medium">{quotation.quotationNumber}</span>
            {quotation.revisionNumber > 0 ? ` (Revision ${quotation.revisionNumber})` : ""}
          </p>
          <p>Date: {quotation.quotationDate.toLocaleDateString("en-IN")}</p>
        </div>
        <div className="text-right">
          <p className="font-medium">{QUOTATION_TYPE_LABELS[type] ?? quotation.type}</p>
          {quotation.validUntil ? <p>Valid Until: {quotation.validUntil.toLocaleDateString("en-IN")}</p> : null}
          {quotation.salesperson ? <p>Prepared by: {quotation.salesperson.name}</p> : null}
        </div>
      </section>

      {/* Customer */}
      <section className="mb-4 text-sm">
        <p className="text-xs text-slate-500">To,</p>
        <p className="font-semibold">{quotation.client.businessName || quotation.client.name}</p>
        {quotation.client.businessName ? <p>{quotation.client.name}</p> : null}
        {quotation.client.mobile ? <p>{quotation.client.mobile}</p> : null}
        {quotation.client.email ? <p>{quotation.client.email}</p> : null}
        {quotation.client.gstin ? <p>GSTIN: {quotation.client.gstin}</p> : null}
        {quotation.billingAddressText ? <p className="text-slate-600">{quotation.billingAddressText}</p> : null}
        {quotation.siteAddressText ? <p className="mt-1 text-slate-600">Site: {quotation.siteAddressText}</p> : null}
        <p className="mt-3">Dear Sir/Madam,</p>
        {quotation.subject ? <p className="mt-1 font-medium">Subject: {quotation.subject}</p> : null}
        {proposal.introduction ? <p className="mt-1 whitespace-pre-wrap text-slate-700">{proposal.introduction}</p> : null}
        {quotation.notes ? <p className="mt-1 whitespace-pre-wrap text-slate-700">{quotation.notes}</p> : null}
      </section>

      {/* Corporate philosophy */}
      {hasPhilosophy ? (
        <section className="mb-4 text-xs print:break-inside-avoid">
          <p className="mb-1 text-sm font-bold print:break-after-avoid">Our Corporate Philosophy</p>
          <div className="space-y-2">
            {proposal.vision ? (
              <div>
                <p className="font-semibold">Vision</p>
                <p className="whitespace-pre-wrap text-slate-700">{proposal.vision}</p>
              </div>
            ) : null}
            {proposal.mission ? (
              <div>
                <p className="font-semibold">Mission</p>
                <p className="whitespace-pre-wrap text-slate-700">{proposal.mission}</p>
              </div>
            ) : null}
            {proposal.philosophy ? (
              <div>
                <p className="font-semibold">How We Perceive Ourselves</p>
                <p className="whitespace-pre-wrap text-slate-700">{proposal.philosophy}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* System summary box */}
      <section className="mb-4 border border-slate-900 print:break-inside-avoid">
        <p className="border-b border-slate-900 bg-slate-50 px-2 py-1 text-center text-sm font-bold">
          QUOTATION FOR {config.systemCapacity ? `${config.systemCapacity} KWP ` : ""}
          {(QUOTATION_TYPE_LABELS[type] ?? quotation.type).toUpperCase()}
          {isSolar || isDg || type === "BATTERY_INVERTER" ? " SYSTEM" : ""}
        </p>
        {config.systemCapacity || (config.panelWattage && config.panelQuantity) || config.batteryQuantity || config.transportationCost ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 text-xs sm:grid-cols-4">
          {config.systemCapacity ? (
            <div>
              <p className="text-slate-500">System Size</p>
              <p className="font-medium">{config.systemCapacity} kWp</p>
            </div>
          ) : null}
          {config.panelWattage && config.panelQuantity ? (
            <div>
              <p className="text-slate-500">Solar Module</p>
              <p className="font-medium">
                {config.panelWattage} Wp x {config.panelQuantity}
              </p>
            </div>
          ) : null}
          {isSolar && type !== "ON_GRID_SOLAR" && config.batteryQuantity ? (
            <div>
              <p className="text-slate-500">Battery</p>
              <p className="font-medium">
                {config.batterySpecification ?? config.batteryCapacity ?? ""} x {config.batteryQuantity}
              </p>
            </div>
          ) : null}
          {config.transportationCost ? (
            <div>
              <p className="text-slate-500">Transportation</p>
              <p className="font-medium">{config.transportationCost}</p>
            </div>
          ) : null}
        </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-slate-900 px-3 py-2">
          <p className="text-sm font-bold">Price (including GST)</p>
          <p className="text-sm font-bold">Rs. {quotation.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </div>
        {quotation.validUntil ? (
          <p className="border-t border-slate-900 px-3 py-1 text-xs italic text-slate-600">
            Note: Quote valid up to {quotation.validUntil.toLocaleDateString("en-IN")}
          </p>
        ) : null}
      </section>

      {/* Line items */}
      <section className="mb-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-900 text-left">
              <th className="py-1">Item</th>
              <th className="py-1">Qty</th>
              <th className="py-1">Unit</th>
              <th className="py-1 text-right">Rate</th>
              <th className="py-1 text-right">Disc %</th>
              <th className="py-1 text-right">Tax %</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-1">
                  <p className="font-medium">{item.productName}</p>
                  {item.description ? <p className="text-slate-500">{item.description}</p> : null}
                </td>
                <td className="py-1">{item.quantity}</td>
                <td className="py-1">{item.unitLabel ?? "-"}</td>
                <td className="py-1 text-right">{item.unitPrice.toLocaleString("en-IN")}</td>
                <td className="py-1 text-right">{item.discountPercent ?? 0}%</td>
                <td className="py-1 text-right">{item.taxRate ?? 0}%</td>
                <td className="py-1 text-right font-medium">{item.lineTotal.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 flex justify-end">
          <table className="w-64 text-xs">
            <tbody>
              <tr>
                <td className="py-0.5 text-slate-500">Subtotal</td>
                <td className="py-0.5 text-right">{quotation.subtotal.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-slate-500">Item Discounts</td>
                <td className="py-0.5 text-right">-{itemDiscountTotal.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-slate-500">Taxable Amount</td>
                <td className="py-0.5 text-right">{quotation.taxableAmount.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-slate-500">GST / Tax</td>
                <td className="py-0.5 text-right">{quotation.taxAmount.toLocaleString("en-IN")}</td>
              </tr>
              {quotation.discountPercent ? (
                <tr>
                  <td className="py-0.5 text-slate-500">Overall Discount ({quotation.discountPercent}%)</td>
                  <td className="py-0.5 text-right">-{quotation.discountAmount.toLocaleString("en-IN")}</td>
                </tr>
              ) : null}
              {quotation.otherCharges ? (
                <tr>
                  <td className="py-0.5 text-slate-500">Other Charges</td>
                  <td className="py-0.5 text-right">{quotation.otherCharges.toLocaleString("en-IN")}</td>
                </tr>
              ) : null}
              <tr className="border-t border-slate-900 font-semibold">
                <td className="py-1">Grand Total</td>
                <td className="py-1 text-right">Rs. {quotation.grandTotal.toLocaleString("en-IN")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-right text-xs italic text-slate-600">
          Amount in Words: INR {amountInWords(quotation.grandTotal)}
        </p>
      </section>

      {/* Technical details */}
      {isSolar && hasSolarTechnicalData ? (
        <section className="mb-4">
          <p className="mb-2 text-sm font-bold print:break-after-avoid">Technical Details</p>
          {hasDesignInputs ? (
            <div className="mb-4 print:break-inside-avoid">
              <p className="mb-1 border-b border-slate-900 pb-1 text-xs font-bold uppercase tracking-wide">Design Inputs</p>
              <table className="w-full text-xs">
                <tbody>
                  {config.projectType ? (
                    <tr className="border-b border-slate-100">
                      <td className="w-1/3 py-1 pr-2 text-slate-500">Project Type</td>
                      <td className="py-1">{config.projectType}</td>
                    </tr>
                  ) : null}
                  {config.areaAvailable ? (
                    <tr className="border-b border-slate-100">
                      <td className="w-1/3 py-1 pr-2 text-slate-500">Area Available</td>
                      <td className="py-1">{config.areaAvailable}</td>
                    </tr>
                  ) : null}
                  {config.siteSurveyStatus ? (
                    <tr className="border-b border-slate-100">
                      <td className="w-1/3 py-1 pr-2 text-slate-500">Site Survey</td>
                      <td className="py-1 whitespace-pre-wrap">{config.siteSurveyStatus}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <SpecTable
              title="Solar PV Module Details"
              rows={[
                ["Manufacturer", config.moduleManufacturer],
                ["No. of Modules", config.panelQuantity],
                ["Wattage per Module", config.panelWattage ? `${config.panelWattage} Wp` : undefined],
                ["Warranty", config.moduleWarranty],
              ]}
            />
            <SpecTable
              title="Inverter / PCU Details"
              rows={[
                ["Manufacturer", config.inverterManufacturer],
                ["Rating", config.inverterCapacity],
                ["Quantity", config.inverterQuantity],
                ["Specification", config.inverterSpecification],
                ["Warranty", config.inverterWarranty],
              ]}
            />
            {type !== "ON_GRID_SOLAR" ? (
              <SpecTable
                title="Battery Details"
                rows={[
                  ["Manufacturer", config.batteryManufacturer],
                  ["Quantity", config.batteryQuantity],
                  ["Specification", config.batterySpecification ?? config.batteryCapacity],
                  ["Backup", config.backupRequirement],
                  ["Backup Hours", config.backupHours],
                  ["Warranty", config.batteryWarranty],
                ]}
              />
            ) : null}
            <SpecTable
              title="Mounting Structure Details"
              rows={[
                ["Type", config.structure],
                ["Wind Speed Resistance", config.windSpeedResistance],
                ["Warranty", config.mountingWarranty],
              ]}
            />
          </div>
          {config.installationIncluded || config.installationExcluded ? (
            <div className="mt-2 grid grid-cols-1 gap-x-6 text-xs sm:grid-cols-2">
              {config.installationIncluded ? (
                <div>
                  <p className="mb-1 font-semibold">Installation Included</p>
                  <MultilineList text={config.installationIncluded} />
                </div>
              ) : null}
              {config.installationExcluded ? (
                <div>
                  <p className="mb-1 font-semibold">Excluded</p>
                  <MultilineList text={config.installationExcluded} />
                </div>
              ) : null}
            </div>
          ) : null}
          {config.notes ? <p className="mt-2 text-xs text-slate-600">{config.notes}</p> : null}
        </section>
      ) : isDg && genericConfigEntries.length > 0 ? (
        <section className="mb-4">
          <p className="mb-2 text-sm font-bold print:break-after-avoid">Technical Details</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {genericConfigEntries.map(([key, value]) => (
              <p key={key}>
                <span className="text-slate-500">{labelize(key)}:</span> {value}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* Payment terms, delivery & warranty */}
      <section className="mb-4 grid grid-cols-1 gap-6 text-xs sm:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-bold">Payment Terms</p>
          {quotation.paymentTerms ? <p className="whitespace-pre-wrap">{quotation.paymentTerms}</p> : <p className="text-slate-400">-</p>}
        </div>
        <div>
          <p className="mb-1 text-sm font-bold">Delivery &amp; Warranty</p>
          {quotation.deliveryTimeline ? <p>Delivery: {quotation.deliveryTimeline}</p> : null}
          {quotation.installationTimeline ? <p>Installation: {quotation.installationTimeline}</p> : null}
          {quotation.equipmentWarranty ? <p>Equipment Warranty: {quotation.equipmentWarranty}</p> : null}
          {quotation.installationWarranty ? <p>Installation Warranty: {quotation.installationWarranty}</p> : null}
          {!quotation.deliveryTimeline &&
          !quotation.installationTimeline &&
          !quotation.equipmentWarranty &&
          !quotation.installationWarranty ? (
            <p className="text-slate-400">-</p>
          ) : null}
        </div>
      </section>

      {/* Terms & conditions */}
      {standardClauses.length > 0 || quotation.termsAndConditions ? (
        <section className="mb-4">
          <p className="mb-1 text-sm font-bold">Terms &amp; Conditions</p>
          {standardClauses.length > 0 ? (
            <div className="mb-2 space-y-1.5 text-xs">
              {standardClauses.map(([label, text]) => (
                <p key={label}>
                  <span className="font-semibold">{label} - </span>
                  <span className="whitespace-pre-wrap text-slate-700">{text}</span>
                </p>
              ))}
            </div>
          ) : null}
          {quotation.termsAndConditions ? (
            <p className="whitespace-pre-wrap text-xs text-slate-700">{quotation.termsAndConditions}</p>
          ) : null}
        </section>
      ) : null}

      {/* Bank details + signature */}
      {/* No print:break-inside-avoid here deliberately: forcing this whole
          block onto one page pushed it, in full, to an otherwise-empty
          trailing page when it didn't quite fit the remaining space on the
          page before it. A split inside this short block is a smaller
          cosmetic cost than a near-blank page. */}
      <section className="grid grid-cols-2 border-t border-slate-900 pt-3 text-xs">
        <div>
          {hasBankDetails ? (
            <div className="print:break-inside-avoid">
              <p className="mb-1 font-semibold">Bank Details</p>
              <p>A/c Holder&apos;s Name: {company?.bankAccountName ?? "-"}</p>
              <p>Bank Name: {company?.bankName ?? "-"}</p>
              <p>A/c No.: {company?.bankAccountNumber ?? "-"}</p>
              <p>Branch &amp; IFS Code: {company?.bankIfsc ?? "-"}</p>
            </div>
          ) : null}
          {company?.gstin ? <p className="mt-2">GSTIN: {company.gstin}</p> : null}
          {company?.pan ? <p>PAN: {company.pan}</p> : null}
        </div>
        <div>
          <p className="mt-6 text-right">for {company?.name ?? "the Company"}</p>
          <p className="mt-6 text-right">Authorised Signatory</p>
        </div>
      </section>
    </div>
  );
}
