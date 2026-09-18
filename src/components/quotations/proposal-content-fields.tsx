"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProposalContentValues } from "@/lib/energy/quotations/proposal-content";

export type { ProposalContentValues };

function Field({ id, label, rows, value, onChange }: { id: string; label: string; rows: number; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</p>;
}

// Shared by Settings -> Company (company-wide defaults) and the Quotation
// form (per-quotation override, seeded from those defaults at creation
// time) — same field set either way, just a different hidden-input name and
// a different snapshot target on save.
export function ProposalContentFields({
  hiddenFieldName,
  initialValues,
}: {
  hiddenFieldName: string;
  initialValues?: ProposalContentValues;
}) {
  const [values, setValues] = useState<ProposalContentValues>(initialValues ?? {});
  const set = (key: keyof ProposalContentValues) => (value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5">
      <input type="hidden" name={hiddenFieldName} value={JSON.stringify(values)} readOnly />

      <div>
        <SectionHeading>Company Introduction</SectionHeading>
        <div className="mt-2">
          <Field id="introduction" label="Introduction paragraph(s)" rows={4} value={values.introduction ?? ""} onChange={set("introduction")} />
        </div>
      </div>

      <div>
        <SectionHeading>Corporate Philosophy</SectionHeading>
        <div className="mt-2 grid grid-cols-1 gap-4">
          <Field id="vision" label="Vision" rows={2} value={values.vision ?? ""} onChange={set("vision")} />
          <Field id="mission" label="Mission" rows={2} value={values.mission ?? ""} onChange={set("mission")} />
          <Field id="philosophy" label="How We Perceive Ourselves" rows={3} value={values.philosophy ?? ""} onChange={set("philosophy")} />
        </div>
      </div>

      <div>
        <SectionHeading>Standard Clauses</SectionHeading>
        <div className="mt-2 grid grid-cols-1 gap-4">
          <Field id="deliveryTerms" label="Delivery" rows={2} value={values.deliveryTerms ?? ""} onChange={set("deliveryTerms")} />
          <Field id="inspectionTerms" label="Inspection" rows={2} value={values.inspectionTerms ?? ""} onChange={set("inspectionTerms")} />
          <Field id="cancellationTerms" label="Cancellation" rows={2} value={values.cancellationTerms ?? ""} onChange={set("cancellationTerms")} />
          <Field id="demurrageTerms" label="Demurrage" rows={2} value={values.demurrageTerms ?? ""} onChange={set("demurrageTerms")} />
          <Field id="warrantyClause" label="Warranty" rows={2} value={values.warrantyClause ?? ""} onChange={set("warrantyClause")} />
          <Field id="forceMajeureTerms" label="Force Majeure" rows={2} value={values.forceMajeureTerms ?? ""} onChange={set("forceMajeureTerms")} />
        </div>
      </div>
    </div>
  );
}
