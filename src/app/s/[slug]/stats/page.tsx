import type { Metadata } from "next";
import type { ReactNode } from "react";
import { z } from "zod";
import { requireStoreBySlug } from "@/lib/auth/dal";
import { formatMoney, formatNumber } from "@/lib/format";
import { Card, CardTitle, PageHeader, SegmentLinks } from "@/components/ui/layout";
import { ChatsCircle, HandPalm, MagnifyingGlass, Receipt, Tag } from "@/components/ui/icons";
import { handoffLabel } from "@/features/conversations/labels";
import { getStoreStats, STATS_RANGES, type StatsRange } from "@/features/stats/queries";

export const metadata: Metadata = { title: "الإحصائيات" };

const searchSchema = z.object({ range: z.enum(["7", "30", "90"]).optional().catch(undefined) });

export default async function StatsPage({ params, searchParams }: PageProps<"/s/[slug]/stats">) {
  const { slug } = await params;
  const range: StatsRange = searchSchema.parse(await searchParams).range ?? "30";
  const { supabase, store } = await requireStoreBySlug(slug);
  const stats = await getStoreStats(supabase, store.id, range);

  return (
    <>
      <PageHeader
        title="الإحصائيات"
        description={`آخر ${STATS_RANGES[range]} يومًا`}
        actions={
          <SegmentLinks
            label="الفترة"
            items={(Object.keys(STATS_RANGES) as StatsRange[]).map((r) => ({ href: `/s/${store.slug}/stats?range=${r}`, label: `${STATS_RANGES[r]} يومًا`, active: r === range }))}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card as="div" className="relative overflow-hidden p-5 sm:col-span-2">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
          <p className="text-[13px] font-medium text-muted">قيمة الطلبات</p>
          <p className="mt-2 text-[36px] leading-none font-semibold tracking-tight text-ink tabular">{formatMoney(stats.orders_value, store.currency_symbol)}</p>
          <p className="mt-3 text-[13px] text-muted">
            دون التوصيل والطلبات الملغاة · <span className="font-medium text-primary-ink">{formatNumber(stats.delivered)} طلب مسلَّم</span>
          </p>
        </Card>
        <StatTile icon={<Receipt className="size-5" />} label="الطلبات" value={formatNumber(stats.orders)} note={`${stats.conversion_pct}% من المحادثات تحولت إلى طلبات`} />
        <StatTile icon={<ChatsCircle className="size-5" />} label="المحادثات" value={formatNumber(stats.conversations)} note={`${formatNumber(stats.handoffs)} حُوّلت إلى موظف · ${formatNumber(stats.cancelled)} طلب ملغي`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <RankedList
          icon={<Tag className="size-4" />}
          title="أكثر المنتجات طلبًا"
          hint="عدد مرات عرض البوت للمنتج"
          rows={stats.top_products.map((r) => ({ label: r.name ?? "—", value: r.count }))}
        />
        <RankedList
          icon={<MagnifyingGlass className="size-4" />}
          title="عمليات بحث بلا نتائج"
          hint="أفكار لمنتجات جديدة"
          rows={stats.no_result_searches.map((r) => ({ label: `«${r.query ?? ""}»`, value: r.count }))}
        />
        <RankedList
          icon={<HandPalm className="size-4" />}
          title="أسباب التحويل إلى موظف"
          hint={`${formatNumber(stats.handoffs)} محادثة`}
          rows={stats.handoff_reasons.map((r) => ({ label: handoffLabel(r.reason) ?? "غير محدد", value: r.count }))}
        />
      </div>
    </>
  );
}

function StatTile({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <Card as="div" className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className="grid size-8 place-items-center rounded-control border border-line text-subtle">{icon}</span>
      </div>
      <p className="mt-2 text-[30px] leading-tight font-semibold tracking-tight text-ink tabular">{value}</p>
      <p className="mt-1.5 text-[12px] text-muted">{note}</p>
    </Card>
  );
}

function RankedList({ icon, title, hint, rows }: { icon: ReactNode; title: string; hint: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <Card className="p-5">
      <CardTitle icon={icon}>{title}</CardTitle>
      <p className="mt-1 text-[12px] text-muted">{hint}</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-subtle">لا توجد بيانات كافية بعد.</p>
      ) : (
        <ol className="mt-2 divide-y divide-line">
          {rows.map((row, i) => (
            <li key={`${row.label}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-muted text-[11px] font-semibold text-muted tabular">{i + 1}</span>
                <span className="break-words">{row.label}</span>
              </span>
              <span className="font-semibold tabular">{formatNumber(row.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
