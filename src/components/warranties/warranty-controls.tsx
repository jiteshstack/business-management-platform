"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelWarrantyAction } from "@/lib/energy/warranties/actions";

export function CancelWarrantyButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="danger"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Cancel this warranty?")) return;
        startTransition(() => cancelWarrantyAction(id));
      }}
    >
      {isPending ? "Cancelling…" : "Cancel"}
    </Button>
  );
}
