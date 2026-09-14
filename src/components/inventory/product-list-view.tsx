import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listProducts, listCategories, listBrands, type ProductSortKey, type ProductStatusFilter } from "@/lib/energy/inventory/queries";
import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/energy/inventory/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

function isStatusFilter(value: string | undefined): value is ProductStatusFilter {
  return value === "all" || value === "active" || value === "inactive";
}
function isSortKey(value: string | undefined): value is ProductSortKey {
  return value === "name_asc" || value === "name_desc" || value === "code_asc" || value === "updated_desc";
}
function isProductType(value: string | undefined): value is ProductType {
  return (PRODUCT_TYPES as readonly string[]).includes(value ?? "");
}

export async function ProductListView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const status = isStatusFilter(typeof params.status === "string" ? params.status : undefined)
    ? (params.status as ProductStatusFilter)
    : "all";
  const sort = isSortKey(typeof params.sort === "string" ? params.sort : undefined)
    ? (params.sort as ProductSortKey)
    : "name_asc";
  const type = isProductType(typeof params.type === "string" ? params.type : undefined)
    ? (params.type as ProductType)
    : "all";
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : "";
  const brandId = typeof params.brandId === "string" ? params.brandId : "";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const [{ items, total, pageSize }, categories, brands] = await Promise.all([
    listProducts({
      companyId: session.companyId,
      q,
      status,
      sort,
      type,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      page,
    }),
    listCategories(session.companyId, true),
    listBrands(session.companyId, true),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status !== "all") qs.set("status", status);
    if (sort !== "name_asc") qs.set("sort", sort);
    if (type !== "all") qs.set("type", type);
    if (categoryId) qs.set("categoryId", categoryId);
    if (brandId) qs.set("brandId", brandId);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const query = qs.toString();
    return query ? `/inventory/products?${query}` : "/inventory/products";
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Equipment, materials and services master."
        actions={
          <Link href="/inventory/products/new">
            <Button>
              <Plus className="h-4 w-4" />
              New product
            </Button>
          </Link>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="q" name="q" defaultValue={q} placeholder="Code, name, model…" className="pl-8" />
          </div>
        </div>
        <div>
          <label htmlFor="type" className="mb-1 block text-sm font-medium text-slate-700">
            Type
          </label>
          <Select id="type" name="type" defaultValue={type} className="w-36">
            <option value="all">All</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PRODUCT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-slate-700">
            Category
          </label>
          <Select id="categoryId" name="categoryId" defaultValue={categoryId} className="w-40">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="brandId" className="mb-1 block text-sm font-medium text-slate-700">
            Brand
          </label>
          <Select id="brandId" name="brandId" defaultValue={brandId} className="w-36">
            <option value="">All</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="w-32">
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
            <option value="code_asc">Code</option>
            <option value="updated_desc">Recently updated</option>
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={total === 0 && !q && status === "all" && type === "all" ? "No products yet" : "No matches"}
          description={
            total === 0 && !q && status === "all" && type === "all"
              ? "Add your first product to get started."
              : "Try a different search or filter."
          }
          action={
            total === 0 && !q && status === "all" ? (
              <Link href="/inventory/products/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New product
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Brand</th>
                <th className="px-4 py-2.5">Unit</th>
                <th className="px-4 py-2.5">Selling Price</th>
                <th className="px-4 py-2.5">Current Stock</th>
                <th className="px-4 py-2.5">Available</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((product) => {
                const balance = product.balances[0];
                const available = balance ? balance.totalQty - balance.reservedQty - balance.damagedQty : null;
                const isLow =
                  product.reorderLevel != null && available != null && available <= product.reorderLevel;
                return (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/inventory/products/${product.id}`}
                        className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {product.code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {product.name}
                      {product.serialTracked ? (
                        <span className="ml-1.5 text-xs text-slate-400">(serial-tracked)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{PRODUCT_TYPE_LABELS[product.type as ProductType] ?? product.type}</td>
                    <td className="px-4 py-2.5 text-slate-600">{product.category?.name ?? "-"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{product.brand?.name ?? "-"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{product.unit?.name ?? "-"}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {product.sellingPrice != null ? `₹${product.sellingPrice.toLocaleString("en-IN")}` : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {product.stockTracked ? (balance?.totalQty ?? 0) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {product.stockTracked ? (
                        <span className="flex items-center gap-1.5">
                          {available ?? 0}
                          {isLow ? <Badge variant="warning">Low</Badge> : null}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={product.isActive ? "success" : "neutral"}>
                        {product.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
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
