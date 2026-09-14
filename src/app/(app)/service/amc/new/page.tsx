import { AmcCreateView } from "@/components/amc/amc-create-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AmcCreateView searchParams={searchParams} />;
}
