import { WarrantyEditView } from "@/components/warranties/warranty-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WarrantyEditView id={id} />;
}
