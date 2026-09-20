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
import { parseProposalContent, type ProposalContentValues } from "@/lib/energy/quotations/proposal-content";
import { amountInWords } from "@/lib/energy/shared/amount-in-words";

type TechConfig = Record<string, string>;
type QuotationWithRelations = NonNullable<Awaited<ReturnType<typeof getQuotationById>>>;
type CompanyRecord = NonNullable<Awaited<ReturnType<typeof prisma.company.findUnique>>>;

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

function MultilineList({ text, ordered }: { text?: string; ordered?: boolean }) {
  if (!text) return null;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={ordered ? "list-inside list-decimal space-y-0.5" : "list-inside list-disc space-y-0.5"}>
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </Tag>
  );
}

// The company's actual pre-designed letterhead artwork (logo top-left,
// partner/dealer mark top-right, decorative motif bottom-right) - a single
// flattened image, extracted at full quality from the company-supplied
// letterhead PDF (not reconstructed/redrawn). Used as a full-bleed page
// background so every page of the quotation carries the same letterhead a
// physical piece of pre-printed stationery would, rather than a plain text
// header on page 1 only.
const LETTERHEAD_IMAGE_URL = "/quotation-letterhead.png";

// Clearance below the artwork's logo band and above its bottom-right motif -
// tuned by visually checking a rendered PDF against the source image, not
// derived from the image's pixel geometry, so revisit if the artwork changes.
const LETTERHEAD_PAGE_STYLE: React.CSSProperties = {
  backgroundImage: `url(${LETTERHEAD_IMAGE_URL})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  minHeight: "277mm",
};

// One physical page of the letterhead-branded document: the background
// artwork plus the company's contact-details text (name/address/email/
// phone/website aren't part of the artwork itself, so still rendered as
// text), then whatever page-specific content is passed in as children.
function LetterheadPage({
  company,
  companyAddressLines,
  breakBefore = true,
  children,
}: {
  company: CompanyRecord | null;
  companyAddressLines: string[];
  breakBefore?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={breakBefore ? "relative print:break-before-page" : "relative"}
      style={{ ...LETTERHEAD_PAGE_STYLE, paddingTop: "40mm", paddingBottom: "35mm", paddingLeft: "4mm", paddingRight: "4mm" }}
    >
      <header className="mb-4 border-b border-slate-900 pb-2 text-xs text-slate-700">
        <p className="text-sm font-bold text-slate-900">{company?.name ?? "Company"}</p>
        {company?.tagline ? <p className="italic" style={{ color: BRAND_TEAL }}>{company.tagline}</p> : null}
        {companyAddressLines.length > 0 ? <p>{companyAddressLines.join(", ")}</p> : null}
        <p>
          {[company?.email ? `Email: ${company.email}` : null, company?.phone ? `Cell: ${company.phone}` : null]
            .filter(Boolean)
            .join("   ")}
        </p>
        {company?.website ? <p>Website: {company.website}</p> : null}
      </header>
      {children}
    </div>
  );
}

// The two brand colors actually used in the company's own letterhead artwork
// (sampled directly from the ribbon graphic in quotation-letterhead.png via
// a color-histogram pass, not guessed or copied from any third party's
// branding) - used for a colored section-heading banner so annexure-style
// pages read closer to the DG reference document's own colored "ANNEXURE X:"
// heading bands, without reproducing that reference's actual Kirloskar-brand
// graphics/colors.
const BRAND_TEAL = "#1a7564";
const BRAND_ORANGE = "#e6833c";

// A colored heading band for a DG proposal annexure-style page (Salient
// Features, Investment Details, Commercial Terms, Warranty, Technical
// Details, Certificate) - not used on the cover letter page, which reads as
// a plain formal letter in both the reference and here.
function SectionBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 flex items-center gap-2 border-l-4 py-1.5 pl-3 text-sm font-bold uppercase tracking-wide text-white print:break-after-avoid"
      style={{ backgroundColor: BRAND_TEAL, borderLeftColor: BRAND_ORANGE }}
    >
      {children}
    </div>
  );
}

// Purely a visual aid in the on-screen/editable preview so it's obvious
// where the printed document will actually break - has no effect on the
// print/PDF output itself (print:hidden).
function PageDivider({ label }: { label: string }) {
  return (
    <div className="mb-2 mt-8 border-t border-dashed border-slate-300 pt-1 text-center text-[10px] uppercase tracking-wide text-slate-400 print:hidden">
      {label}
    </div>
  );
}

function BankDetailsBlock({ company }: { company: CompanyRecord | null }) {
  const hasBankDetails = Boolean(
    company?.bankAccountName || company?.bankName || company?.bankAccountNumber || company?.bankIfsc
  );
  return (
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

  const companyAddressLines = company
    ? [company.addressLine1, company.addressLine2, [company.city, company.pincode].filter(Boolean).join(" - ")].filter(
        (line): line is string => Boolean(line)
      )
    : [];

  if (isSolar) {
    return (
      <EightPageSolarProposal
        quotation={quotation}
        company={company}
        type={type}
        config={config}
        proposal={proposal}
        hasPhilosophy={hasPhilosophy}
        standardClauses={standardClauses}
        hasDesignInputs={hasDesignInputs}
        companyAddressLines={companyAddressLines}
      />
    );
  }

  if (isDg) {
    return (
      <DgProposal
        quotation={quotation}
        company={company}
        config={config}
        proposal={proposal}
        standardClauses={standardClauses}
        companyAddressLines={companyAddressLines}
      />
    );
  }

  const itemDiscountTotal = quotation.items.reduce((sum, item) => sum + item.discountAmount, 0);

  return (
    <div className="mx-auto max-w-4xl bg-white p-4 text-[13px] text-slate-900 print:p-0">
      <div className="mb-3 flex items-center justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      <LetterheadPage company={company} companyAddressLines={companyAddressLines} breakBefore={false}>
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
      ) : null}
      {/* DG quotations never reach this compact layout - they get their own
          DgProposal above - so there's no DG technical-details fallback
          needed here anymore. */}

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

      </LetterheadPage>

      {/* Bank details get their own letterhead page rather than risking an
          overflow onto an unstyled trailing page for longer quotations (see
          the identical reasoning on the 8-page Solar layout below). */}
      <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
        <BankDetailsBlock company={company} />
      </LetterheadPage>
    </div>
  );
}

const GRID_TYPE_WORDS: Partial<Record<QuotationType, string>> = {
  ON_GRID_SOLAR: "ON-GRID",
  OFF_GRID_SOLAR: "OFF-GRID",
  HYBRID_SOLAR: "HYBRID",
};

// Faithful, page-by-page reproduction of a reference on-grid/off-grid solar
// EPC proposal document (a real dealer's own "Project Report" quotation
// format, branded with the company's own letterhead artwork on every page) -
// deliberately laid out as discrete, forced-page-break sections rather than
// the compact continuous layout used for every other quotation type. The
// reference maps to roughly 8 sections, but Bank Details got its own page
// (see the comment further down) since our commercial page carries more
// detail (a full line-items table) than the reference's terser box and no
// longer reliably fits alongside it on one physical page. See
// PROJECT_STATE.md for the reference analysis this was built from. Every
// value below comes from the quotation/company/client records - nothing
// here is the reference document's own
// sample data.
function EightPageSolarProposal({
  quotation,
  company,
  type,
  config,
  proposal,
  hasPhilosophy,
  standardClauses,
  hasDesignInputs,
  companyAddressLines,
}: {
  quotation: QuotationWithRelations;
  company: CompanyRecord | null;
  type: QuotationType;
  config: TechConfig;
  proposal: ProposalContentValues;
  hasPhilosophy: boolean;
  standardClauses: [string, string][];
  hasDesignInputs: boolean;
  companyAddressLines: string[];
}) {
  const itemDiscountTotal = quotation.items.reduce((sum, item) => sum + item.discountAmount, 0);
  const gridTypeWord = GRID_TYPE_WORDS[type] ?? (QUOTATION_TYPE_LABELS[type] ?? quotation.type).toUpperCase();
  const classification =
    type === "ON_GRID_SOLAR" ? "Without Energy Storage" : type === "OFF_GRID_SOLAR" || type === "HYBRID_SOLAR" ? "With Energy Storage" : undefined;
  const customerDisplayName = quotation.client.businessName || quotation.client.name;

  return (
    <div className="mx-auto max-w-4xl bg-white p-4 text-[13px] text-slate-900 print:p-0">
      <div className="mb-3 flex items-center justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      {/* PAGE 1 - Cover */}
      <div className="relative" style={{ ...LETTERHEAD_PAGE_STYLE, paddingTop: "40mm", paddingBottom: "68mm", paddingLeft: "6mm", paddingRight: "6mm" }}>
        <div className="text-center">
          <p className="text-2xl font-bold tracking-wide">PROJECT REPORT</p>
          <p className="mt-4 text-lg">ON</p>
          <p className="mt-4 text-3xl font-bold">
            {config.systemCapacity ? `${config.systemCapacity} kW ` : ""}
            {gridTypeWord}
          </p>
          <p className="mt-3 text-2xl font-bold tracking-wide">SOLAR POWER GENERATING SYSTEM</p>
          <p className="mt-10 text-lg">For</p>
          <p className="mt-2 text-2xl font-bold">&ldquo;{customerDisplayName}&rdquo;</p>
        </div>
        <div className="mt-24 text-sm">
          <p className="font-bold">{company?.name ?? "Company"}</p>
          {company?.tagline ? <p>{company.tagline}</p> : null}
          {companyAddressLines.length > 0 ? <p>{companyAddressLines.join(", ")}</p> : null}
          <p>
            {[company?.email ? `Email: ${company.email}` : null, company?.phone ? `Cell: ${company.phone}` : null]
              .filter(Boolean)
              .join("   ")}
          </p>
        </div>
      </div>

      {/* PAGE 2 - Branding / website (thin, matches the reference's own repeated-letterhead-only page) */}
      <PageDivider label="Page 2" />
      <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
        {company?.website ? (
          <p className="mt-32 text-center text-lg font-medium text-slate-600">{company.website}</p>
        ) : null}
      </LetterheadPage>

      {/* PAGE 3 - Letter / introduction */}
      <PageDivider label="Page 3" />
      <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
        <p>Ref No.: {quotation.quotationNumber}</p>
        <p>Date: {quotation.quotationDate.toLocaleDateString("en-IN")}</p>
        <p className="mt-3">{customerDisplayName},</p>
        {quotation.billingAddressText ? <p>{quotation.billingAddressText}</p> : null}
        <p className="mt-3">Dear Sir/Madam,</p>
        {proposal.introduction ? (
          <p className="mt-2 whitespace-pre-wrap text-slate-700">{proposal.introduction}</p>
        ) : null}
        {quotation.subject ? <p className="mt-2 font-medium">Subject: {quotation.subject}</p> : null}
        {quotation.notes ? <p className="mt-2 whitespace-pre-wrap text-slate-700">{quotation.notes}</p> : null}
      </LetterheadPage>

      {/* PAGE 4 - Corporate philosophy */}
      {hasPhilosophy ? (
        <>
          <PageDivider label="Page 4" />
          <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
            <p className="text-sm font-bold">A) Our Corporate Philosophy</p>
            <div className="mt-2 space-y-2">
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
                  <p className="font-semibold">How we perceive ourselves</p>
                  <p className="whitespace-pre-wrap text-slate-700">{proposal.philosophy}</p>
                </div>
              ) : null}
            </div>
          </LetterheadPage>
        </>
      ) : null}

      {/* PAGE 5 - Commercial quotation + line items + payment terms */}
      <PageDivider label="Page 5" />
      <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
        <p className="mb-2 text-center text-sm font-bold">
          QUOTATION OF {config.systemCapacity ? `${config.systemCapacity} KW ` : ""}
          {gridTypeWord} SYSTEM
        </p>
        <table className="w-full text-xs">
          <tbody>
            {classification ? (
              <tr className="border-b border-slate-200">
                <td className="w-1/3 py-1 font-semibold">Product classification</td>
                <td className="py-1">{classification}</td>
              </tr>
            ) : null}
            {config.systemCapacity ? (
              <tr className="border-b border-slate-200">
                <td className="w-1/3 py-1 font-semibold">System size</td>
                <td className="py-1">{config.systemCapacity} kW</td>
              </tr>
            ) : null}
            {config.panelWattage && config.panelQuantity ? (
              <tr className="border-b border-slate-200">
                <td className="w-1/3 py-1 font-semibold">Solar module</td>
                <td className="py-1">
                  {config.panelWattage} Wp x {config.panelQuantity}
                </td>
              </tr>
            ) : null}
            {config.inverterCapacity ? (
              <tr className="border-b border-slate-200">
                <td className="w-1/3 py-1 font-semibold">PCU</td>
                <td className="py-1">{config.inverterCapacity}</td>
              </tr>
            ) : null}
            {config.transportationCost ? (
              <tr className="border-b border-slate-200">
                <td className="w-1/3 py-1 font-semibold">Transportation Cost</td>
                <td className="py-1">{config.transportationCost}</td>
              </tr>
            ) : null}
            <tr className="border-b border-slate-200">
              <td className="w-1/3 py-1 font-semibold">Price (including GST)</td>
              <td className="py-1 font-bold">Rs. {quotation.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
        {quotation.validUntil ? (
          <p className="mt-1 text-xs italic">NOTE: Quote valid for up to {quotation.validUntil.toLocaleDateString("en-IN")}</p>
        ) : null}
        <p className="mt-1 text-right text-xs italic text-slate-600">
          Amount in Words: INR {amountInWords(quotation.grandTotal)}
        </p>

        <table className="mt-4 w-full border-collapse text-xs print:break-inside-avoid">
          <thead>
            <tr className="border-b border-slate-900 text-left">
              <th className="py-1">Item</th>
              <th className="py-1">Qty</th>
              <th className="py-1">Unit</th>
              <th className="py-1 text-right">Rate</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-1">{item.productName}</td>
                <td className="py-1">{item.quantity}</td>
                <td className="py-1">{item.unitLabel ?? "-"}</td>
                <td className="py-1 text-right">{item.unitPrice.toLocaleString("en-IN")}</td>
                <td className="py-1 text-right">{item.lineTotal.toLocaleString("en-IN")}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1" colSpan={3} />
              <td className="py-1 text-right">Subtotal</td>
              <td className="py-1 text-right">{quotation.subtotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr className="font-semibold">
              <td className="py-1" colSpan={3} />
              <td className="py-1 text-right">Discounts</td>
              <td className="py-1 text-right">-{itemDiscountTotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr className="font-semibold">
              <td className="py-1" colSpan={3} />
              <td className="py-1 text-right">GST / Tax</td>
              <td className="py-1 text-right">{quotation.taxAmount.toLocaleString("en-IN")}</td>
            </tr>
            <tr className="border-t border-slate-900 font-bold">
              <td className="py-1" colSpan={3} />
              <td className="py-1 text-right">Grand Total</td>
              <td className="py-1 text-right">Rs. {quotation.grandTotal.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 text-xs print:break-inside-avoid">
          <p className="mb-1 font-semibold">Payment Terms -</p>
          {quotation.paymentTerms ? (
            <p className="whitespace-pre-wrap">{quotation.paymentTerms}</p>
          ) : (
            <p className="text-slate-400">-</p>
          )}
        </div>

        <div className="mt-3 text-xs">
          <p className="font-semibold">{company?.name ?? "Company"},</p>
          {company?.phone ? <p>Ph No: {company.phone}</p> : null}
          {company?.email ? <p>Mail Id: {company.email}</p> : null}
        </div>
      </LetterheadPage>

      {/* PAGE 6 - Bank details + signature (split out from Page 5: with a full
          line-items table + totals + payment terms already on that page, the
          bank details block no longer reliably fits the same physical page -
          it was previously overflowing onto an unstyled trailing page with no
          letterhead at all. Giving it its own explicit page keeps the
          letterhead on every physical page, per the "controlled page breaks,
          not accidental overflow" requirement this layout was built to.) */}
      <PageDivider label="Page 6" />
      <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
        <BankDetailsBlock company={company} />
      </LetterheadPage>

      {/* PAGE 7 - Terms & conditions */}
      {standardClauses.length > 0 || quotation.termsAndConditions ? (
        <>
          <PageDivider label="Page 7" />
          <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
            <p className="mb-2 text-sm font-bold">Terms and Condition</p>
            <p className="mb-2 text-slate-700">Please review the following Terms and Conditions.</p>
            {standardClauses.length > 0 ? (
              <div className="space-y-2 text-xs">
                {standardClauses.map(([label, text]) => (
                  <p key={label}>
                    <span className="font-semibold">{label} - </span>
                    <span className="whitespace-pre-wrap text-slate-700">{text}</span>
                  </p>
                ))}
              </div>
            ) : null}
            {quotation.termsAndConditions ? (
              <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{quotation.termsAndConditions}</p>
            ) : null}
          </LetterheadPage>
        </>
      ) : null}

      {/* PAGE 8 - Design inputs + technical details */}
      <PageDivider label="Page 8" />
      <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
        {hasDesignInputs ? (
          <div className="mb-4 print:break-inside-avoid">
            <p className="text-sm font-bold">Design Inputs</p>
            <p className="mb-2 text-xs text-slate-600">The system has been designed based on the following parameters</p>
            <table className="w-full text-xs">
              <tbody>
                {config.projectType ? (
                  <tr className="border-b border-slate-100">
                    <td className="w-1/3 py-1 pr-2 text-slate-500">Project type</td>
                    <td className="py-1">{config.projectType}</td>
                  </tr>
                ) : null}
                {config.areaAvailable ? (
                  <tr className="border-b border-slate-100">
                    <td className="w-1/3 py-1 pr-2 text-slate-500">Area available</td>
                    <td className="py-1">{config.areaAvailable}</td>
                  </tr>
                ) : null}
                {config.siteSurveyStatus ? (
                  <tr className="border-b border-slate-100">
                    <td className="w-1/3 py-1 pr-2 text-slate-500">Site survey</td>
                    <td className="py-1 whitespace-pre-wrap">{config.siteSurveyStatus}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mb-1 text-sm font-bold print:break-after-avoid">Technical Details</p>
        <p className="mb-2 text-xs italic text-slate-500">
          Solar PV module | Inverter | Mounting structure{type !== "ON_GRID_SOLAR" ? " | Battery" : ""}
        </p>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <SpecTable
            title="Solar PV Module Details"
            rows={[
              ["Manufacturer", config.moduleManufacturer],
              ["No. of modules", config.panelQuantity],
              ["Wattage of each module", config.panelWattage ? `${config.panelWattage} Wp` : undefined],
              ["Warranty", config.moduleWarranty],
            ]}
          />
          <SpecTable
            title="PCU Details"
            rows={[
              ["Manufacturer", config.inverterManufacturer],
              ["Rating kW per inverter", config.inverterCapacity],
              ["Quantity", config.inverterQuantity],
              ["PCU Specification", config.inverterSpecification],
              ["Warranty", config.inverterWarranty],
            ]}
          />
          {type !== "ON_GRID_SOLAR" ? (
            <SpecTable
              title="Battery Details"
              rows={[
                ["Manufacturer", config.batteryManufacturer],
                ["Quantity", config.batteryQuantity],
                ["Battery specification", config.batterySpecification ?? config.batteryCapacity],
                ["Backup", config.backupRequirement],
                ["Backup hours", config.backupHours],
                ["Warranty", config.batteryWarranty],
              ]}
            />
          ) : null}
          <SpecTable
            title="Mounting Structure Details"
            rows={[
              ["Type", config.structure],
              ["Wind speed resistance", config.windSpeedResistance],
              ["Warranty", config.mountingWarranty],
            ]}
          />
        </div>
        {config.notes ? <p className="mt-2 text-xs text-slate-600">{config.notes}</p> : null}
      </LetterheadPage>

      {/* PAGE 9 - Installation included + excluded */}
      {config.installationIncluded || config.installationExcluded ? (
        <>
          <PageDivider label="Page 9" />
          <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
            {config.installationIncluded ? (
              <div className="mb-4">
                <p className="mb-1 text-sm font-bold">Installation Included -</p>
                <MultilineList text={config.installationIncluded} ordered />
              </div>
            ) : null}
            {config.installationExcluded ? (
              <div>
                <p className="mb-1 text-sm font-bold">Excluded -</p>
                <MultilineList text={config.installationExcluded} ordered />
              </div>
            ) : null}
          </LetterheadPage>
        </>
      ) : null}
    </div>
  );
}

// Letterhead-branded, page-by-page reproduction of a Diesel Generator (DG)
// channel-partner proposal (a real dealer's "Proposal ... DG Set" letter,
// organized as a cover letter plus numbered annexures for Investment
// Details / Commercial Terms / Warranty / Technical spec). Structurally
// different from the Solar proposal above - no separate title-page cover,
// since the reference document itself opens directly with the letter - but
// reuses the same letterhead, bank-details, and named-clause infrastructure.
// Purely marketing/graphic annexures from the reference (company promise,
// service network map, dealer certificate, company profile) have no
// corresponding data in this app and were deliberately left out rather than
// filled with invented content.
function DgProposal({
  quotation,
  company,
  config,
  proposal,
  standardClauses,
  companyAddressLines,
}: {
  quotation: QuotationWithRelations;
  company: CompanyRecord | null;
  config: TechConfig;
  proposal: ProposalContentValues;
  standardClauses: [string, string][];
  companyAddressLines: string[];
}) {
  const itemDiscountTotal = quotation.items.reduce((sum, item) => sum + item.discountAmount, 0);
  const customerDisplayName = quotation.client.businessName || quotation.client.name;
  const hasDgSpec = Boolean(
    config.dgManufacturer ||
      config.dgCapacityKva ||
      config.phase ||
      config.emissionNorm ||
      config.dgModel ||
      config.fuelType ||
      config.alternatorMake ||
      config.coolingType ||
      config.panelType ||
      config.enclosureType ||
      config.warranty
  );
  const hasRequirements = Boolean(config.amfRequired || config.synchronizationRequired || config.installationRequired);

  // DG-specific 12-clause commercial terms (Prices / Freight & Transit Insurance / GST /
  // Delivery / Payment Terms / Offer Validity / Statutory Variations / Exclusions /
  // Installation & Commissioning / Force Majeure / Storage & Interest Charges / Arbitration) -
  // a distinct, richer structure from the 6 generic named clauses shared with the Solar
  // layout, since a real DG dealer proposal's commercial terms cover ground (freight,
  // statutory variations, storage/interest, arbitration venue) that a Solar quotation's
  // generic clauses don't. Falls back to the shared standardClauses if none of these
  // DG-specific fields are filled, so older DG quotations captured before this field set
  // existed still show something on this page.
  const dgCommercialClauses: [string, string | undefined][] = [
    ["1. Prices", config.dgTcPrices],
    ["2. Freight & Transit Insurance", config.dgTcFreightInsurance],
    ["3. GST", config.dgTcGst],
    ["4. Delivery", config.dgTcDelivery],
    ["5. Payment Terms", config.dgTcPaymentTerms],
    ["6. Offer Validity", config.dgTcOfferValidity],
    ["7. Statutory Variations", config.dgTcStatutoryVariations],
    ["8. Exclusions", config.dgTcExclusions],
    ["9. Installation & Commissioning", config.dgTcInstallationCommissioning],
    ["10. Force Majeure", config.dgTcForceMajeure],
    ["11. Storage & Interest Charges", config.dgTcStorageInterest],
    ["12. Arbitration", config.dgTcArbitration],
  ];
  const filledDgClauses = dgCommercialClauses.filter((c): c is [string, string] => Boolean(c[1]));
  const commercialClauses = filledDgClauses.length > 0 ? filledDgClauses : standardClauses;

  const hasWarrantyAnnexure = Boolean(config.warranty || config.dgFreeServiceChecks || config.dgWarrantyConditions);
  // The real, signed Kirloskar Authorized Sales Dealer certificate for Shanvi Enterprises
  // (extracted from the CPCB reference .doc's embedded images, rotated to upright) is only
  // factually correct to show when the quotation's own manufacturer field says Kirloskar -
  // never shown for a different manufacturer's DG quotation. Falls back to the free-text
  // dgCertificateText statement (which the company can fill in for any other manufacturer)
  // when it doesn't match.
  const hasRealKirloskarCertificate = (config.dgManufacturer ?? "").trim().toLowerCase().includes("kirloskar");
  const hasCertificate = hasRealKirloskarCertificate || Boolean(config.dgCertificateText);

  return (
    <div className="mx-auto max-w-4xl bg-white p-4 text-[13px] text-slate-900 print:p-0">
      <div className="mb-3 flex items-center justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      {/* PAGE 1 - Letter */}
      <LetterheadPage company={company} companyAddressLines={companyAddressLines} breakBefore={false}>
        <p>Ref No.: {quotation.quotationNumber}</p>
        <p>Date: {quotation.quotationDate.toLocaleDateString("en-IN")}</p>
        <p className="mt-3">{customerDisplayName},</p>
        {quotation.billingAddressText ? <p>{quotation.billingAddressText}</p> : null}
        {quotation.client.gstin ? <p>GSTIN: {quotation.client.gstin}</p> : null}
        <p className="mt-3">Dear Sir/Madam,</p>
        {quotation.subject ? <p className="mt-2 font-medium">Subject: {quotation.subject}</p> : null}
        {proposal.introduction ? (
          <p className="mt-2 whitespace-pre-wrap text-slate-700">{proposal.introduction}</p>
        ) : null}
        {quotation.notes ? <p className="mt-2 whitespace-pre-wrap text-slate-700">{quotation.notes}</p> : null}
        <p className="mt-4">Thanking you,</p>
        <p>Yours faithfully,</p>
        <div className="mt-2">
          <p>{company?.name ?? "Company"}</p>
          {companyAddressLines.length > 0 ? <p>{companyAddressLines.join(", ")}</p> : null}
          {company?.phone ? <p>Ph. No. {company.phone}</p> : null}
        </div>
      </LetterheadPage>

      {/* PAGE 2 - Salient Features */}
      {config.dgFeatures ? (
        <>
          <PageDivider label="Page 2" />
          <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
            <SectionBanner>Salient Features</SectionBanner>
            <MultilineList text={config.dgFeatures} />
          </LetterheadPage>
        </>
      ) : null}

      {/* PAGE 3 - Investment details */}
      <PageDivider label="Page 3" />
      <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
        <SectionBanner>Investment Details</SectionBanner>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-900 text-left">
              <th className="py-1">Description</th>
              <th className="py-1">Qty</th>
              <th className="py-1">Unit</th>
              <th className="py-1 text-right">Rate</th>
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
                <td className="py-1 text-right">{item.lineTotal.toLocaleString("en-IN")}</td>
              </tr>
            ))}
            <tr>
              <td className="py-0.5 text-slate-500" colSpan={3} />
              <td className="py-0.5 text-right text-slate-500">Subtotal</td>
              <td className="py-0.5 text-right">{quotation.subtotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td className="py-0.5 text-slate-500" colSpan={3} />
              <td className="py-0.5 text-right text-slate-500">Discounts</td>
              <td className="py-0.5 text-right">-{itemDiscountTotal.toLocaleString("en-IN")}</td>
            </tr>
            {quotation.otherCharges ? (
              <tr>
                <td className="py-0.5 text-slate-500" colSpan={3} />
                <td className="py-0.5 text-right text-slate-500">Freight / Other Charges</td>
                <td className="py-0.5 text-right">{quotation.otherCharges.toLocaleString("en-IN")}</td>
              </tr>
            ) : null}
            <tr>
              <td className="py-0.5 text-slate-500" colSpan={3} />
              <td className="py-0.5 text-right text-slate-500">GST / Tax</td>
              <td className="py-0.5 text-right">{quotation.taxAmount.toLocaleString("en-IN")}</td>
            </tr>
            <tr className="border-t border-slate-900 font-semibold">
              <td colSpan={3} />
              <td className="py-1 text-right">TOTAL AMOUNT</td>
              <td className="py-1 text-right">Rs. {quotation.grandTotal.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-right text-xs italic text-slate-600">
          Amount in Words: INR {amountInWords(quotation.grandTotal)}
        </p>

        {config.dgTermsOfSupply ? (
          <div className="mt-4 text-xs">
            <p className="mb-1 font-semibold">Terms of Supply</p>
            <MultilineList text={config.dgTermsOfSupply} />
          </div>
        ) : null}

        <div className="mt-4 text-xs print:break-inside-avoid">
          <p className="mb-1 font-semibold">Payment Terms -</p>
          {quotation.paymentTerms ? (
            <p className="whitespace-pre-wrap">{quotation.paymentTerms}</p>
          ) : (
            <p className="text-slate-400">-</p>
          )}
        </div>

        <div className="mt-3 text-xs">
          <p className="font-semibold">for {company?.name ?? "Company"}</p>
        </div>
      </LetterheadPage>

      {/* PAGE 4 - Bank details + signature, on its own page from the start
          (see the Solar layout's PROJECT_STATE.md note on why Bank Details
          shouldn't share a page with a full commercial table). */}
      <PageDivider label="Page 4" />
      <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
        <BankDetailsBlock company={company} />
      </LetterheadPage>

      {/* PAGE 5 - Commercial terms & conditions */}
      {commercialClauses.length > 0 || quotation.termsAndConditions ? (
        <>
          <PageDivider label="Page 5" />
          <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
            <SectionBanner>Commercial Terms &amp; Conditions</SectionBanner>
            {commercialClauses.length > 0 ? (
              <div className="space-y-2 text-xs">
                {commercialClauses.map(([label, text]) => (
                  <p key={label}>
                    <span className="font-semibold">{label} - </span>
                    <span className="whitespace-pre-wrap text-slate-700">{text}</span>
                  </p>
                ))}
              </div>
            ) : null}
            {quotation.termsAndConditions ? (
              <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{quotation.termsAndConditions}</p>
            ) : null}
          </LetterheadPage>
        </>
      ) : null}

      {/* PAGE 6 - Warranty terms & conditions (a richer, dedicated annexure - not just
          the single generic warranty field also shown in Technical Details below) */}
      {hasWarrantyAnnexure ? (
        <>
          <PageDivider label="Page 6" />
          <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
            <SectionBanner>Warranty Terms &amp; Conditions</SectionBanner>
            {config.warranty ? (
              <p>
                {config.dgManufacturer ? `${config.dgManufacturer} power` : "The"} generating sets
                come with a warranty of {config.warranty} from the date of installation and
                commissioning.
              </p>
            ) : null}
            {config.dgFreeServiceChecks ? <p className="mt-2">{config.dgFreeServiceChecks}</p> : null}
            {config.dgWarrantyConditions ? (
              <div className="mt-3">
                <p className="mb-1 font-semibold">Standard Conditions</p>
                <MultilineList text={config.dgWarrantyConditions} />
              </div>
            ) : null}
          </LetterheadPage>
        </>
      ) : null}

      {/* PAGE 7 - Technical details */}
      {hasDgSpec || hasRequirements || config.notes ? (
        <>
          <PageDivider label="Page 7" />
          <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
            <SectionBanner>Technical Details</SectionBanner>
            <SpecTable
              title="DG Set Specification"
              rows={[
                ["Manufacturer / Brand", config.dgManufacturer],
                ["Capacity", config.dgCapacityKva ? `${config.dgCapacityKva} kVA` : undefined],
                ["Phase", config.phase],
                ["Emission Norm", config.emissionNorm],
                ["Engine Model", config.dgModel],
                ["Fuel Type", config.fuelType],
                ["Alternator Make", config.alternatorMake],
                ["Cooling Type", config.coolingType],
                ["Control Panel", config.panelType],
                ["Enclosure", config.enclosureType],
                ["Warranty", config.warranty],
              ]}
            />
            {hasRequirements ? (
              <SpecTable
                title="Requirements"
                rows={[
                  ["AMF Requirement", config.amfRequired],
                  ["Synchronization Requirement", config.synchronizationRequired],
                  ["Installation Requirement", config.installationRequired],
                ]}
              />
            ) : null}
            {config.notes ? <p className="mt-2 text-xs text-slate-600">{config.notes}</p> : null}
          </LetterheadPage>
        </>
      ) : null}

      {/* PAGE 8 - Authorized Channel Partner / Dealer Certificate (last page, per the
          reference's own Annexure 8). For Kirloskar, this is the real signed certificate
          image (extracted from the reference document itself) shown full-page and on its
          own, without the Shanvi letterhead wrapper - it's Kirloskar's own official
          document, not Shanvi's, and already carries its own header/signature. For any
          other manufacturer there's no equivalent artwork to show, so it falls back to a
          free-text certifying statement the company can fill in per quotation, on the
          normal letterhead-branded page. */}
      {hasRealKirloskarCertificate ? (
        <>
          <PageDivider label="Page 8" />
          <div
            className="relative flex items-center justify-center print:break-before-page"
            style={{ minHeight: "277mm" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dg-certificate-kirloskar.png"
              alt="Kirloskar Authorized Sales Dealer Certificate"
              className="max-h-[260mm] max-w-full object-contain print:break-inside-avoid"
            />
          </div>
        </>
      ) : hasCertificate ? (
        <>
          <PageDivider label="Page 8" />
          <LetterheadPage company={company} companyAddressLines={companyAddressLines}>
            <SectionBanner>Authorized Channel Partner Certificate</SectionBanner>
            <p className="whitespace-pre-wrap">{config.dgCertificateText}</p>
            {company?.gstin ? <p className="mt-4 text-xs text-slate-600">GSTIN: {company.gstin}</p> : null}
          </LetterheadPage>
        </>
      ) : null}
    </div>
  );
}
