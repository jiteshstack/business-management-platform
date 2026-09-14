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

const initialState: FormActionState = {};

export type CustomerOption = { id: string; name: string };

type SiteFormDefaults = {
  customerId?: string;
  name?: string;
  line1?: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  landmark?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
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

export function ProjectSiteForm({
  mode,
  action,
  customers,
  defaults,
  cancelHref,
  lockCustomer,
}: {
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  customers: CustomerOption[];
  defaults?: SiteFormDefaults;
  cancelHref: string;
  lockCustomer?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const value = (name: string): string => state.values?.[name] ?? "";
  const [customerId, setCustomerId] = useState(defaults?.customerId ?? state.values?.customerId ?? "");

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-6">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Customer & Site</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="customerId" label="Customer *" error={fieldErrors.customerId}>
            {lockCustomer ? (
              <>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {customers.find((c) => c.id === customerId)?.name ?? "-"}
                </p>
                <input type="hidden" name="customerId" value={customerId} />
              </>
            ) : (
              <Select id="customerId" name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="name" label="Site Name *" error={fieldErrors.name}>
            <Input id="name" name="name" defaultValue={value("name") || defaults?.name || ""} required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="line1" label="Address Line 1 *" error={fieldErrors.line1}>
              <Input id="line1" name="line1" defaultValue={value("line1") || defaults?.line1 || ""} required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="line2" label="Address Line 2" error={fieldErrors.line2}>
              <Input id="line2" name="line2" defaultValue={value("line2") || defaults?.line2 || ""} />
            </Field>
          </div>
          <Field id="city" label="City" error={fieldErrors.city}>
            <Input id="city" name="city" defaultValue={value("city") || defaults?.city || ""} />
          </Field>
          <Field id="state" label="State" error={fieldErrors.state}>
            <Input id="state" name="state" defaultValue={value("state") || defaults?.state || ""} />
          </Field>
          <Field id="pincode" label="PIN Code" error={fieldErrors.pincode}>
            <Input id="pincode" name="pincode" defaultValue={value("pincode") || defaults?.pincode || ""} />
          </Field>
          <Field id="landmark" label="Landmark" error={fieldErrors.landmark}>
            <Input id="landmark" name="landmark" defaultValue={value("landmark") || defaults?.landmark || ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="contactPerson" label="Contact Person" error={fieldErrors.contactPerson}>
            <Input id="contactPerson" name="contactPerson" defaultValue={value("contactPerson") || defaults?.contactPerson || ""} />
          </Field>
          <Field id="contactPhone" label="Contact Phone" error={fieldErrors.contactPhone}>
            <Input id="contactPhone" name="contactPhone" defaultValue={value("contactPhone") || defaults?.contactPhone || ""} />
          </Field>
          <Field id="contactEmail" label="Contact Email" error={fieldErrors.contactEmail}>
            <Input id="contactEmail" name="contactEmail" defaultValue={value("contactEmail") || defaults?.contactEmail || ""} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="notes" label="Notes" error={fieldErrors.notes}>
              <Textarea id="notes" name="notes" rows={2} defaultValue={value("notes") || defaults?.notes || ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Site" : "Save changes"}
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
