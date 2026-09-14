"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CHECKLIST_SECTIONS } from "@/lib/energy/installations/types";
import { updateChecklistAction } from "@/lib/energy/installations/actions";

export function ChecklistForm({ installationId, initial }: { installationId: string; initial: Record<string, boolean> }) {
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await updateChecklistAction(installationId, checklist);
      setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      {CHECKLIST_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{section.title}</p>
          <div className="space-y-2">
            {section.items.map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!checklist[item.key]}
                  onChange={() => toggle(item.key)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save Checklist"}
        </Button>
        {saved ? <span className="text-xs text-emerald-700">Saved</span> : null}
      </div>
    </div>
  );
}
