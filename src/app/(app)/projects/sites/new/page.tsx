import { ProjectSiteCreateView } from "@/components/project-sites/site-create-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProjectSiteCreateView searchParams={searchParams} />;
}
