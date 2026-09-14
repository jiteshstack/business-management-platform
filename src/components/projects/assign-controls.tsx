"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { assignProjectItemQuantityAction, assignSerialToProjectAction, unassignSerialFromProjectAction } from "@/lib/energy/projects/actions";

export function AssignQuantityForm({ projectId, projectItemId, max }: { projectId: string; projectItemId: string; max: number }) {
  const [quantity, setQuantity] = useState(String(max));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex items-center gap-2"
      action={() => {
        setError(null);
        startTransition(async () => {
          const formData = new FormData();
          formData.set("quantity", quantity);
          try {
            await assignProjectItemQuantityAction(projectId, projectItemId, formData);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not assign.");
          }
        });
      }}
    >
      <Input
        type="number"
        min="1"
        max={max}
        step="any"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="w-20"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {isPending ? "Assigning…" : "Assign"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </form>
  );
}

export function AssignSerialForm({
  projectId,
  projectItemId,
  options,
}: {
  projectId: string;
  projectItemId: string;
  options: { id: string; serialNumber: string }[];
}) {
  const [serialId, setSerialId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) {
    return <span className="text-xs text-slate-400">No available serials in stock.</span>;
  }

  return (
    <form
      className="flex items-center gap-2"
      action={() => {
        if (!serialId) return;
        setError(null);
        startTransition(async () => {
          try {
            await assignSerialToProjectAction(projectId, projectItemId, serialId);
            setSerialId("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not assign.");
          }
        });
      }}
    >
      <Select value={serialId} onChange={(e) => setSerialId(e.target.value)} className="w-40">
        <option value="">Select serial…</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.serialNumber}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending || !serialId}>
        {isPending ? "Assigning…" : "Assign"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </form>
  );
}

export function UnassignSerialButton({ projectId, serialId }: { projectId: string; serialId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() => startTransition(() => unassignSerialFromProjectAction(projectId, serialId))}
    >
      {isPending ? "Removing…" : "Unassign"}
    </Button>
  );
}
