import { WarrantyCreateView } from "@/components/warranties/warranty-create-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <WarrantyCreateView searchParams={searchParams} />;
}
