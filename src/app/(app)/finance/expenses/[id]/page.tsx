import { ExpenseDetailView } from "@/components/expenses/expense-detail-view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <ExpenseDetailView id={id} searchParams={searchParams} />;
}
