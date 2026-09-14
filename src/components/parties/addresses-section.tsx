"use client";

import { useActionState, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import type { PartyAddress } from "@prisma/client";
import type { FormActionState } from "@/lib/core/parties/actions";
import { ADDRESS_TYPE_LABELS, ADDRESS_TYPES } from "@/lib/core/parties/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

const initialState: FormActionState = {};

export function AddressesSection({
  addresses,
  addAction,
  deleteAction,
}: {
  addresses: PartyAddress[];
  addAction: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  deleteAction: (addressId: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [state, formAction, isPending] = useActionState(addAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <div className="space-y-4">
      {addresses.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardContent className="py-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={address.type === "BILLING" ? "neutral" : "success"}>
                      {ADDRESS_TYPE_LABELS[address.type as "BILLING" | "SITE"] ?? address.type}
                    </Badge>
                    {address.isDefault ? <Badge variant="warning">Default</Badge> : null}
                  </div>
                  <form
                    action={async () => {
                      await deleteAction(address.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove address"
                      onClick={(event) => {
                        if (!confirm("Remove this address?")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
                {address.label ? (
                  <p className="text-sm font-medium text-slate-900">{address.label}</p>
                ) : null}
                <p className="text-sm text-slate-600">
                  {[address.line1, address.line2, address.city, address.state, address.pincode, address.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !showForm ? (
        <EmptyState
          icon={MapPin}
          title="No addresses yet"
          description="Add a billing address or a client site address."
          action={
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Add address
            </Button>
          }
        />
      ) : null}

      {showForm ? (
        <Card>
          <CardContent className="space-y-4 py-4">
            <form
              key={`${addresses.length}-${state.attempt ?? 0}`}
              action={formAction}
              className="space-y-4"
            >
              {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="address-type">Type</Label>
                  <Select id="address-type" name="type" defaultValue={state.values?.type ?? "SITE"}>
                    {ADDRESS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ADDRESS_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="address-label">Label</Label>
                  <Input
                    id="address-label"
                    name="label"
                    placeholder="e.g. Rooftop Site - Sector 12"
                    defaultValue={state.values?.label}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="address-line1">Address Line 1 *</Label>
                  <Input id="address-line1" name="line1" defaultValue={state.values?.line1} required />
                  {fieldErrors.line1 ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.line1}</p>
                  ) : null}
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="address-line2">Address Line 2</Label>
                  <Input id="address-line2" name="line2" defaultValue={state.values?.line2} />
                </div>
                <div>
                  <Label htmlFor="address-city">City</Label>
                  <Input id="address-city" name="city" defaultValue={state.values?.city} />
                </div>
                <div>
                  <Label htmlFor="address-state">State</Label>
                  <Input id="address-state" name="state" defaultValue={state.values?.state} />
                </div>
                <div>
                  <Label htmlFor="address-pincode">Pincode</Label>
                  <Input id="address-pincode" name="pincode" defaultValue={state.values?.pincode} />
                </div>
                <div>
                  <Label htmlFor="address-country">Country</Label>
                  <Input
                    id="address-country"
                    name="country"
                    defaultValue={state.values?.country ?? "India"}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="address-default"
                  name="isDefault"
                  defaultChecked={state.values?.isDefault === "on"}
                />
                <Label htmlFor="address-default" className="mb-0">
                  Set as default address
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Adding…" : "Add address"}
                </Button>
                {addresses.length > 0 ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Add another address
        </Button>
      )}
    </div>
  );
}
