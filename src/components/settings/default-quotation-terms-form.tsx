"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: FormActionState = {};

export function DefaultQuotationTermsForm({
  action,
  defaultValue,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  defaultValue: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Quotation Terms</CardTitle>
        <p className="mt-1 text-xs font-normal text-slate-500">
          Pre-fills new quotations. Each quotation saves its own copy, so editing this later never changes
          quotations already created.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          <Textarea name="defaultQuotationTerms" rows={6} defaultValue={defaultValue} />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
