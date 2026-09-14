"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SOLAR_TYPES, DG_TYPES, type QuotationType } from "@/lib/energy/quotations/types";

type ConfigValues = Record<string, string>;

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function TechnicalConfigSection({
  type,
  initialConfig,
}: {
  type: QuotationType;
  initialConfig?: ConfigValues;
}) {
  const [values, setValues] = useState<ConfigValues>(initialConfig ?? {});

  const set = (key: string) => (value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const isSolar = SOLAR_TYPES.includes(type);
  const isDg = DG_TYPES.includes(type);

  if (!isSolar && !isDg) {
    return null;
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="technicalConfigJson" value={JSON.stringify(values)} readOnly />

      {isSolar ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="systemCapacity" label="System Capacity (kWp)" value={values.systemCapacity ?? ""} onChange={set("systemCapacity")} />
          <Field id="panelQuantity" label="Panel Quantity" value={values.panelQuantity ?? ""} onChange={set("panelQuantity")} />
          <Field id="panelWattage" label="Panel Wattage (W)" value={values.panelWattage ?? ""} onChange={set("panelWattage")} />
          <Field id="inverterCapacity" label="Inverter Capacity" value={values.inverterCapacity ?? ""} onChange={set("inverterCapacity")} />
          <Field id="inverterQuantity" label="Inverter Quantity" value={values.inverterQuantity ?? ""} onChange={set("inverterQuantity")} />
          <Field id="structure" label="Structure" value={values.structure ?? ""} onChange={set("structure")} />
          {type !== "ON_GRID_SOLAR" ? (
            <>
              <Field id="batteryCapacity" label="Battery Capacity" value={values.batteryCapacity ?? ""} onChange={set("batteryCapacity")} />
              <Field id="batteryQuantity" label="Battery Quantity" value={values.batteryQuantity ?? ""} onChange={set("batteryQuantity")} />
              <Field id="backupRequirement" label="Backup Requirement" value={values.backupRequirement ?? ""} onChange={set("backupRequirement")} />
              <Field id="backupHours" label="Backup Hours" value={values.backupHours ?? ""} onChange={set("backupHours")} />
            </>
          ) : null}
          <div className="sm:col-span-2">
            <Label htmlFor="solarNotes">Other Notes</Label>
            <Textarea id="solarNotes" rows={2} value={values.notes ?? ""} onChange={(e) => set("notes")(e.target.value)} />
          </div>
        </div>
      ) : null}

      {isDg ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="dgCapacityKva" label="DG Capacity (kVA)" value={values.dgCapacityKva ?? ""} onChange={set("dgCapacityKva")} />
          <Field id="dgModel" label="DG Model" value={values.dgModel ?? ""} onChange={set("dgModel")} />
          <Field id="fuelType" label="Fuel Type" value={values.fuelType ?? ""} onChange={set("fuelType")} />
          <Field id="amfRequired" label="AMF Requirement" value={values.amfRequired ?? ""} onChange={set("amfRequired")} />
          <Field id="synchronizationRequired" label="Synchronization Requirement" value={values.synchronizationRequired ?? ""} onChange={set("synchronizationRequired")} />
          <Field id="installationRequired" label="Installation Requirement" value={values.installationRequired ?? ""} onChange={set("installationRequired")} />
          <Field id="warranty" label="Warranty" value={values.warranty ?? ""} onChange={set("warranty")} />
          <div className="sm:col-span-2">
            <Label htmlFor="dgNotes">Other Technical Notes</Label>
            <Textarea id="dgNotes" rows={2} value={values.notes ?? ""} onChange={(e) => set("notes")(e.target.value)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
