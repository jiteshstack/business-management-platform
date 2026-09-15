"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: FormActionState = {};

export type CompanyProfileDefaults = {
  gstin?: string | null;
  pan?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  tagline?: string | null;
  bankAccountName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
};

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

export function CompanyProfileForm({
  action,
  defaults,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  defaults: CompanyProfileDefaults;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const value = (name: keyof CompanyProfileDefaults): string => {
    const fromState = state.values?.[name as string];
    if (fromState !== undefined) return fromState;
    const fromDefaults = defaults[name];
    return fromDefaults ?? "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Profile</CardTitle>
        <p className="mt-1 text-xs font-normal text-slate-500">
          Used on printed documents (tax invoices, etc.) — GSTIN, registered address, and bank details for
          receiving payments. Leave anything blank you don&apos;t have yet.
        </p>
      </CardHeader>
      <CardContent>
        <form key={state.attempt ?? 0} action={formAction} className="space-y-6">
          {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="tagline" label="Tagline" error={fieldErrors.tagline}>
              <Input
                id="tagline"
                name="tagline"
                defaultValue={value("tagline")}
                placeholder="e.g. Authorized Solar Dealer"
              />
            </Field>
            <Field id="website" label="Website" error={fieldErrors.website}>
              <Input id="website" name="website" defaultValue={value("website")} placeholder="e.g. www.example.com" />
            </Field>
            <Field id="gstin" label="GSTIN" error={fieldErrors.gstin}>
              <Input id="gstin" name="gstin" defaultValue={value("gstin")} placeholder="e.g. 09AAAFJ5441N1Z3" />
            </Field>
            <Field id="pan" label="PAN" error={fieldErrors.pan}>
              <Input id="pan" name="pan" defaultValue={value("pan")} />
            </Field>
            <Field id="phone" label="Phone" error={fieldErrors.phone}>
              <Input id="phone" name="phone" defaultValue={value("phone")} />
            </Field>
            <Field id="email" label="Email" error={fieldErrors.email}>
              <Input id="email" name="email" type="email" defaultValue={value("email")} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="addressLine1" label="Address Line 1" error={fieldErrors.addressLine1}>
                <Input id="addressLine1" name="addressLine1" defaultValue={value("addressLine1")} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="addressLine2" label="Address Line 2" error={fieldErrors.addressLine2}>
                <Input id="addressLine2" name="addressLine2" defaultValue={value("addressLine2")} />
              </Field>
            </div>
            <Field id="city" label="City" error={fieldErrors.city}>
              <Input id="city" name="city" defaultValue={value("city")} />
            </Field>
            <Field id="state" label="State" error={fieldErrors.state}>
              <Input id="state" name="state" defaultValue={value("state")} placeholder="e.g. Uttar Pradesh" />
            </Field>
            <Field id="pincode" label="Pincode" error={fieldErrors.pincode}>
              <Input id="pincode" name="pincode" defaultValue={value("pincode")} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="bankAccountName" label="Bank A/c Holder's Name" error={fieldErrors.bankAccountName}>
              <Input id="bankAccountName" name="bankAccountName" defaultValue={value("bankAccountName")} />
            </Field>
            <Field id="bankName" label="Bank Name" error={fieldErrors.bankName}>
              <Input id="bankName" name="bankName" defaultValue={value("bankName")} />
            </Field>
            <Field id="bankAccountNumber" label="Bank A/c No." error={fieldErrors.bankAccountNumber}>
              <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={value("bankAccountNumber")} />
            </Field>
            <Field id="bankIfsc" label="IFS Code" error={fieldErrors.bankIfsc}>
              <Input id="bankIfsc" name="bankIfsc" defaultValue={value("bankIfsc")} />
            </Field>
          </div>

          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
