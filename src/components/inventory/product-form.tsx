"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/energy/inventory/types";

const initialState: FormActionState = {};

type Option = { id: string; name: string };

type ProductFormDefaults = {
  code?: string;
  name?: string;
  type?: string;
  categoryId?: string | null;
  brandId?: string | null;
  model?: string | null;
  description?: string | null;
  specifications?: string | null;
  unitId?: string | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  taxRate?: number | null;
  hsnCode?: string | null;
  defaultVendorId?: string | null;
  warrantyMonths?: number | null;
  serialTracked?: boolean;
  stockTracked?: boolean;
  reorderLevel?: number | null;
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

export function ProductForm({
  mode,
  action,
  defaults,
  categories,
  brands,
  units,
  vendors,
  cancelHref,
}: {
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  defaults?: ProductFormDefaults;
  categories: Option[];
  brands: Option[];
  units: Option[];
  vendors: Option[];
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  const [type, setType] = useState<string>(
    state.values?.type ?? defaults?.type ?? "EQUIPMENT"
  );
  const isService = type === "SERVICE";
  const [serialTracked, setSerialTracked] = useState<boolean>(
    state.values ? state.values.serialTracked === "on" : (defaults?.serialTracked ?? false)
  );

  const value = (name: keyof ProductFormDefaults): string => {
    const fromState = state.values?.[name as string];
    if (fromState !== undefined) return fromState;
    const fromDefaults = defaults?.[name];
    return fromDefaults === null || fromDefaults === undefined ? "" : String(fromDefaults);
  };

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
          <Field id="code" label="Product Code / SKU *" error={fieldErrors.code}>
            <Input id="code" name="code" defaultValue={value("code")} required maxLength={50} />
          </Field>
          <Field id="name" label="Product Name *" error={fieldErrors.name}>
            <Input id="name" name="name" defaultValue={value("name")} required maxLength={200} />
          </Field>
          <Field id="type" label="Product Type *" error={fieldErrors.type}>
            <Select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PRODUCT_TYPE_LABELS[t as ProductType]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="categoryId" label="Category" error={fieldErrors.categoryId}>
            <Select id="categoryId" name="categoryId" defaultValue={value("categoryId")}>
              <option value="">-</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="brandId" label="Brand" error={fieldErrors.brandId}>
            <Select id="brandId" name="brandId" defaultValue={value("brandId")}>
              <option value="">-</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="model" label="Model" error={fieldErrors.model}>
            <Input id="model" name="model" defaultValue={value("model")} />
          </Field>
          <Field id="unitId" label="Unit" error={fieldErrors.unitId}>
            <Select id="unitId" name="unitId" defaultValue={value("unitId")}>
              <option value="">-</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="defaultVendorId" label="Default Vendor" error={fieldErrors.defaultVendorId}>
            <Select id="defaultVendorId" name="defaultVendorId" defaultValue={value("defaultVendorId")}>
              <option value="">-</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field id="description" label="Description" error={fieldErrors.description}>
              <Textarea id="description" name="description" rows={2} defaultValue={value("description")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="specifications" label="Specifications" error={fieldErrors.specifications}>
              <Textarea
                id="specifications"
                name="specifications"
                rows={3}
                placeholder="Free-form technical specs"
                defaultValue={value("specifications")}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing, tax & warranty</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="purchasePrice" label="Purchase Price" error={fieldErrors.purchasePrice}>
            <Input id="purchasePrice" name="purchasePrice" type="number" step="any" min="0" defaultValue={value("purchasePrice")} />
          </Field>
          <Field id="sellingPrice" label="Selling Price" error={fieldErrors.sellingPrice}>
            <Input id="sellingPrice" name="sellingPrice" type="number" step="any" min="0" defaultValue={value("sellingPrice")} />
          </Field>
          <Field id="taxRate" label="Tax / GST Rate (%)" error={fieldErrors.taxRate}>
            <Input id="taxRate" name="taxRate" type="number" step="any" min="0" max="100" defaultValue={value("taxRate")} />
          </Field>
          <Field id="warrantyMonths" label="Warranty (months)" error={fieldErrors.warrantyMonths}>
            <Input id="warrantyMonths" name="warrantyMonths" type="number" step="1" min="0" defaultValue={value("warrantyMonths")} />
          </Field>
          <Field id="hsnCode" label="HSN / SAC Code" error={fieldErrors.hsnCode}>
            <Input id="hsnCode" name="hsnCode" defaultValue={value("hsnCode")} placeholder="e.g. 85021100" />
          </Field>
        </CardContent>
      </Card>

      {!isService ? (
        <Card>
          <CardHeader>
            <CardTitle>Inventory tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="serialTracked"
                name="serialTracked"
                checked={serialTracked}
                onChange={(e) => setSerialTracked(e.target.checked)}
              />
              <Label htmlFor="serialTracked" className="mb-0">
                Track individual serial numbers
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="stockTracked"
                name="stockTracked"
                defaultChecked={
                  serialTracked || (state.values ? state.values.stockTracked === "on" : (defaults?.stockTracked ?? true))
                }
                disabled={serialTracked}
                key={serialTracked ? "forced-on" : "toggleable"}
              />
              <Label htmlFor="stockTracked" className="mb-0">
                Track stock quantity{serialTracked ? " (required when serial tracking is on)" : ""}
              </Label>
            </div>
            <Field id="reorderLevel" label="Reorder Level" error={fieldErrors.reorderLevel}>
              <Input id="reorderLevel" name="reorderLevel" type="number" step="any" min="0" defaultValue={value("reorderLevel")} className="max-w-xs" />
            </Field>
          </CardContent>
        </Card>
      ) : (
        <p className="text-xs text-slate-500">
          Service products don&apos;t track physical stock or serial numbers.
        </p>
      )}

      {mode === "edit" ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-4">
            <Checkbox
              id="isActive"
              name="isActive"
              defaultChecked={state.values ? state.values.isActive === "on" : (defaults?.isActive ?? true)}
            />
            <Label htmlFor="isActive" className="mb-0">
              Active
            </Label>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Product" : "Save changes"}
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
