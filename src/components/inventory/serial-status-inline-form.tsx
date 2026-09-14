"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SERIAL_STATUSES, SERIAL_STATUS_LABELS } from "@/lib/energy/inventory/types";

const initialState: FormActionState = {};

export function SerialStatusInlineForm({
  serialId,
  currentStatus,
  updateStatusAction,
}: {
  serialId: string;
  currentStatus: string;
  updateStatusAction: (
    serialId: string,
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
}) {
  const [state, formAction, isPending] = useActionState(
    updateStatusAction.bind(null, serialId),
    initialState
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Select name="status" defaultValue={currentStatus} className="h-8 w-40 text-xs">
        {SERIAL_STATUSES.map((status) => (
          <option key={status} value={status}>
            {SERIAL_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {isPending ? "…" : "Save"}
      </Button>
      {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}
