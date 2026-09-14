import { ExpenseListView } from "@/components/expenses/expense-list-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ExpenseListView searchParams={searchParams} />;
}
