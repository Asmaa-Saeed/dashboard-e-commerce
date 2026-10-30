import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, type Tone } from "@/components/ui/badge";
import { CrownSimple, Plus, Storefront } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { SignOutButton } from "@/components/sign-out-button";
import { createStore, updateSubscription } from "@/features/admin/actions";

export const metadata: Metadata = { title: "إدارة المنصة" };

const STATUS: Record<string, { label: string; tone: Tone }> = {
  trial: { label: "تجربة", tone: "info" },
  active: { label: "فعّال", tone: "success" },
  paused: { label: "متوقف", tone: "warning" },
  cancelled: { label: "ملغي", tone: "neutral" },
};

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data: stores, error } = await supabase.rpc("admin_store_overview");
  if (error) throw new Error(`admin_store_overview: ${error.message}`);

  const totals = stores.reduce(
    (acc, s) => ({ orders: acc.orders + s.orders_30d, value: acc.value + Number(s.orders_value_30d), cost: acc.cost + Number(s.llm_cost_usd_30d) }),
    { orders: 0, value: 0, cost: 0 },
  );

  return (
    <main className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-control bg-primary text-on-primary shadow-sm shadow-primary/30">
          <CrownSimple className="size-5" />
        </span>
        <span className="text-[13px] font-semibold text-muted">لوحة إدارة المنصة</span>
      </div>
      <PageHeader
        title="إدارة المنصة"
        description="جميع المتاجر خلال آخر 30 يومًا."
        actions={
          <>
            <LinkButton href="/stores" variant="outline">
              <Storefront className="size-4" />
              كل المتاجر
            </LinkButton>
            <SignOutButton />
          </>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {[
          { label: "المتاجر", value: formatNumber(stores.length) },
          { label: "الطلبات", value: formatNumber(totals.orders) },
          { label: "تكلفة الذكاء الاصطناعي", value: `$${totals.cost.toFixed(2)}` },
        ].map((t) => (
          <Card key={t.label} as="div" className="p-5">
            <p className="text-sm font-semibold text-muted">{t.label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink tabular">{t.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {stores.length === 0 ? (
          <EmptyState title="لا توجد متاجر بعد">أنشئ أول متجر من النموذج بالأسفل.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-canvas text-[12px] text-muted">
                <tr>
                  {["المتجر", "الاشتراك", "البوت", "القنوات", "المحادثات", "الطلبات", "قيمة الطلبات", "تكلفة AI", "آخر رسالة", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-right font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => {
                  const status = STATUS[s.status] ?? { label: s.status, tone: "neutral" as Tone };
                  return (
                    <tr key={s.store_id} className="border-t border-line align-top">
                      <td className="px-3 py-3">
                        <Link href={`/s/${s.slug}/orders`} className="font-semibold hover:underline">
                          {s.name}
                        </Link>
                        <span className="block text-xs text-muted [direction:ltr] text-right">/{s.slug}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <span className="mt-1 block text-xs text-muted">
                          {s.status === "trial" ? `تنتهي ${formatDate(s.trial_ends_at)}` : s.subscription_renews_at ? `يتجدد ${formatDate(s.subscription_renews_at)}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3">{s.bot_enabled ? <Badge tone="success">يعمل</Badge> : <Badge>متوقف</Badge>}</td>
                      <td className="px-3 py-3 tabular-nums">{s.channels_connected}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(s.conversations_30d)}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(s.orders_30d)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatMoney(Number(s.orders_value_30d))}</td>
                      <td className="px-3 py-3 tabular-nums">${Number(s.llm_cost_usd_30d).toFixed(2)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(s.last_message_at)}</td>
                      <td className="px-3 py-3">
                        <details>
                          <summary className="cursor-pointer font-semibold text-primary-ink">الاشتراك</summary>
                          <ActionForm action={updateSubscription} hiddenFields={{ storeId: s.store_id }} className="mt-2 flex w-56 flex-col gap-2">
                            <Field label="الحالة" htmlFor={`status-${s.store_id}`}>
                              <Select id={`status-${s.store_id}`} name="status" defaultValue={s.status}>
                                {Object.entries(STATUS).map(([value, { label }]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="تاريخ التجديد" htmlFor={`renews-${s.store_id}`}>
                              <Input id={`renews-${s.store_id}`} name="renewsAt" type="date" defaultValue={s.subscription_renews_at?.slice(0, 10) ?? ""} />
                            </Field>
                            <SubmitButton variant="primary" size="sm">
                              حفظ
                            </SubmitButton>
                          </ActionForm>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <CardTitle icon={<Plus className="size-4" />}>متجر جديد</CardTitle>
        <p className="text-sm text-muted">
          أنشئ حساب صاحب المتجر أولًا من Supabase ← Authentication ← Users، ثم اكتب بريده هنا. يبدأ المتجر بفترة تجريبية مدتها 14 يومًا.
        </p>
        <ActionForm action={createStore} className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم المتجر" htmlFor="new-name">
            <Input id="new-name" name="name" required maxLength={120} />
          </Field>
          <Field label="رابط المتجر" htmlFor="new-slug" hint="حروف إنجليزية صغيرة وأرقام وشرطة، مثال: my-store">
            <Input id="new-slug" name="slug" required dir="ltr" pattern="[a-z0-9][a-z0-9\-]{1,40}" maxLength={41} />
          </Field>
          <Field label="بادئة أرقام الطلبات" htmlFor="new-prefix" hint="مثال: MS">
            <Input id="new-prefix" name="prefix" required dir="ltr" pattern="[A-Za-z]{2,5}" maxLength={5} />
          </Field>
          <Field label="بريد صاحب المتجر (اختياري)" htmlFor="new-owner">
            <Input id="new-owner" name="ownerEmail" type="email" dir="ltr" maxLength={254} />
          </Field>
          <div>
            <SubmitButton variant="primary">إنشاء المتجر</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </main>
  );
}
