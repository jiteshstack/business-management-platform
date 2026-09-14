import { ProjectEditView } from "@/components/projects/project-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectEditView id={id} />;
}
