import { RemindersView } from "@/components/reminders/reminders-view";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RemindersView searchParams={searchParams} />;
}
