import { ProjectSiteDetailView } from "@/components/project-sites/site-detail-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectSiteDetailView id={id} />;
}
