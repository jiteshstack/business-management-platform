"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: FormActionState = {};

export type StockActionFormConfig = {
  submitLabel: string;
  quantityLabel?: string;
  showDirection?: boolean;
  showReference?: boolean;
  showReason?: boolean;
  showSerialNumbers?: boolean;
  helpText?: string;
};

export function StockActionForm({
  action,
  config,
  resetKey,
  onDone,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  config: StockActionFormConfig;
  resetKey: number;
  onDone?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form
      key={`${resetKey}-${state.attempt ?? 0}`}
      action={formAction}
      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {config.helpText ? <p className="text-xs text-slate-500">{config.helpText}</p> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {config.showDirection ? (
          <div>
            <Label htmlFor="direction">Direction</Label>
            <Select id="direction" name="direction" defaultValue={state.values?.direction ?? "INCREASE"}>
              <option value="INCREASE">Increase</option>
              <option value="DECREASE">Decrease</option>
            </Select>
          </div>
        ) : null}

        <div>
          <Label htmlFor="quantity">{config.quantityLabel ?? "Quantity"} *</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            step="any"
            min="0"
            defaultValue={state.values?.quantity}
            required
          />
          {fieldErrors.quantity ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.quantity}</p>
          ) : null}
        </div>

        {config.showReference ? (
          <div>
            <Label htmlFor="reference">Reference</Label>
            <Input
              id="reference"
              name="reference"
              placeholder="e.g. PO number, note"
              defaultValue={state.values?.reference}
            />
          </div>
        ) : null}

        {config.showReason ? (
          <div className="sm:col-span-2">
            <Label htmlFor="reason">Reason *</Label>
            <Input id="reason" name="reason" defaultValue={state.values?.reason} required />
            {fieldErrors.reason ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.reason}</p>
            ) : null}
          </div>
        ) : null}

        {config.showSerialNumbers ? (
          <div className="sm:col-span-2">
            <Label htmlFor="serialNumbers">Serial Numbers (one per line)</Label>
            <Textarea
              id="serialNumbers"
              name="serialNumbers"
              rows={4}
              placeholder={"DG001\nDG002\nDG003"}
              defaultValue={state.values?.serialNumbers}
            />
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={2} defaultValue={state.values?.notes} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : config.submitLabel}
        </Button>
        {onDone ? (
          <Button type="button" variant="secondary" size="sm" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
