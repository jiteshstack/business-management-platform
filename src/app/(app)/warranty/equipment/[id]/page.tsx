import { EquipmentDetailView } from "@/components/installed-equipment/equipment-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <EquipmentDetailView id={id} searchParams={searchParams} />;
}
