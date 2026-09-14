import { ExpenseCreateView } from "@/components/expenses/expense-create-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ExpenseCreateView searchParams={searchParams} />;
}
