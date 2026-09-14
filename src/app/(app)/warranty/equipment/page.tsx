import { EquipmentListView } from "@/components/installed-equipment/equipment-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EquipmentListView searchParams={searchParams} />;
}
