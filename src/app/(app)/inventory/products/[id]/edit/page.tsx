import { ProductEditView } from "@/components/inventory/product-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditView id={id} />;
}
