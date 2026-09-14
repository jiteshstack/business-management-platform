// Centralized, server-side pricing math shared by Quotations, Sales Orders,
// and Invoices — one calculation implementation, not three. The browser
// only ever sends raw inputs (quantity, unit price, discount %, tax %);
// every total shown anywhere (list, detail, PDF) is recomputed here, never
// trusted from the client.

// Exported for reuse anywhere money is summed/rounded (e.g. Payments,
// Receivables) so every module rounds the same way instead of re-deriving
// its own float rounding.
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type LineItemInput = {
  quantity: number;
  unitPrice: number;
  discountPercent?: number | null;
  taxRate?: number | null;
};

export type LineItemTotals = {
  lineSubtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
};

export function calculateLineItem(item: LineItemInput): LineItemTotals {
  const lineSubtotal = round2(item.quantity * item.unitPrice);
  const discountAmount = item.discountPercent
    ? round2(lineSubtotal * (item.discountPercent / 100))
    : 0;
  const taxableBase = lineSubtotal - discountAmount;
  const taxAmount = item.taxRate ? round2(taxableBase * (item.taxRate / 100)) : 0;
  const lineTotal = round2(taxableBase + taxAmount);

  return { lineSubtotal, discountAmount, taxAmount, lineTotal };
}

export type DocumentTotals = {
  subtotal: number;
  itemDiscountTotal: number;
  taxableAmount: number;
  taxAmount: number;
  discountAmount: number;
  otherCharges: number;
  grandTotal: number;
};

export function calculateDocumentTotals(
  items: LineItemInput[],
  overallDiscountPercent?: number | null,
  otherCharges?: number | null
): DocumentTotals {
  const lineTotals = items.map(calculateLineItem);

  const subtotal = round2(lineTotals.reduce((sum, l) => sum + l.lineSubtotal, 0));
  const itemDiscountTotal = round2(lineTotals.reduce((sum, l) => sum + l.discountAmount, 0));
  const taxableAmount = round2(subtotal - itemDiscountTotal);
  const taxAmount = round2(lineTotals.reduce((sum, l) => sum + l.taxAmount, 0));
  const discountAmount = overallDiscountPercent
    ? round2(taxableAmount * (overallDiscountPercent / 100))
    : 0;
  const charges = otherCharges ?? 0;
  const grandTotal = round2(taxableAmount + taxAmount - discountAmount + charges);

  return { subtotal, itemDiscountTotal, taxableAmount, taxAmount, discountAmount, otherCharges: charges, grandTotal };
}
