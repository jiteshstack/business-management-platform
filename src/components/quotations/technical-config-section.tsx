"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SOLAR_TYPES, DG_TYPES, type QuotationType } from "@/lib/energy/quotations/types";

type ConfigValues = Record<string, string>;

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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
            <SectionHeading>Design Inputs</SectionHeading>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="projectType" label="Project Type" value={values.projectType ?? ""} onChange={set("projectType")} />
              <Field id="areaAvailable" label="Area Available" value={values.areaAvailable ?? ""} onChange={set("areaAvailable")} />
              <div className="sm:col-span-2">
                <Label htmlFor="siteSurveyStatus">Site Survey Status</Label>
                <Textarea
                  id="siteSurveyStatus"
                  rows={2}
                  value={values.siteSurveyStatus ?? ""}
                  onChange={(e) => set("siteSurveyStatus")(e.target.value)}
                  placeholder="e.g. Site survey not yet complete; system specification and price may change based on site survey."
                />
              </div>
            </div>
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
        <div className="space-y-5">
          <div>
            <SectionHeading>DG Set</SectionHeading>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="dgManufacturer" label="Manufacturer / Brand" value={values.dgManufacturer ?? ""} onChange={set("dgManufacturer")} />
              <Field id="dgCapacityKva" label="DG Capacity (kVA)" value={values.dgCapacityKva ?? ""} onChange={set("dgCapacityKva")} />
              <Field id="phase" label="Phase" value={values.phase ?? ""} onChange={set("phase")} placeholder="e.g. 3 Phase" />
              <Field id="emissionNorm" label="Emission Norm" value={values.emissionNorm ?? ""} onChange={set("emissionNorm")} placeholder="e.g. CPCB IV+" />
              <Field id="dgModel" label="Engine Model" value={values.dgModel ?? ""} onChange={set("dgModel")} />
              <Field id="fuelType" label="Fuel Type" value={values.fuelType ?? ""} onChange={set("fuelType")} />
              <Field id="alternatorMake" label="Alternator Make" value={values.alternatorMake ?? ""} onChange={set("alternatorMake")} />
              <Field id="coolingType" label="Cooling Type" value={values.coolingType ?? ""} onChange={set("coolingType")} placeholder="e.g. Water Cooled" />
              <Field id="panelType" label="Control Panel" value={values.panelType ?? ""} onChange={set("panelType")} placeholder="e.g. Standard Panel / AMF Panel" />
              <Field id="enclosureType" label="Enclosure" value={values.enclosureType ?? ""} onChange={set("enclosureType")} placeholder="e.g. Acoustic Enclosure / Canopy" />
              <Field id="warranty" label="Warranty" value={values.warranty ?? ""} onChange={set("warranty")} />
            </div>
          </div>

          <div>
            <SectionHeading>Requirements</SectionHeading>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="amfRequired" label="AMF Requirement" value={values.amfRequired ?? ""} onChange={set("amfRequired")} />
              <Field id="synchronizationRequired" label="Synchronization Requirement" value={values.synchronizationRequired ?? ""} onChange={set("synchronizationRequired")} />
              <Field id="installationRequired" label="Installation Requirement" value={values.installationRequired ?? ""} onChange={set("installationRequired")} />
            </div>
          </div>

          <div>
            <Label htmlFor="dgFeatures">Salient Features (one per line)</Label>
            <Textarea
              id="dgFeatures"
              rows={4}
              value={values.dgFeatures ?? ""}
              onChange={(e) => set("dgFeatures")(e.target.value)}
              placeholder="e.g. Best-in-class fuel efficiency and low lubricating oil consumption"
            />
          </div>

          <div>
            <Label htmlFor="dgTermsOfSupply">Terms of Supply (one per line)</Label>
            <Textarea
              id="dgTermsOfSupply"
              rows={3}
              value={values.dgTermsOfSupply ?? ""}
              onChange={(e) => set("dgTermsOfSupply")(e.target.value)}
              placeholder="e.g. Any civil work like DG foundation, cable trench, etc. falls within the customer's scope."
            />
          </div>

          <div>
            <Label htmlFor="dgNotes">Other Technical Notes</Label>
            <Textarea id="dgNotes" rows={2} value={values.notes ?? ""} onChange={(e) => set("notes")(e.target.value)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
