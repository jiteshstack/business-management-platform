import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import {
  listParties,
  type PartySortKey,
  type PartyStatusFilter,
} from "@/lib/core/parties/queries";
import type { PartyType } from "@/lib/core/parties/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PartyStatusBadge } from "./status-badge";

const COPY: Record<PartyType, { title: string; description: string; noun: string }> = {
  CLIENT: {
    title: "Clients",
    description: "Client list, contacts, addresses and 360-degree view.",
    noun: "client",
  },
  VENDOR: {
    title: "Vendors",
    description: "Vendor list, contacts, addresses and 360-degree view.",
    noun: "vendor",
  },
};

function isPartySortKey(value: string | undefined): value is PartySortKey {
  return value === "name_asc" || value === "name_desc" || value === "updated_desc" || value === "city_asc";
}

function isStatusFilter(value: string | undefined): value is PartyStatusFilter {
  return value === "all" || value === "active" || value === "inactive";
}

export async function PartyListView({
  type,
  searchParams,
}: {
  type: PartyType;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const status = isStatusFilter(typeof params.status === "string" ? params.status : undefined)
    ? (params.status as PartyStatusFilter)
    : "all";
  const sort = isPartySortKey(typeof params.sort === "string" ? params.sort : undefined)
    ? (params.sort as PartySortKey)
    : "name_asc";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const copy = COPY[type];
  const basePath = type === "CLIENT" ? "/parties/clients" : "/parties/vendors";

  const { items, total, pageSize } = await listParties({
    companyId: session.companyId,
    type,
    q,
    status,
    sort,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status !== "all") qs.set("status", status);
    if (sort !== "name_asc") qs.set("sort", sort);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const query = qs.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <Link href={`${basePath}/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              New {copy.noun}
            </Button>
          </Link>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Name, mobile, email, GSTIN, city…"
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="w-36">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <div>
          <label htmlFor="sort" className="mb-1 block text-sm font-medium text-slate-700">
            Sort by
          </label>
          <Select id="sort" name="sort" defaultValue={sort} className="w-40">
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="updated_desc">Recently updated</option>
            <option value="city_asc">City</option>
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={total === 0 && !q && status === "all" ? `No ${copy.noun}s yet` : "No matches"}
          description={
            total === 0 && !q && status === "all"
              ? `Add your first ${copy.noun} to get started.`
              : "Try a different search or filter."
          }
          action={
            total === 0 && !q && status === "all" ? (
              <Link href={`${basePath}/new`}>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New {copy.noun}
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Business Name</th>
                <th className="px-4 py-2.5">City</th>
                <th className="px-4 py-2.5">Mobile</th>
                <th className="px-4 py-2.5">GSTIN</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((party) => (
                <tr key={party.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`${basePath}/${party.id}`}
                      className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {party.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{party.businessName ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{party.city ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{party.mobile ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{party.gstin ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <PartyStatusBadge isActive={party.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <p>
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
          <div className="flex gap-2">
            {page <= 1 ? (
              <Button variant="secondary" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Link href={pageHref(page - 1)}>
                <Button variant="secondary" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {page >= totalPages ? (
              <Button variant="secondary" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Link href={pageHref(page + 1)}>
                <Button variant="secondary" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
