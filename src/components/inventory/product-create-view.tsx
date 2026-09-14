import { requireSession } from "@/lib/auth/current-session";
import { createProductAction } from "@/lib/energy/inventory/actions";
import { listCategories, listBrands, listUnits } from "@/lib/energy/inventory/queries";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "./product-form";

export async function ProductCreateView() {
  const session = await requireSession();
  const [categories, brands, units, vendors] = await Promise.all([
    listCategories(session.companyId, true),
    listBrands(session.companyId, true),
    listUnits(session.companyId, true),
    prisma.party.findMany({
      where: { companyId: session.companyId, type: "VENDOR", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <PageHeader title="New Product" description="Add a product, piece of equipment, material or service." />
      <ProductForm
        mode="create"
        action={createProductAction}
        categories={categories}
        brands={brands}
        units={units}
        vendors={vendors}
        cancelHref="/inventory/products"
      />
    </div>
  );
}
