import { SerialNumbersListView } from "@/components/inventory/serial-numbers-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SerialNumbersListView searchParams={searchParams} />;
}
