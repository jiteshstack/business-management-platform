import { AmcEditView } from "@/components/amc/amc-edit-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AmcEditView id={id} />;
}
