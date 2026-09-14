import { ProjectDetailView } from "@/components/projects/project-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <ProjectDetailView id={id} searchParams={searchParams} />;
}
