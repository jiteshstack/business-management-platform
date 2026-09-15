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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</p>;
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
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="systemCapacity" label="System Capacity (kWp)" value={values.systemCapacity ?? ""} onChange={set("systemCapacity")} />
            <Field id="transportationCost" label="Transportation Cost" value={values.transportationCost ?? ""} onChange={set("transportationCost")} />
          </div>

          <div>
            <SectionHeading>Solar PV Module</SectionHeading>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="moduleManufacturer" label="Manufacturer" value={values.moduleManufacturer ?? ""} onChange={set("moduleManufacturer")} />
              <Field id="panelQuantity" label="No. of Modules" value={values.panelQuantity ?? ""} onChange={set("panelQuantity")} />
              <Field id="panelWattage" label="Wattage per Module (W)" value={values.panelWattage ?? ""} onChange={set("panelWattage")} />
              <Field id="moduleWarranty" label="Warranty" value={values.moduleWarranty ?? ""} onChange={set("moduleWarranty")} />
            </div>
          </div>

          <div>
            <SectionHeading>Inverter / PCU</SectionHeading>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="inverterManufacturer" label="Manufacturer" value={values.inverterManufacturer ?? ""} onChange={set("inverterManufacturer")} />
              <Field id="inverterCapacity" label="Rating" value={values.inverterCapacity ?? ""} onChange={set("inverterCapacity")} />
              <Field id="inverterQuantity" label="Quantity" value={values.inverterQuantity ?? ""} onChange={set("inverterQuantity")} />
              <Field id="inverterSpecification" label="Specification" value={values.inverterSpecification ?? ""} onChange={set("inverterSpecification")} />
              <Field id="inverterWarranty" label="Warranty" value={values.inverterWarranty ?? ""} onChange={set("inverterWarranty")} />
            </div>
          </div>

          {type !== "ON_GRID_SOLAR" ? (
            <div>
              <SectionHeading>Battery</SectionHeading>
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="batteryManufacturer" label="Manufacturer" value={values.batteryManufacturer ?? ""} onChange={set("batteryManufacturer")} />
                <Field id="batteryQuantity" label="Quantity" value={values.batteryQuantity ?? ""} onChange={set("batteryQuantity")} />
                <Field id="batterySpecification" label="Specification" value={values.batterySpecification ?? ""} onChange={set("batterySpecification")} />
                <Field id="backupRequirement" label="Backup Requirement" value={values.backupRequirement ?? ""} onChange={set("backupRequirement")} />
                <Field id="backupHours" label="Backup Hours" value={values.backupHours ?? ""} onChange={set("backupHours")} />
                <Field id="batteryWarranty" label="Warranty" value={values.batteryWarranty ?? ""} onChange={set("batteryWarranty")} />
              </div>
            </div>
          ) : null}

          <div>
            <SectionHeading>Mounting Structure</SectionHeading>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="structure" label="Type" value={values.structure ?? ""} onChange={set("structure")} />
              <Field id="windSpeedResistance" label="Wind Speed Resistance" value={values.windSpeedResistance ?? ""} onChange={set("windSpeedResistance")} />
              <Field id="mountingWarranty" label="Warranty" value={values.mountingWarranty ?? ""} onChange={set("mountingWarranty")} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="installationIncluded">Installation Included (one per line)</Label>
                <Textarea
                  id="installationIncluded"
                  rows={3}
                  value={values.installationIncluded ?? ""}
                  onChange={(e) => set("installationIncluded")(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="installationExcluded">Excluded (one per line)</Label>
                <Textarea
                  id="installationExcluded"
                  rows={3}
                  value={values.installationExcluded ?? ""}
                  onChange={(e) => set("installationExcluded")(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
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
