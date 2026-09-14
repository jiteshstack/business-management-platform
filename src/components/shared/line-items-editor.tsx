"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type ProductOption = {
  id: string;
  name: string;
  code: string;
  unitName: string | null;
  sellingPrice: number | null;
  taxRate: number | null;
};

export type LineItemRow = {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxRate: string;
};

function emptyRow(): LineItemRow {
  return {
    key: Math.random().toString(36).slice(2),
    productId: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    discountPercent: "",
    taxRate: "",
  };
}

function computeLineTotal(row: LineItemRow): number {
  const qty = Number(row.quantity) || 0;
  const rate = Number(row.unitPrice) || 0;
  const subtotal = qty * rate;
  const discount = row.discountPercent ? subtotal * (Number(row.discountPercent) / 100) : 0;
  const taxable = subtotal - discount;
  const tax = row.taxRate ? taxable * (Number(row.taxRate) / 100) : 0;
  return taxable + tax;
}

export function LineItemsEditor({
  products,
  initialRows,
  error,
  onRowsChange,
}: {
  products: ProductOption[];
  initialRows?: LineItemRow[];
  error?: string;
  onRowsChange?: (rows: LineItemRow[]) => void;
}) {
  const [rows, setRows] = useState<LineItemRow[]>(initialRows && initialRows.length > 0 ? initialRows : [emptyRow()]);

  useEffect(() => {
    onRowsChange?.(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function updateRow(key: string, patch: Partial<LineItemRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handleProductChange(key: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateRow(key, {
      productId,
      unitPrice: product?.sellingPrice != null ? String(product.sellingPrice) : "",
      taxRate: product?.taxRate != null ? String(product.taxRate) : "",
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  const serialized = JSON.stringify(
    rows.map((row) => ({
      productId: row.productId,
      description: row.description || undefined,
      quantity: Number(row.quantity) || 0,
      unitPrice: Number(row.unitPrice) || 0,
      discountPercent: row.discountPercent ? Number(row.discountPercent) : undefined,
      taxRate: row.taxRate ? Number(row.taxRate) : undefined,
    }))
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name="items" value={serialized} readOnly />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Product / Service</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 w-24">Qty</th>
              <th className="px-3 py-2 w-28">Rate</th>
              <th className="px-3 py-2 w-24">Disc %</th>
              <th className="px-3 py-2 w-24">Tax %</th>
              <th className="px-3 py-2 w-28">Amount</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-2 align-top">
                  <Select
                    value={row.productId}
                    onChange={(e) => handleProductChange(row.key, e.target.value)}
                    className="min-w-[180px]"
                  >
                    <option value="">Select…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    value={row.description}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    placeholder="Optional"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={row.discountPercent}
                    onChange={(e) => updateRow(row.key, { discountPercent: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={row.taxRate}
                    onChange={(e) => updateRow(row.key, { taxRate: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 align-top pt-4 text-right font-medium text-slate-700">
                  ₹{computeLineTotal(row).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 align-top pt-3">
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="secondary" size="sm" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Add item
      </Button>
    </div>
  );
}

export { computeLineTotal };
