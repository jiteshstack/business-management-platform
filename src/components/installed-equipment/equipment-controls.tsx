"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";
import { setEquipmentStatusAction } from "@/lib/energy/installed-equipment/actions";
import { EQUIPMENT_STATUSES, EQUIPMENT_STATUS_LABELS, type EquipmentStatus } from "@/lib/energy/installed-equipment/types";

export function EquipmentStatusSelect({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(status);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as EquipmentStatus;
          setValue(next);
          setError(null);
          startTransition(async () => {
            try {
              await setEquipmentStatusAction(id, next);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not update status.");
              setValue(status);
            }
          });
        }}
        className="w-44"
      >
        {EQUIPMENT_STATUSES.map((s) => (
          <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>
        ))}
      </Select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
