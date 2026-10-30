import type { Metadata } from "next";
import { z } from "zod";
import { requireStoreBySlug } from "@/lib/auth/dal";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Badge, TONE } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SearchField } from "@/components/ui/form";
import { Archive, CheckCircle, Fire, MagnifyingGlass, Package, Tray, Truck } from "@/components/ui/icons";
import { Card, EmptyState, PageHeader, TabLinks } from "@/components/ui/layout";
import { Pagination } from "@/components/pagination";
import { cleanSearch, getOrder, HISTORY_PAGE_SIZE, listActiveOrders, listDoneOrders } from "@/features/orders/queries";
import { ACTIVE_STATUSES, isOrderStatus, STATUS_LABEL, STATUS_TONE } from "@/features/orders/status";
import { OrderCard } from "@/features/orders/components/order-card";
import { OrderDetailSheet } from "@/features/orders/components/order-detail";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "الطلبات" };

const searchSchema = z.object({
  tab: z.enum(["active", "done"]).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  id: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

const COLUMN = {
  pending_review: { title: "بانتظار المراجعة", empty: "لا توجد طلبات جديدة", icon: Tray },
  confirmed: { title: "مؤكدة وجاهزة للتوصيل", empty: "لا توجد طلبات مؤكدة", icon: Package },
  shipped: { title: "عند شركة التوصيل", empty: "لا توجد طلبات قيد التوصيل", icon: Truck },
} as const;

export default async function OrdersPage({ params, searchParams }: PageProps<"/s/[slug]/orders">) {
  const { slug } = await params;
  const query = searchSchema.parse(await searchParams);
  const { supabase, store } = await requireStoreBySlug(slug);
  const tab = query.tab ?? "active";
  const q = cleanSearch(query.q);
  const page = query.page ?? 1;

  const base = `/s/${store.slug}/orders`;
  const href = (next: { tab?: string; id?: string | null; page?: number }) => {
    const sp = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t !== "active") sp.set("tab", t);
    if (q) sp.set("q", q);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    if (next.id) sp.set("id", next.id);
    const qs = sp.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const conversationHref = (id: string | null) => (id ? `/s/${store.slug}/conversations?filter=all&id=${id}` : null);

  const [active, done, detail] = await Promise.all([
    listActiveOrders(supabase, store.id, tab === "active" ? q : ""),
    tab === "done" ? listDoneOrders(supabase, store.id, q, page) : Promise.resolve(null),
    query.id ? getOrder(supabase, store.id, query.id) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="الطلبات"
        description={tab === "active" ? "تصل طلبات البوت هنا تلقائيًا مع تنبيه صوتي. تأكد من توفر المنتجات مع العميل قبل إرسال الطلب." : "الطلبات التي تم تسليمها أو إلغاؤها."}
        actions={
          <form action={base} className="w-full sm:w-80" role="search">
            {tab !== "active" ? <input type="hidden" name="tab" value={tab} /> : null}
            <SearchField name="q" defaultValue={q} placeholder="رقم الطلب أو اسم العميل أو رقم هاتفه" label="البحث في الطلبات" />
          </form>
        }
      />

      <TabLinks
        label="نوع الطلبات"
        tabs={[
          { href: href({ tab: "active", page: 1 }), label: "الطلبات الجارية", active: tab === "active", count: active.total, icon: <Fire className="size-4" /> },
          { href: href({ tab: "done", page: 1 }), label: "المسلَّمة والملغاة", active: tab === "done", icon: <Archive className="size-4" /> },
        ]}
      />

      {tab === "active" ? (
        q && active.total === 0 ? (
          <Card>
            <EmptyState icon={<MagnifyingGlass className="size-6" />} title="لا توجد نتائج">
              لا يوجد طلب جارٍ يطابق «{q}». جرّب تبويب الطلبات المسلَّمة والملغاة.
            </EmptyState>
          </Card>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-3">
            {ACTIVE_STATUSES.map((status) => {
              const column = COLUMN[status];
              const Icon = column.icon;
              const tone = TONE[STATUS_TONE[status]];
              const list = active.columns[status];
              return (
                <section key={status} aria-label={column.title} className="min-w-0 rounded-card border border-line bg-surface-muted/60 p-2.5">
                  <header className="mb-2.5 flex items-center gap-2 px-1.5 pt-1">
                    <span className={cn("grid size-7 place-items-center rounded-chip", tone.soft, tone.text)}>
                      <Icon className="size-4" weight="fill" />
                    </span>
                    <h2 className="text-[14px] font-semibold text-ink">{column.title}</h2>
                    <span className="ms-auto rounded-full border border-line bg-surface px-2 py-0.5 text-[12px] font-medium text-muted tabular">{list.length}</span>
                  </header>
                  <div className="space-y-2.5">
                    {list.length === 0 ? (
                      <div className="grid place-items-center rounded-card border border-dashed border-line bg-surface/60 px-4 py-10 text-center">
                        <Icon className="size-7 text-subtle" />
                        <p className="mt-2 text-[13px] font-medium text-subtle">{column.empty}</p>
                      </div>
                    ) : (
                      list.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          storeId={store.id}
                          currencySymbol={store.currency_symbol}
                          detailsHref={href({ id: order.id })}
                          conversationHref={conversationHref(order.conversation_id)}
                          highlighted={order.id === query.id}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : done ? (
        <Card className="overflow-hidden">
          {done.rows.length === 0 ? (
            <EmptyState icon={<CheckCircle className="size-6" />} title={q ? "لا توجد نتائج" : "لا توجد طلبات مسلَّمة أو ملغاة بعد"} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[14px]">
                <thead className="bg-canvas text-[12px] text-muted">
                  <tr>
                    {["الطلب", "العميل", "المنطقة", "المبلغ", "الحالة", "التاريخ", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-right font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {done.rows.map((o) => {
                    const status = isOrderStatus(o.status) ? o.status : "delivered";
                    return (
                      <tr key={o.id} className="border-t border-line">
                        <td className="px-4 py-3 font-semibold tabular" dir="ltr">
                          {o.ref}
                        </td>
                        <td className="px-4 py-3">{o.customer_name}</td>
                        <td className="px-4 py-3 text-muted">{o.city ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold tabular">{formatMoney(o.total, store.currency_symbol)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted tabular">{formatDateTime(o.created_at, store.timezone)}</td>
                        <td className="px-4 py-3">
                          <LinkButton href={href({ id: o.id, page })} scroll={false} variant="outline" size="sm">
                            التفاصيل
                          </LinkButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} total={done.total} pageSize={HISTORY_PAGE_SIZE} hrefFor={(p) => href({ page: p })} />
        </Card>
      ) : null}

      {detail ? <OrderDetailSheet data={detail} store={store} closeHref={href({ page })} /> : null}
    </>
  );
}
