"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormActionState } from "@/lib/core/parties/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: FormActionState = {};

type PartyFormDefaults = {
  name?: string;
  businessName?: string | null;
  category?: string | null;
  mobile?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  city?: string | null;
  state?: string | null;
  paymentTerms?: string | null;
  isActive?: boolean;
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

export function PartyForm({
  noun,
  mode,
  action,
  defaults,
  cancelHref,
}: {
  noun: string;
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  defaults?: PartyFormDefaults;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  // A failed submission re-renders with a fresh `attempt`, so keying the
  // form by it forces a remount with `value(...)` as the new defaultValue —
  // otherwise React would blank every field after a validation error
  // (it resets uncontrolled inputs once any Server Action submission
  // completes, success or not).
  const value = (name: keyof PartyFormDefaults): string =>
    state.values?.[name] ?? (defaults?.[name] as string | undefined) ?? "";

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-6">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Basic details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="name" label="Name *" error={fieldErrors.name}>
            <Input id="name" name="name" defaultValue={value("name")} required maxLength={200} />
          </Field>
          <Field id="businessName" label="Business / Company Name" error={fieldErrors.businessName}>
            <Input id="businessName" name="businessName" defaultValue={value("businessName")} />
          </Field>
          <Field id="mobile" label="Mobile" error={fieldErrors.mobile}>
            <Input id="mobile" name="mobile" defaultValue={value("mobile")} />
          </Field>
          <Field id="email" label="Email" error={fieldErrors.email}>
            <Input id="email" name="email" type="email" defaultValue={value("email")} />
          </Field>
          <Field id="category" label={`${noun} Category`} error={fieldErrors.category}>
            <Input
              id="category"
              name="category"
              placeholder={noun === "Client" ? "e.g. Residential, Government" : "e.g. Solar Panel Supplier"}
              defaultValue={value("category")}
            />
          </Field>
          <Field id="paymentTerms" label="Payment Terms" error={fieldErrors.paymentTerms}>
            <Input
              id="paymentTerms"
              name="paymentTerms"
              placeholder="e.g. Net 30, 50% advance"
              defaultValue={value("paymentTerms")}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="gstin" label="GSTIN" error={fieldErrors.gstin}>
            <Input
              id="gstin"
              name="gstin"
              defaultValue={value("gstin")}
              className="uppercase"
              maxLength={15}
            />
          </Field>
          <Field id="pan" label="PAN" error={fieldErrors.pan}>
            <Input
              id="pan"
              name="pan"
              defaultValue={value("pan")}
              className="uppercase"
              maxLength={10}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "Billing address" : "City / State"}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mode === "create" ? (
            <>
              <Field id="billingLine1" label="Address Line 1" error={fieldErrors.billingLine1}>
                <Input id="billingLine1" name="billingLine1" defaultValue={state.values?.billingLine1 ?? ""} />
              </Field>
              <Field id="billingLine2" label="Address Line 2" error={fieldErrors.billingLine2}>
                <Input id="billingLine2" name="billingLine2" defaultValue={state.values?.billingLine2 ?? ""} />
              </Field>
            </>
          ) : null}
          <Field id="city" label="City" error={fieldErrors.city}>
            <Input id="city" name="city" defaultValue={value("city")} />
          </Field>
          <Field id="state" label="State" error={fieldErrors.state}>
            <Input id="state" name="state" defaultValue={value("state")} />
          </Field>
          {mode === "create" ? (
            <Field id="billingPincode" label="Pincode" error={fieldErrors.billingPincode}>
              <Input id="billingPincode" name="billingPincode" defaultValue={state.values?.billingPincode ?? ""} />
            </Field>
          ) : (
            <p className="col-span-full text-xs text-slate-500">
              Manage the full billing address and additional site addresses from the Addresses tab.
            </p>
          )}
        </CardContent>
      </Card>

      {mode === "edit" ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-4">
            <Checkbox
              id="isActive"
              name="isActive"
              defaultChecked={
                state.values ? state.values.isActive === "on" : (defaults?.isActive ?? true)
              }
            />
            <Label htmlFor="isActive" className="mb-0">
              Active
            </Label>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? `Create ${noun}` : "Save changes"}
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
