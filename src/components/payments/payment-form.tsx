"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_MODES, PAYMENT_MODE_LABELS, type PaymentMode } from "@/lib/energy/payments/types";
import { createPaymentAction } from "@/lib/energy/payments/actions";

const initialState: FormActionState = {};

export type ClientOption = {
  id: string;
  name: string;
  invoices: { id: string; invoiceNumber: string; outstandingAmount: number }[];
};

// When arriving from an Invoice detail page's "Record Payment" button, the
// client + invoice are already known and locked — the user only fills in
// the actual payment details.
export type PresetInvoice = {
  id: string;
  invoiceNumber: string;
  outstandingAmount: number;
  clientId: string;
  clientName: string;
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

export function PaymentForm({
  clients,
  presetInvoice,
  cancelHref,
}: {
  clients: ClientOption[];
  presetInvoice?: PresetInvoice;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(createPaymentAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const value = (name: string): string => state.values?.[name] ?? "";

  const [clientId, setClientId] = useState(presetInvoice?.clientId ?? state.values?.clientId ?? "");
  const [invoiceId, setInvoiceId] = useState(presetInvoice?.id ?? state.values?.invoiceId ?? "");
  const [mode, setMode] = useState<PaymentMode>((state.values?.mode as PaymentMode) ?? "BANK_TRANSFER");

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-6">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Client & Invoice</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {presetInvoice ? (
            <>
              <div>
                <Label>Client</Label>
                <p className="mt-1 text-sm font-medium text-slate-900">{presetInvoice.clientName}</p>
                <input type="hidden" name="clientId" value={presetInvoice.clientId} />
              </div>
              <div>
                <Label>Invoice</Label>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {presetInvoice.invoiceNumber} - Outstanding ₹{presetInvoice.outstandingAmount.toLocaleString("en-IN")}
                </p>
                <input type="hidden" name="invoiceId" value={presetInvoice.id} />
              </div>
            </>
          ) : (
            <>
              <Field id="clientId" label="Client *" error={fieldErrors.clientId}>
                <Select
                  id="clientId"
                  name="clientId"
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setInvoiceId("");
                  }}
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
              <Field id="invoiceId" label="Allocate to Invoice (optional)" error={fieldErrors.invoiceId}>
                <Select id="invoiceId" name="invoiceId" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                  <option value="">Leave unallocated (advance)</option>
                  {selectedClient?.invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - Outstanding ₹{inv.outstandingAmount.toLocaleString("en-IN")}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-slate-400">
                  Leave blank to record this as an unallocated payment / customer advance - you can allocate it to
                  one or more invoices later from the payment&apos;s detail page.
                </p>
              </Field>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="amount" label="Amount (₹) *" error={fieldErrors.amount}>
            <Input
              id="amount"
              name="amount"
              type="number"
              min="0.01"
              step="any"
              defaultValue={value("amount") || (presetInvoice ? String(presetInvoice.outstandingAmount) : "")}
              required
            />
          </Field>
          <Field id="paymentDate" label="Payment Date *" error={fieldErrors.paymentDate}>
            <Input id="paymentDate" name="paymentDate" type="date" defaultValue={value("paymentDate") || todayIso()} required />
          </Field>
          <Field id="mode" label="Payment Mode *" error={fieldErrors.mode}>
            <Select id="mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="referenceNumber" label="Reference Number" error={fieldErrors.referenceNumber}>
            <Input id="referenceNumber" name="referenceNumber" defaultValue={value("referenceNumber")} placeholder="UTR / transaction ID" />
          </Field>

          {mode === "CHEQUE" ? (
            <>
              <Field id="chequeNumber" label="Cheque Number" error={fieldErrors.chequeNumber}>
                <Input id="chequeNumber" name="chequeNumber" defaultValue={value("chequeNumber")} />
              </Field>
              <Field id="chequeDate" label="Cheque Date" error={fieldErrors.chequeDate}>
                <Input id="chequeDate" name="chequeDate" type="date" defaultValue={value("chequeDate")} />
              </Field>
              <Field id="bankName" label="Bank Name" error={fieldErrors.bankName}>
                <Input id="bankName" name="bankName" defaultValue={value("bankName")} />
              </Field>
            </>
          ) : null}

          <div className="sm:col-span-2">
            <Field id="notes" label="Notes" error={fieldErrors.notes}>
              <Textarea id="notes" name="notes" rows={2} defaultValue={value("notes")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Record Payment"}
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
