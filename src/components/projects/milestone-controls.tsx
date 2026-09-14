"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { FormActionState } from "@/lib/core/form-state";
import { MILESTONE_STATUSES, MILESTONE_STATUS_LABELS } from "@/lib/energy/projects/types";
import { updateMilestoneStatusAction, addMilestoneAction } from "@/lib/energy/projects/actions";

type Milestone = {
  id: string;
  name: string;
  status: string;
  plannedDate: Date | null;
  actualDate: Date | null;
};

export function MilestoneRow({
  projectId,
  milestone,
  canManage,
}: {
  projectId: string;
  milestone: Milestone;
  canManage: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <tr>
      <td className="px-4 py-2.5 font-medium text-slate-900">{milestone.name}</td>
      <td className="px-4 py-2.5 text-slate-600">{milestone.plannedDate ? milestone.plannedDate.toLocaleDateString() : "-"}</td>
      <td className="px-4 py-2.5 text-slate-600">{milestone.actualDate ? milestone.actualDate.toLocaleDateString() : "-"}</td>
      <td className="px-4 py-2.5 text-slate-600">{MILESTONE_STATUS_LABELS[milestone.status as keyof typeof MILESTONE_STATUS_LABELS] ?? milestone.status}</td>
      {canManage ? (
        <td className="px-4 py-2.5">
          <Select
            defaultValue={milestone.status}
            disabled={pending}
            onChange={async (e) => {
              setPending(true);
              try {
                await updateMilestoneStatusAction(projectId, milestone.id, e.target.value);
              } finally {
                setPending(false);
              }
            }}
            className="w-40"
          >
            {MILESTONE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MILESTONE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </td>
      ) : null}
    </tr>
  );
}

const initialState: FormActionState = {};

export function AddMilestoneForm({ projectId }: { projectId: string }) {
  const action = addMilestoneAction.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
      <div>
        <Label htmlFor="milestone-name">Name</Label>
        <Input id="milestone-name" name="name" placeholder="e.g. Grid connection approval" required />
      </div>
      <div>
        <Label htmlFor="milestone-planned">Planned Date</Label>
        <Input id="milestone-planned" name="plannedDate" type="date" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding…" : "Add Milestone"}
      </Button>
    </form>
  );
}
