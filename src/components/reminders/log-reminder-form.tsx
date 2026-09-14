"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logReminderAction } from "@/lib/energy/reminders/actions";
import type { ReminderType } from "@/lib/energy/reminders/types";

export function LogReminderForm({ invoiceId, type }: { invoiceId: string; type: ReminderType }) {
  const [open, setOpen] = useState(false);
  const action = logReminderAction.bind(null, invoiceId, type);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Mark reminder sent
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await action(formData);
        setOpen(false);
      }}
      className="flex flex-col gap-2"
    >
      <Input name="notes" placeholder="Note (optional)" className="w-48" />
      <Input name="nextFollowUpDate" type="date" className="w-48" />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
