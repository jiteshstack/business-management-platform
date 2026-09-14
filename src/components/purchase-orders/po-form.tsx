"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineItemsEditor, computeLineTotal, type ProductOption, type LineItemRow } from "@/components/shared/line-items-editor";

const initialState: FormActionState = {};

export type VendorOption = { id: string; name: string };

type PurchaseOrderFormDefaults = {
  vendorId?: string;
  poDate?: string;
  expectedDeliveryDate?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  termsAndConditions?: string | null;
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

export function PurchaseOrderForm({
  mode,
  action,
  vendors,
  products,
  defaults,
  cancelHref,
}: {
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  vendors: VendorOption[];
  products: ProductOption[];
  defaults?: PurchaseOrderFormDefaults;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const value = (name: string): string => state.values?.[name] ?? "";

  const [vendorId, setVendorId] = useState(defaults?.vendorId ?? state.values?.vendorId ?? "");
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

  const lineTotal = useMemo(() => rows.reduce((sum, row) => sum + computeLineTotal(row), 0), [rows]);

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-6">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Vendor</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="vendorId" label="Vendor *" error={fieldErrors.vendorId}>
            <Select id="vendorId" name="vendorId" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              <option value="">Select a vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="referenceNumber" label="Reference Number" error={fieldErrors.referenceNumber}>
            <Input id="referenceNumber" name="referenceNumber" defaultValue={value("referenceNumber") || defaults?.referenceNumber || ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="poDate" label="PO Date *" error={fieldErrors.poDate}>
            <Input id="poDate" name="poDate" type="date" defaultValue={value("poDate") || defaults?.poDate || todayIso()} required />
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
          <CardTitle>Terms & Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea name="termsAndConditions" rows={4} defaultValue={value("termsAndConditions") || defaults?.termsAndConditions || ""} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Purchase Order" : "Save changes"}
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
