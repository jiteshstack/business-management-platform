import { AmcListView } from "@/components/amc/amc-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AmcListView searchParams={searchParams} />;
}
