// Plain (non-"use client") home for the ProposalContentValues shape and its
// parser, so server components (Settings, Quotation create/edit/print views)
// can call parseProposalContent() directly — a function exported from a
// "use client" module can only be used as a component/prop from a server
// component, never invoked directly.
export type ProposalContentValues = {
  introduction?: string;
  vision?: string;
  mission?: string;
  philosophy?: string;
  deliveryTerms?: string;
  inspectionTerms?: string;
  cancellationTerms?: string;
  demurrageTerms?: string;
  warrantyClause?: string;
  forceMajeureTerms?: string;
};

export function parseProposalContent(json: string | null | undefined): ProposalContentValues {
  if (!json) return {};
  try {
    return JSON.parse(json) as ProposalContentValues;
  } catch {
    return {};
  }
}
