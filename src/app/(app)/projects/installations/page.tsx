import { InstallationListView } from "@/components/installations/installation-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <InstallationListView searchParams={searchParams} />;
}
