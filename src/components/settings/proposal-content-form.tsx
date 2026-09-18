"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProposalContentFields, type ProposalContentValues } from "@/components/quotations/proposal-content-fields";

const initialState: FormActionState = {};

export function ProposalContentForm({
  action,
  defaultValues,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  defaultValues: ProposalContentValues;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposal Content (Quotations)</CardTitle>
        <p className="mt-1 text-xs font-normal text-slate-500">
          Company introduction, corporate philosophy, and standard clauses shown on Quotation print-outs. Each
          quotation copies this at creation time and can be edited per-quotation from then on - changing it here
          never rewrites an existing quotation.
        </p>
      </CardHeader>
      <CardContent>
        <form key={state.attempt ?? 0} action={formAction} className="space-y-4">
          {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
          <ProposalContentFields hiddenFieldName="proposalContentJson" initialValues={defaultValues} />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
