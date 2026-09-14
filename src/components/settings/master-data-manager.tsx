"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

const initialState: FormActionState = {};

type Item = { id: string; name: string; isActive: boolean; [key: string]: unknown };

export function MasterDataManager({
  title,
  description,
  items,
  addAction,
  toggleActiveAction,
  secondaryField,
}: {
  title: string;
  description: string;
  items: Item[];
  addAction: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  toggleActiveAction: (id: string, isActive: boolean) => Promise<void>;
  secondaryField?: { name: string; label: string; placeholder?: string };
}) {
  const [state, formAction, isPending] = useActionState(addAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="mt-1 text-xs font-normal text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form key={items.length} action={formAction} className="flex flex-wrap items-end gap-3">
          {state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
          <div className="min-w-[160px]">
            <Label htmlFor={`${title}-name`}>Name *</Label>
            <Input id={`${title}-name`} name="name" required />
            {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
          </div>
          {secondaryField ? (
            <div className="min-w-[160px]">
              <Label htmlFor={`${title}-${secondaryField.name}`}>{secondaryField.label}</Label>
              <Input
                id={`${title}-${secondaryField.name}`}
                name={secondaryField.name}
                placeholder={secondaryField.placeholder}
              />
            </div>
          ) : null}
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Adding…" : "Add"}
          </Button>
        </form>

        {items.length === 0 ? (
          <EmptyState title={`No ${title.toLowerCase()} yet`} />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-900">{item.name}</span>
                  {secondaryField && item[secondaryField.name] ? (
                    <span className="text-xs text-slate-400">{String(item[secondaryField.name])}</span>
                  ) : null}
                  <Badge variant={item.isActive ? "success" : "neutral"}>
                    {item.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <form action={toggleActiveAction.bind(null, item.id, !item.isActive)}>
                  <Button type="submit" size="sm" variant="secondary">
                    {item.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
