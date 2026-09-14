import { ProjectListView } from "@/components/projects/project-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProjectListView searchParams={searchParams} />;
}
