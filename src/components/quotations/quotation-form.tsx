"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QUOTATION_TYPES, QUOTATION_TYPE_LABELS, type QuotationType } from "@/lib/energy/quotations/types";
import { LineItemsEditor, computeLineTotal, type ProductOption, type LineItemRow } from "@/components/shared/line-items-editor";
import { TechnicalConfigSection } from "./technical-config-section";
import { ProposalContentFields, type ProposalContentValues } from "./proposal-content-fields";

const initialState: FormActionState = {};

export type ClientOption = {
  id: string;
  name: string;
  addresses: { id: string; label: string | null; line1: string; city: string | null }[];
};

type QuotationFormDefaults = {
  clientId?: string;
  siteAddressId?: string | null;
  type?: string;
  quotationDate?: string;
  validUntil?: string | null;
  salespersonId?: string | null;
  reference?: string | null;
  subject?: string | null;
  notes?: string | null;
  paymentTerms?: string | null;
  equipmentWarranty?: string | null;
  installationWarranty?: string | null;
  deliveryTimeline?: string | null;
  installationTimeline?: string | null;
  termsAndConditions?: string | null;
  discountPercent?: number | null;
  otherCharges?: number | null;
  technicalConfig?: Record<string, string>;
  proposalContent?: ProposalContentValues;
  items?: LineItemRow[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function QuotationForm({
  mode,
  action,
  clients,
  products,
  salespeople,
  defaults,
  companyDefaultTerms,
  companyProposalContent,
  cancelHref,
}: {
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  clients: ClientOption[];
  products: ProductOption[];
  salespeople: { id: string; name: string }[];
  defaults?: QuotationFormDefaults;
  companyDefaultTerms?: string | null;
  companyProposalContent?: ProposalContentValues;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  const value = (name: string): string => state.values?.[name] ?? "";

  const [clientId, setClientId] = useState(defaults?.clientId ?? state.values?.clientId ?? "");
  const [type, setType] = useState<QuotationType>(
    (state.values?.type as QuotationType) ?? (defaults?.type as QuotationType) ?? "EQUIPMENT_SUPPLY"
  );
  const [rows, setRows] = useState<LineItemRow[]>(
    defaults?.items ??
      (() => {
        try {
          return state.values?.items ? JSON.parse(state.values.items) : undefined;
        } catch {
          return undefined;
        }
      })() ??
      []
  );

  const selectedClient = clients.find((c) => c.id === clientId);

  const lineTotal = useMemo(() => rows.reduce((sum, row) => sum + computeLineTotal(row), 0), [rows]);

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-6">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Client & Site</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="clientId" label="Client *" error={fieldErrors.clientId}>
            <Select
              id="clientId"
              name="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="siteAddressId" label="Site Address" error={fieldErrors.siteAddressId}>
            <Select id="siteAddressId" name="siteAddressId" defaultValue={value("siteAddressId") || defaults?.siteAddressId || ""}>
              <option value="">No specific site</option>
              {selectedClient?.addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ?? a.line1} {a.city ? `(${a.city})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotation Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="type" label="Quotation Type *" error={fieldErrors.type}>
            <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as QuotationType)}>
              {QUOTATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUOTATION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="salespersonId" label="Salesperson" error={fieldErrors.salespersonId}>
            <Select id="salespersonId" name="salespersonId" defaultValue={value("salespersonId") || defaults?.salespersonId || ""}>
              <option value="">-</option>
              {salespeople.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="quotationDate" label="Quotation Date *" error={fieldErrors.quotationDate}>
            <Input
              id="quotationDate"
              name="quotationDate"
              type="date"
              defaultValue={value("quotationDate") || defaults?.quotationDate || todayIso()}
              required
            />
          </Field>
          <Field id="validUntil" label="Valid Until" error={fieldErrors.validUntil}>
            <Input id="validUntil" name="validUntil" type="date" defaultValue={value("validUntil") || defaults?.validUntil || ""} />
          </Field>
          <Field id="reference" label="Reference" error={fieldErrors.reference}>
            <Input id="reference" name="reference" defaultValue={value("reference") || defaults?.reference || ""} />
          </Field>
          <Field id="subject" label="Subject / Title" error={fieldErrors.subject}>
            <Input id="subject" name="subject" defaultValue={value("subject") || defaults?.subject || ""} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="notes" label="Notes" error={fieldErrors.notes}>
              <Textarea id="notes" name="notes" rows={2} defaultValue={value("notes") || defaults?.notes || ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <LineItemsEditorControlled
            products={products}
            rows={rows}
            onChange={setRows}
            error={fieldErrors.items}
          />
        </CardContent>
      </Card>

      <TechnicalConfigCard type={type} initialConfig={defaults?.technicalConfig} />

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="discountPercent" label="Overall Discount (%)" error={fieldErrors.discountPercent}>
            <Input
              id="discountPercent"
              name="discountPercent"
              type="number"
              min="0"
              max="100"
              step="any"
              defaultValue={value("discountPercent") || String(defaults?.discountPercent ?? "")}
            />
          </Field>
          <Field id="otherCharges" label="Other Charges (₹)" error={fieldErrors.otherCharges}>
            <Input
              id="otherCharges"
              name="otherCharges"
              type="number"
              min="0"
              step="any"
              defaultValue={value("otherCharges") || String(defaults?.otherCharges ?? "")}
            />
          </Field>
          <p className="sm:col-span-2 text-sm text-slate-500">
            Items subtotal (before overall discount/charges):{" "}
            <span className="font-medium text-slate-900">
              ₹{lineTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>{" "}
            - the final grand total is calculated after saving.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment, Warranty & Delivery</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="paymentTerms" label="Payment Terms" error={fieldErrors.paymentTerms}>
            <Input
              id="paymentTerms"
              name="paymentTerms"
              placeholder="e.g. 50% advance, 50% on completion"
              defaultValue={value("paymentTerms") || defaults?.paymentTerms || ""}
            />
          </Field>
          <Field id="equipmentWarranty" label="Equipment Warranty" error={fieldErrors.equipmentWarranty}>
            <Input id="equipmentWarranty" name="equipmentWarranty" defaultValue={value("equipmentWarranty") || defaults?.equipmentWarranty || ""} />
          </Field>
          <Field id="installationWarranty" label="Installation Warranty" error={fieldErrors.installationWarranty}>
            <Input id="installationWarranty" name="installationWarranty" defaultValue={value("installationWarranty") || defaults?.installationWarranty || ""} />
          </Field>
          <Field id="deliveryTimeline" label="Delivery Timeline" error={fieldErrors.deliveryTimeline}>
            <Input id="deliveryTimeline" name="deliveryTimeline" defaultValue={value("deliveryTimeline") || defaults?.deliveryTimeline || ""} />
          </Field>
          <Field id="installationTimeline" label="Installation Timeline" error={fieldErrors.installationTimeline}>
            <Input id="installationTimeline" name="installationTimeline" defaultValue={value("installationTimeline") || defaults?.installationTimeline || ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proposal Content</CardTitle>
          <p className="mt-1 text-xs font-normal text-slate-500">
            Company introduction, corporate philosophy, and standard clauses shown on the printed quotation.
            Pre-filled from Settings and editable per quotation.
          </p>
        </CardHeader>
        <CardContent>
          <ProposalContentFields
            hiddenFieldName="proposalContentJson"
            initialValues={defaults?.proposalContent ?? companyProposalContent}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terms & Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            name="termsAndConditions"
            rows={5}
            defaultValue={value("termsAndConditions") || defaults?.termsAndConditions || companyDefaultTerms || ""}
          />
          <p className="mt-1 text-xs text-slate-400">
            Saved as part of this quotation - changing the default later won&apos;t affect it.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Quotation" : "Save changes"}
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}

function TechnicalConfigCard({ type, initialConfig }: { type: QuotationType; initialConfig?: Record<string, string> }) {
  const content = <TechnicalConfigSection type={type} initialConfig={initialConfig} />;
  if (!content) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Technical Configuration</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// A thin controlled wrapper so QuotationForm can read row totals for the
// pricing preview while LineItemsEditor keeps owning the row-editing UI.
function LineItemsEditorControlled({
  products,
  rows,
  onChange,
  error,
}: {
  products: ProductOption[];
  rows: LineItemRow[];
  onChange: (rows: LineItemRow[]) => void;
  error?: string;
}) {
  return <LineItemsEditor products={products} initialRows={rows.length > 0 ? rows : undefined} error={error} onRowsChange={onChange} />;
}
