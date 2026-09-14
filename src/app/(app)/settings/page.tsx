import { Lock } from "lucide-react";
import { getSession } from "@/lib/auth/current-session";
import { isOwnerAdmin } from "@/lib/core/permissions";
import { prisma } from "@/lib/db/client";
import { listCategories, listBrands, listUnits } from "@/lib/energy/inventory/queries";
import {
  createCategoryAction,
  setCategoryActiveAction,
  createBrandAction,
  setBrandActiveAction,
  createUnitAction,
  setUnitActiveAction,
} from "@/lib/energy/inventory/actions";
import { updateDefaultQuotationTermsAction } from "@/lib/energy/quotations/actions";
import { listExpenseCategories } from "@/lib/energy/expenses/queries";
import { createExpenseCategoryAction, setExpenseCategoryActiveAction } from "@/lib/energy/expenses/actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SettingsTabs, isSettingsTabKey, type SettingsTabKey } from "@/components/settings/settings-tabs";
import { MasterDataManager } from "@/components/settings/master-data-manager";
import { DefaultQuotationTermsForm } from "@/components/settings/default-quotation-terms-form";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session || !isOwnerAdmin(session.role)) {
    return (
      <div>
        <PageHeader title="Settings" />
        <EmptyState
          icon={Lock}
          title="Access restricted"
          description="Only Owner/Admin users can view company settings."
        />
      </div>
    );
  }

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "company";
  const tab: SettingsTabKey = isSettingsTabKey(rawTab) ? rawTab : "company";

  return (
    <div>
      <PageHeader title="Settings" description="Company, product categories, brands, and units." />
      <SettingsTabs active={tab} />

      {tab === "company" ? (
        <CompanyTab companyId={session.companyId} />
      ) : tab === "categories" ? (
        <CategoriesTab companyId={session.companyId} />
      ) : tab === "brands" ? (
        <BrandsTab companyId={session.companyId} />
      ) : tab === "units" ? (
        <UnitsTab companyId={session.companyId} />
      ) : (
        <ExpenseCategoriesTab companyId={session.companyId} />
      )}
    </div>
  );
}

async function CompanyTab({ companyId }: { companyId: string }) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  return (
    <div className="space-y-6">
      <DefaultQuotationTermsForm
        action={updateDefaultQuotationTermsAction}
        defaultValue={company?.defaultQuotationTerms ?? ""}
      />
      <EmptyState
        title="More coming later"
        description="Company profile, users, roles, and further document numbering settings are planned for a later phase."
      />
    </div>
  );
}

async function CategoriesTab({ companyId }: { companyId: string }) {
  const categories = await listCategories(companyId);
  return (
    <MasterDataManager
      title="Product Categories"
      description="Used to organize products (Solar, Generator, Power Backup, Services, …)."
      items={categories}
      addAction={createCategoryAction}
      toggleActiveAction={setCategoryActiveAction}
      secondaryField={{ name: "group", label: "Group (optional)", placeholder: "e.g. SOLAR" }}
    />
  );
}

async function BrandsTab({ companyId }: { companyId: string }) {
  const brands = await listBrands(companyId);
  return (
    <MasterDataManager
      title="Brands"
      description="Equipment brands used across products."
      items={brands}
      addAction={createBrandAction}
      toggleActiveAction={setBrandActiveAction}
    />
  );
}

async function UnitsTab({ companyId }: { companyId: string }) {
  const units = await listUnits(companyId);
  return (
    <MasterDataManager
      title="Units"
      description="Units of measure used on products (Piece, Meter, Kg, …)."
      items={units}
      addAction={createUnitAction}
      toggleActiveAction={setUnitActiveAction}
      secondaryField={{ name: "abbreviation", label: "Abbreviation (optional)", placeholder: "e.g. Pc" }}
    />
  );
}

async function ExpenseCategoriesTab({ companyId }: { companyId: string }) {
  const categories = await listExpenseCategories(companyId);
  return (
    <MasterDataManager
      title="Expense Categories"
      description="Used to classify business expenses (Transport, Rent, Marketing, …)."
      items={categories}
      addAction={createExpenseCategoryAction}
      toggleActiveAction={setExpenseCategoryActiveAction}
      secondaryField={{ name: "group", label: "Group (optional)", placeholder: "e.g. Operations" }}
    />
  );
}
