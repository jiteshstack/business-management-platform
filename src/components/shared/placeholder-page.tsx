import { Construction } from "lucide-react";
import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";

// Used by every module page in Phase 1. Business logic (tables, forms,
// filters) replaces the EmptyState in the phase that implements that module.
export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Construction}
        title="Not built yet"
        description="This module is planned for a later phase and is not implemented yet."
      />
    </div>
  );
}
