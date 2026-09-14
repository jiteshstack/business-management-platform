import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/current-session";
import { getProductById, listCategories, listBrands, listUnits } from "@/lib/energy/inventory/queries";
import { updateProductAction } from "@/lib/energy/inventory/actions";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "./product-form";

export async function ProductEditView({ id }: { id: string }) {
  const session = await requireSession();
  const product = await getProductById({ companyId: session.companyId, id });
  if (!product) notFound();

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
      <PageHeader title={`Edit ${product.name}`} description="Update this product's details." />
      <ProductForm
        mode="edit"
        action={updateProductAction.bind(null, id)}
        defaults={product}
        categories={categories}
        brands={brands}
        units={units}
        vendors={vendors}
        cancelHref={`/inventory/products/${id}`}
      />
    </div>
  );
}
