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
import { LineItemsEditor, computeLineTotal, type ProductOption, type LineItemRow } from "@/components/shared/line-items-editor";

const initialState: FormActionState = {};

export type ClientOption = {
  id: string;
  name: string;
  sites: { id: string; name: string; city: string | null }[];
  addresses: { id: string; label: string | null; line1: string; city: string | null }[];
};

type SalesOrderFormDefaults = {
  clientId?: string;
  // "site:<ProjectSite id>" | "address:<PartyAddress id>" | undefined
  siteSelection?: string | null;
  orderDate?: string;
  expectedDeliveryDate?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  discountPercent?: number | null;
  otherCharges?: number | null;
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

export function SalesOrderForm({
  mode,
  action,
  clients,
  products,
  defaults,
  cancelHref,
}: {
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  clients: ClientOption[];
  products: ProductOption[];
  defaults?: SalesOrderFormDefaults;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  const value = (name: string): string => state.values?.[name] ?? "";

  const [clientId, setClientId] = useState(defaults?.clientId ?? state.values?.clientId ?? "");
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
          <Field id="siteSelection" label="Site Address" error={fieldErrors.siteSelection}>
            <Select
              id="siteSelection"
              name="siteSelection"
              defaultValue={value("siteSelection") || defaults?.siteSelection || ""}
            >
              <option value="">No specific site</option>
              {selectedClient?.sites.length ? (
                <optgroup label="Sites">
                  {selectedClient.sites.map((s) => (
                    <option key={s.id} value={`site:${s.id}`}>
                      {s.name} {s.city ? `(${s.city})` : ""}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {selectedClient?.addresses.length ? (
                <optgroup label="Other addresses">
                  {selectedClient.addresses.map((a) => (
                    <option key={a.id} value={`address:${a.id}`}>
                      {a.label ?? a.line1} {a.city ? `(${a.city})` : ""}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="orderDate" label="Order Date *" error={fieldErrors.orderDate}>
            <Input
              id="orderDate"
              name="orderDate"
              type="date"
              defaultValue={value("orderDate") || defaults?.orderDate || todayIso()}
              required
            />
          </Field>
          <Field id="expectedDeliveryDate" label="Expected Delivery Date" error={fieldErrors.expectedDeliveryDate}>
            <Input
              id="expectedDeliveryDate"
              name="expectedDeliveryDate"
              type="date"
              defaultValue={value("expectedDeliveryDate") || defaults?.expectedDeliveryDate || ""}
            />
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
          <LineItemsEditorControlled products={products} rows={rows} onChange={setRows} error={fieldErrors.items} />
        </CardContent>
      </Card>

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
          <CardTitle>Payment Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <Field id="paymentTerms" label="Payment Terms" error={fieldErrors.paymentTerms}>
            <Input
              id="paymentTerms"
              name="paymentTerms"
              placeholder="e.g. 50% advance, 50% on delivery"
              defaultValue={value("paymentTerms") || defaults?.paymentTerms || ""}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Sales Order" : "Save changes"}
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

// A thin controlled wrapper so SalesOrderForm can read row totals for the
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
