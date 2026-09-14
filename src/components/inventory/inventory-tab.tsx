"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PackageX } from "lucide-react";
import type { FormActionState } from "@/lib/core/form-state";
import { StockActionForm, type StockActionFormConfig } from "./stock-action-form";

type BoundAction = (state: FormActionState, formData: FormData) => Promise<FormActionState>;

export type StockActions = {
  stockIn: BoundAction;
  openingStock: BoundAction;
  stockOut: BoundAction;
  adjust: BoundAction;
  damage: BoundAction;
  returnStock: BoundAction;
  reserve: BoundAction;
  release: BoundAction;
};

const ACTION_CONFIGS: Record<string, StockActionFormConfig> = {
  stockIn: {
    submitLabel: "Add stock",
    showReference: true,
    showSerialNumbers: true,
    helpText: "Record equipment/material received into stock.",
  },
  openingStock: {
    submitLabel: "Record opening stock",
    showReference: true,
    showSerialNumbers: true,
    helpText: "Use this once, to declare the stock you're starting with.",
  },
  stockOut: {
    submitLabel: "Remove stock",
    showReference: true,
    helpText: "Record stock physically leaving (outside a sale/dispatch flow).",
  },
  adjust: {
    submitLabel: "Apply adjustment",
    showDirection: true,
    showReason: true,
    helpText: "Correct a count mismatch - always requires a reason.",
  },
  damage: {
    submitLabel: "Mark as damaged",
    showReason: true,
    helpText: "Moves quantity from available into damaged stock.",
  },
  returnStock: {
    submitLabel: "Record return",
    showReference: true,
    helpText: "Goods coming back into stock.",
  },
  reserve: {
    submitLabel: "Reserve stock",
    showReference: true,
    helpText: "Holds stock without removing it from the total - reduces available.",
  },
  release: {
    submitLabel: "Release reservation",
    helpText: "Frees previously reserved stock back to available.",
  },
};

const ACTION_LABELS: Record<keyof StockActions, string> = {
  stockIn: "Stock In",
  openingStock: "Opening Stock",
  stockOut: "Stock Out",
  adjust: "Adjust",
  damage: "Damage",
  returnStock: "Return",
  reserve: "Reserve",
  release: "Release",
};

export function InventoryTab({
  totalQty,
  reservedQty,
  damagedQty,
  reorderLevel,
  unitLabel,
  canManage,
  actions,
  resetKey,
}: {
  totalQty: number;
  reservedQty: number;
  damagedQty: number;
  reorderLevel: number | null;
  unitLabel: string;
  canManage: boolean;
  actions: StockActions;
  resetKey: number;
}) {
  const [activeAction, setActiveAction] = useState<keyof StockActions | null>(null);
  const available = totalQty - reservedQty - damagedQty;
  const isLow = reorderLevel != null && available <= reorderLevel;
  const isOut = totalQty <= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Stock" value={totalQty} unitLabel={unitLabel} />
        <StatCard
          label="Available"
          value={available}
          unitLabel={unitLabel}
          badge={isOut ? <Badge variant="danger">Out of stock</Badge> : isLow ? <Badge variant="warning">Low stock</Badge> : undefined}
        />
        <StatCard label="Reserved" value={reservedQty} unitLabel={unitLabel} />
        <StatCard label="Damaged" value={damagedQty} unitLabel={unitLabel} />
      </div>

      {reorderLevel != null ? (
        <p className="text-xs text-slate-500">
          Reorder level: {reorderLevel} {unitLabel}
        </p>
      ) : null}

      {canManage ? (
        <div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ACTION_LABELS) as (keyof StockActions)[]).map((key) => (
              <Button
                key={key}
                size="sm"
                variant={activeAction === key ? "primary" : "secondary"}
                onClick={() => setActiveAction(activeAction === key ? null : key)}
              >
                {ACTION_LABELS[key]}
              </Button>
            ))}
          </div>

          {activeAction ? (
            <div className="mt-3">
              <StockActionForm
                action={actions[activeAction]}
                config={ACTION_CONFIGS[activeAction]}
                resetKey={resetKey}
                onDone={() => setActiveAction(null)}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={PackageX}
          title="View only"
          description="Your role can view inventory but not make stock changes."
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  unitLabel,
  badge,
}: {
  label: string;
  value: number;
  unitLabel: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">
          {value} <span className="text-sm font-normal text-slate-400">{unitLabel}</span>
        </p>
        {badge ? <div className="mt-1">{badge}</div> : null}
      </CardContent>
    </Card>
  );
}
