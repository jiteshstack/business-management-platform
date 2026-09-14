import { redirect } from "next/navigation";

// Middleware already redirects "/" based on session state; this is a
// fallback in case middleware is ever bypassed.
export default function RootPage() {
  redirect("/dashboard");
}
