import type { ReactNode } from "react";
import { ActionForm, ConfirmActionButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardTitle } from "@/components/ui/layout";
import { ChatsCircle, MapPin, Plus, Robot, ShieldCheck, Storefront, Trash, Truck, Users } from "@/components/ui/icons";
import { formatMoney } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";
import { DEFAULT_DELIVERY_TEMPLATE } from "@/features/orders/delivery-text";
import { CHANNEL_LABEL } from "@/features/conversations/labels";
import {
  addTeamMember,
  deleteSettingItem,
  removeTeamMember,
  saveDeliveryCompany,
  saveDeliveryZone,
  updateBotSettings,
  updatePolicies,
  updateStoreProfile,
} from "../actions";
import type { Settings } from "../queries";

type Common = { store: Tables<"stores">; canEdit: boolean };

/** Staff see the same forms, read-only. */
function Fields({ canEdit, children, className = "grid gap-4 sm:grid-cols-2" }: { canEdit: boolean; children: ReactNode; className?: string }) {
  return (
    <fieldset disabled={!canEdit} className={className}>
      {children}
    </fieldset>
  );
}

function SaveRow({ canEdit, label = "حفظ" }: { canEdit: boolean; label?: string }) {
  return canEdit ? (
    <div className="flex justify-end border-t border-line pt-4">
      <SubmitButton variant="primary">{label}</SubmitButton>
    </div>
  ) : null;
}

export function StoreProfileForm({ store, canEdit }: Common) {
  return (
    <Card className="p-5">
      <CardTitle icon={<Storefront className="size-4" />}>بيانات المتجر</CardTitle>
      <ActionForm action={updateStoreProfile} hiddenFields={{ storeId: store.id }} className="mt-5 flex flex-col gap-4">
        <Fields canEdit={canEdit}>
          <Field label="اسم المتجر" htmlFor="name">
            <Input id="name" name="name" required maxLength={120} defaultValue={store.name} />
          </Field>
          <Field label="رابط الموقع" htmlFor="websiteUrl">
            <Input id="websiteUrl" name="websiteUrl" type="url" dir="ltr" placeholder="https://" defaultValue={store.website_url ?? ""} />
          </Field>
          <Field label="رابط الشعار" htmlFor="logoUrl">
            <Input id="logoUrl" name="logoUrl" type="url" dir="ltr" placeholder="https://" defaultValue={store.logo_url ?? ""} />
          </Field>
          <Field label="واتساب المتجر" htmlFor="whatsapp" hint="مع رمز الدولة، مثال: 970591234567">
            <Input id="whatsapp" name="whatsapp" inputMode="tel" dir="ltr" defaultValue={store.whatsapp ?? ""} />
          </Field>
          <Field label="هاتف المتجر" htmlFor="phone">
            <Input id="phone" name="phone" inputMode="tel" dir="ltr" defaultValue={store.phone ?? ""} />
          </Field>
          <Field label="طريقة المخزون" htmlFor="inventoryMode" hint="في وضع «بالكمية» ينقص العدد عند تأكيد الطلب.">
            <Select id="inventoryMode" name="inventoryMode" defaultValue={store.inventory_mode}>
              <option value="flag">متوفر / نفد فقط</option>
              <option value="quantity">بالكمية</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Switch id="wholesaleEnabled" name="wholesaleEnabled" label="بيع جملة" description="يحوّل البوت طلبات الجملة إلى موظف" defaultChecked={store.wholesale_enabled} className="w-full" />
          </div>
        </Fields>
        <SaveRow canEdit={canEdit} />
      </ActionForm>
    </Card>
  );
}

export function PoliciesForm({ store, canEdit, policies }: Common & { policies: Settings["policies"] }) {
  if (!policies) return null;
  return (
    <Card className="p-5">
      <CardTitle icon={<ShieldCheck className="size-4" />}>سياسات المتجر</CardTitle>
      <p className="mt-1 text-[13px] text-muted">يجيب البوت العملاء بهذا النص حرفيًا، لذا اجعله واضحًا وصحيحًا.</p>
      <ActionForm action={updatePolicies} hiddenFields={{ storeId: store.id }} className="mt-5 flex flex-col gap-4">
        <Fields canEdit={canEdit}>
          <Field label="طرق الدفع" htmlFor="paymentMethods" hint="كل طريقة في سطر.">
            <Textarea id="paymentMethods" name="paymentMethods" rows={2} defaultValue={policies.payment_methods.join("\n")} />
          </Field>
          <Field label="مدة التوصيل" htmlFor="deliveryTimeText">
            <Textarea id="deliveryTimeText" name="deliveryTimeText" rows={2} maxLength={300} defaultValue={policies.delivery_time_text ?? ""} />
          </Field>
          <div className="flex flex-col gap-3">
            <Switch id="exchangeAllowed" name="exchangeAllowed" label="يوجد استبدال أو إرجاع" defaultChecked={policies.exchange_allowed} />
            <Field label="شروط الاستبدال (أو عبارة «لا يوجد استبدال»)" htmlFor="exchangeText">
              <Textarea id="exchangeText" name="exchangeText" rows={2} maxLength={600} defaultValue={policies.exchange_text ?? ""} />
            </Field>
          </div>
          <Field label="الإلغاء" htmlFor="cancellationText">
            <Textarea id="cancellationText" name="cancellationText" rows={2} maxLength={600} defaultValue={policies.cancellation_text ?? ""} />
          </Field>
          <Field label="ساعات العمل" htmlFor="workingHours">
            <Input id="workingHours" name="workingHours" maxLength={200} defaultValue={policies.working_hours ?? ""} />
          </Field>
          <Field label="الجملة" htmlFor="wholesaleText">
            <Textarea id="wholesaleText" name="wholesaleText" rows={2} maxLength={600} defaultValue={policies.wholesale_text ?? ""} />
          </Field>
        </Fields>
        <SaveRow canEdit={canEdit} label="حفظ السياسات" />
      </ActionForm>
    </Card>
  );
}

export function BotForm({ store, canEdit, bot, channels }: Common & { bot: Settings["bot"]; channels: Settings["channels"] }) {
  if (!bot) return null;
  return (
    <>
      <Card className="p-5">
        <CardTitle icon={<Robot className="size-4" />} aside={<Badge tone={bot.enabled ? "success" : "neutral"}>{bot.enabled ? "يعمل" : "متوقف"}</Badge>}>
          البوت
        </CardTitle>
        <ActionForm action={updateBotSettings} hiddenFields={{ storeId: store.id }} className="mt-5 flex flex-col gap-4">
          <Fields canEdit={canEdit}>
            <Field label="اسم المساعد" htmlFor="assistantName">
              <Input id="assistantName" name="assistantName" required maxLength={60} defaultValue={bot.assistant_name} />
            </Field>
            <Field label="واتساب التحويل لموظف" htmlFor="handoffWhatsapp" hint="إذا تُرك فارغًا يُستخدم واتساب المتجر">
              <Input id="handoffWhatsapp" name="handoffWhatsapp" inputMode="tel" dir="ltr" defaultValue={bot.handoff_whatsapp ?? ""} />
            </Field>
            <Field label="رسالة الترحيب (اختياري)" htmlFor="greetingText" className="sm:col-span-2">
              <Textarea id="greetingText" name="greetingText" rows={2} maxLength={400} defaultValue={bot.greeting_text ?? ""} />
            </Field>
            <Switch id="enabled" name="enabled" label="البوت يعمل" description="عند إيقافه لن يتلقى العملاء ردودًا آلية" defaultChecked={bot.enabled} />
            <Switch id="llmEnabled" name="llmEnabled" label="ردود طبيعية بالذكاء الاصطناعي" description="عند إيقافه يستخدم البوت ردودًا جاهزة فقط" defaultChecked={bot.llm_enabled} />
            <Switch id="useThumbnails" name="useThumbnails" label="صور مصغّرة في المحادثة" defaultChecked={bot.use_thumbnails} />
          </Fields>
          <SaveRow canEdit={canEdit} />
        </ActionForm>
      </Card>

      <Card className="p-5">
        <CardTitle icon={<ChatsCircle className="size-4" />}>القنوات</CardTitle>
        {channels.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">لا توجد قنوات مرتبطة. تواصل معنا لربط ماسنجر وإنستغرام.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-3 text-[14px]">
                <span className="font-semibold">
                  {CHANNEL_LABEL[c.type] ?? c.type}
                  {c.display_name ? <span className="font-normal text-muted"> · {c.display_name}</span> : null}
                </span>
                <Badge tone={c.status === "connected" ? "success" : c.status === "error" ? "danger" : "neutral"}>
                  {c.status === "connected" ? "مرتبطة" : c.status === "error" ? "بها مشكلة" : c.status === "pending" ? "قيد الربط" : "متوقفة"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export function ZonesEditor({ store, canEdit, zones }: Common & { zones: Settings["zones"] }) {
  return (
    <Card className="p-5">
      <CardTitle icon={<MapPin className="size-4" />}>مناطق التوصيل</CardTitle>
      <p className="mt-1 text-[13px] text-muted">«المدن» هي الكلمات التي يكتبها العميل، ومنها يعرف البوت المنطقة وسعر التوصيل.</p>
      <ul className="mt-4 flex flex-col gap-3">
        {zones.map((zone) => (
          <li key={zone.id}>
            <details className="group rounded-control border border-line">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4">
                <span className="font-semibold">{zone.name}</span>
                <span className="flex items-center gap-2">
                  {!zone.active ? <Badge>متوقفة</Badge> : null}
                  <span className="font-semibold text-primary-ink tabular">{formatMoney(zone.fee, store.currency_symbol)}</span>
                </span>
              </summary>
              <ZoneForm store={store} canEdit={canEdit} zone={zone} />
            </details>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <details className="mt-3 rounded-control border border-dashed border-line">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-semibold text-primary-ink">
            <Plus className="size-4" />
            منطقة جديدة
          </summary>
          <ZoneForm store={store} canEdit={canEdit} zone={null} />
        </details>
      ) : null}
    </Card>
  );
}

function ZoneForm({ store, canEdit, zone }: Common & { zone: Tables<"delivery_zones"> | null }) {
  const key = zone?.id ?? "new";
  return (
    <div className="flex flex-col gap-3 border-t border-line p-4">
      <ActionForm action={saveDeliveryZone} hiddenFields={{ storeId: store.id, zoneId: zone?.id ?? "" }} className="flex flex-col gap-4">
        <Fields canEdit={canEdit}>
          <Field label="اسم المنطقة" htmlFor={`zone-name-${key}`}>
            <Input id={`zone-name-${key}`} name="name" required maxLength={60} defaultValue={zone?.name ?? ""} />
          </Field>
          <Field label={`سعر التوصيل (${store.currency_symbol})`} htmlFor={`zone-fee-${key}`}>
            <Input id={`zone-fee-${key}`} name="fee" type="number" min={0} step="0.01" required inputMode="decimal" defaultValue={zone?.fee ?? ""} />
          </Field>
          <Field label="المدن والقرى" htmlFor={`zone-aliases-${key}`} hint="افصل بينها بفاصلة أو سطر جديد." className="sm:col-span-2">
            <Textarea id={`zone-aliases-${key}`} name="aliases" rows={3} defaultValue={zone?.aliases.join("، ") ?? ""} />
          </Field>
          <Field label="مدة التوصيل لهذه المنطقة (اختياري)" htmlFor={`zone-eta-${key}`}>
            <Input id={`zone-eta-${key}`} name="etaText" maxLength={200} defaultValue={zone?.eta_text ?? ""} />
          </Field>
          <Field label="الترتيب" htmlFor={`zone-sort-${key}`}>
            <Input id={`zone-sort-${key}`} name="sort" type="number" min={0} max={999} defaultValue={zone?.sort ?? 0} />
          </Field>
          <Switch id={`zone-active-${key}`} name="active" label="المنطقة مفعّلة" defaultChecked={zone?.active ?? true} />
        </Fields>
        {canEdit ? (
          <div className="flex justify-end gap-2">
            <SubmitButton variant="primary">{zone ? "حفظ" : "إضافة"}</SubmitButton>
          </div>
        ) : null}
      </ActionForm>
      {zone && canEdit ? (
        <div>
          <ConfirmActionButton
            action={deleteSettingItem}
            hiddenFields={{ storeId: store.id, kind: "zone", itemId: zone.id }}
            size="sm"
            icon={<Trash className="size-4" />}
            label="حذف المنطقة"
            title={`حذف منطقة «${zone.name}»؟`}
            description="بعد الحذف لن يعرف البوت سعر التوصيل لمدن هذه المنطقة."
            confirmLabel="نعم، احذف"
          />
        </div>
      ) : null}
    </div>
  );
}

export function CompaniesEditor({ store, canEdit, companies }: Common & { companies: Settings["companies"] }) {
  return (
    <Card className="p-5">
      <CardTitle icon={<Truck className="size-4" />}>شركات التوصيل</CardTitle>
      <p className="mt-1 text-[13px] text-muted">
        يمكن تخصيص نص «نسخ للتوصيل» لكل شركة. تُستبدل الكلمات بين الأقواس تلقائيًا:{" "}
        <span dir="ltr" className="font-mono text-[12px]">
          {"{ref} {name} {phone} {city} {address} {items} {total}"}
        </span>
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {companies.map((company) => (
          <li key={company.id}>
            <details className="rounded-control border border-line">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4">
                <span className="font-semibold">{company.name}</span>
                {!company.active ? <Badge>متوقفة</Badge> : null}
              </summary>
              <CompanyForm store={store} canEdit={canEdit} company={company} />
            </details>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <details className="mt-3 rounded-control border border-dashed border-line">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-semibold text-primary-ink">
            <Plus className="size-4" />
            شركة جديدة
          </summary>
          <CompanyForm store={store} canEdit={canEdit} company={null} />
        </details>
      ) : null}
    </Card>
  );
}

function CompanyForm({ store, canEdit, company }: Common & { company: Tables<"delivery_companies"> | null }) {
  const key = company?.id ?? "new";
  return (
    <div className="flex flex-col gap-3 border-t border-line p-4">
      <ActionForm action={saveDeliveryCompany} hiddenFields={{ storeId: store.id, companyId: company?.id ?? "" }} className="flex flex-col gap-4">
        <Fields canEdit={canEdit} className="flex flex-col gap-4">
          <Field label="اسم الشركة" htmlFor={`company-name-${key}`}>
            <Input id={`company-name-${key}`} name="name" required maxLength={60} defaultValue={company?.name ?? ""} />
          </Field>
          <Field label="نص النسخ (اختياري)" htmlFor={`company-template-${key}`} hint="إذا تُرك فارغًا يُستخدم النص الافتراضي.">
            <Textarea id={`company-template-${key}`} name="copyTemplate" rows={6} maxLength={1500} placeholder={DEFAULT_DELIVERY_TEMPLATE} defaultValue={company?.copy_template ?? ""} />
          </Field>
          <Switch id={`company-active-${key}`} name="active" label="الشركة مفعّلة" defaultChecked={company?.active ?? true} />
        </Fields>
        {canEdit ? (
          <div className="flex justify-end">
            <SubmitButton variant="primary">{company ? "حفظ" : "إضافة"}</SubmitButton>
          </div>
        ) : null}
      </ActionForm>
      {company && canEdit ? (
        <div>
          <ConfirmActionButton
            action={deleteSettingItem}
            hiddenFields={{ storeId: store.id, kind: "company", itemId: company.id }}
            size="sm"
            icon={<Trash className="size-4" />}
            label="حذف الشركة"
            title={`حذف «${company.name}»؟`}
            confirmLabel="نعم، احذف"
          />
        </div>
      ) : null}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { owner: "صاحب المتجر", staff: "موظف" };

export function TeamPanel({ store, canEdit, team, currentUserId }: Common & { team: Settings["team"]; currentUserId: string }) {
  return (
    <Card className="p-5">
      <CardTitle icon={<Users className="size-4" />}>الفريق</CardTitle>
      <ul className="mt-3 divide-y divide-line">
        {team.map((member) => (
          <li key={member.user_id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-primary-soft text-sm font-semibold uppercase text-primary-ink">{member.email.charAt(0)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-right text-[14px] font-semibold" dir="ltr">
                {member.email}
              </span>
              <span className="text-[12px] text-muted">
                {ROLE_LABEL[member.role] ?? member.role}
                {member.user_id === currentUserId ? " · أنت" : ""}
              </span>
            </span>
            {canEdit && member.user_id !== currentUserId ? (
              <ConfirmActionButton
                action={removeTeamMember}
                hiddenFields={{ storeId: store.id, userId: member.user_id }}
                size="sm"
                label="إزالة"
                title="إزالته من الفريق؟"
                description={
                  <>
                    <span dir="ltr">{member.email}</span> لن يتمكن من الدخول إلى المتجر بعد ذلك.
                  </>
                }
                confirmLabel="نعم، أزله"
              />
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <ActionForm action={addTeamMember} hiddenFields={{ storeId: store.id }} className="mt-2 flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="text-[14px] font-semibold">إضافة شخص</h3>
          <p className="text-[13px] text-muted">يجب أن يكون لديه حساب على المنصة أولًا. تواصل معنا لإنشائه.</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="البريد الإلكتروني" htmlFor="member-email">
              <Input id="member-email" name="email" type="email" required dir="ltr" maxLength={254} />
            </Field>
            <Field label="الدور" htmlFor="member-role">
              <Select id="member-role" name="role" defaultValue="staff">
                <option value="staff">موظف</option>
                <option value="owner">صاحب المتجر</option>
              </Select>
            </Field>
            <SubmitButton variant="primary">إضافة</SubmitButton>
          </div>
        </ActionForm>
      ) : null}
    </Card>
  );
}
