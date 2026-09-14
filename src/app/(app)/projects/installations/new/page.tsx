import { InstallationCreateView } from "@/components/installations/installation-create-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <InstallationCreateView searchParams={searchParams} />;
}
