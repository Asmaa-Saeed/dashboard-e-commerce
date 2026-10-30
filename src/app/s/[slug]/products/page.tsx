import type { Metadata } from "next";
import { z } from "zod";
import { requireStoreBySlug } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { Card, CardTitle, EmptyState, PageHeader, SegmentLinks } from "@/components/ui/layout";
import { SearchField } from "@/components/ui/form";
import { ClockCounterClockwise, Tag } from "@/components/ui/icons";
import { Pagination } from "@/components/pagination";
import { countProducts, listProducts, PRODUCTS_PAGE_SIZE, recentMovements, type ProductFilter } from "@/features/products/queries";
import { ProductCard } from "@/features/products/components/product-card";

export const metadata: Metadata = { title: "المنتجات والمخزون" };

const searchSchema = z.object({
  filter: z.enum(["all", "out"]).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

const REASON_LABEL: Record<string, string> = {
  order_confirmed: "تأكيد طلب",
  order_cancelled: "إلغاء طلب",
  restock: "وصول بضاعة",
  adjustment: "جرد",
  manual_sale: "بيع مباشر من المتجر",
  return: "إرجاع قطعة",
};

export default async function ProductsPage({ params, searchParams }: PageProps<"/s/[slug]/products">) {
  const { slug } = await params;
  const query = searchSchema.parse(await searchParams);
  const { supabase, store } = await requireStoreBySlug(slug);
  const filter: ProductFilter = query.filter ?? "all";
  const search = query.q ?? "";
  const page = query.page ?? 1;
  const countsStock = store.inventory_mode === "quantity";

  const [{ products, total }, counts, movements] = await Promise.all([
    listProducts(supabase, store.id, { filter, search, page }),
    countProducts(supabase, store.id),
    countsStock ? recentMovements(supabase, store.id) : Promise.resolve([]),
  ]);

  const base = `/s/${store.slug}/products`;
  const href = (next: { filter?: ProductFilter; page?: number }) => {
    const sp = new URLSearchParams();
    const f = next.filter ?? filter;
    if (f !== "all") sp.set("filter", f);
    if (search) sp.set("q", search);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const qs = sp.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const tabs: Array<{ key: ProductFilter; label: string; count: number }> = [
    { key: "all", label: "الكل", count: counts.all },
    { key: "out", label: "نفدت كميتها", count: counts.out },
  ];

  return (
    <>
      <PageHeader
        title="المنتجات والمخزون"
        description={`${store.catalog_source === "manual" ? "" : `تُحدَّث المنتجات تلقائيًا من موقع المتجر${store.catalog_synced_at ? `، آخر تحديث ${formatDateTime(store.catalog_synced_at, store.timezone)}` : ""}. `}عند اختيار «نفدت الكمية» يتوقف البوت عن عرض المنتج فورًا.`}
        actions={
          <form role="search" action={base} className="w-full sm:w-80">
            {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
            <SearchField name="q" defaultValue={search} placeholder="اسم المنتج" label="البحث بالاسم" />
          </form>
        }
      />

      <SegmentLinks label="تصفية المنتجات" items={tabs.map((t) => ({ href: href({ filter: t.key, page: 1 }), label: t.label, active: t.key === filter, count: t.count }))} />

      <Card as="div" className="overflow-hidden">
        {products.length === 0 ? (
          <EmptyState icon={<Tag className="size-6" />} title="لا توجد منتجات">
            {search ? "جرّب كلمة أخرى." : null}
          </EmptyState>
        ) : (
          <ul>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} storeId={store.id} currencySymbol={store.currency_symbol} countsStock={countsStock} />
            ))}
          </ul>
        )}
        <Pagination page={page} total={total} pageSize={PRODUCTS_PAGE_SIZE} hrefFor={(p) => href({ page: p })} />
      </Card>

      {countsStock ? (
        <Card className="p-5">
          <CardTitle icon={<ClockCounterClockwise className="size-4" />}>آخر حركات المخزون</CardTitle>
          {movements.length === 0 ? (
            <p className="mt-3 text-sm text-muted">لا توجد حركات بعد.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-[14px]">
              {movements.map((m) => (
                <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                  <span>
                    {m.product_variants?.products?.name ?? "منتج"}
                    {m.product_variants?.label ? ` · ${m.product_variants.label}` : ""}
                    <span className="text-muted"> · {REASON_LABEL[m.reason] ?? m.reason}</span>
                    {m.note ? <span className="text-muted"> · {m.note}</span> : null}
                  </span>
                  <span className="flex gap-3">
                    <span className={`font-semibold tabular [direction:ltr] ${m.delta > 0 ? "text-success" : "text-danger"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                    <span className="text-muted tabular">{formatDateTime(m.created_at, store.timezone)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </>
  );
}
