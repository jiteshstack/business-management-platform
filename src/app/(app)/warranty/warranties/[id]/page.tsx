import { WarrantyDetailView } from "@/components/warranties/warranty-detail-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WarrantyDetailView id={id} />;
}
