import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonClass, ExternalButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Phone, Warning, WhatsappLogo, X } from "@/components/ui/icons";
import { KeyValue } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { telUrl, whatsappUrl } from "@/lib/contact";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";
import { resolveOrderRequest, saveOrderDetails } from "../actions";
import type { OrderDetail as OrderDetailData } from "../queries";
import { ACTIVE_STATUSES, isOrderStatus, STATUS_LABEL, STATUS_TONE } from "../status";
import { CopyDeliveryText } from "./copy-delivery-text";
import { OrderStatusActions } from "./order-status-actions";

const PROGRESS = [...ACTIVE_STATUSES, "delivered"] as const;

/** Full order, shown as a side panel over the board. */
export function OrderDetailSheet({ data, store, closeHref }: { data: OrderDetailData; store: Tables<"stores">; closeHref: string }) {
  const { order, deliveryCompanies } = data;
  const status = isOrderStatus(order.status) ? order.status : "pending_review";
  const symbol = store.currency_symbol;
  const tz = store.timezone;
  const openRequests = order.order_requests.filter((r) => r.status === "open");
  const step = (PROGRESS as readonly string[]).indexOf(status);
  const wa = whatsappUrl(order.customer_phone);
  const tel = telUrl(order.customer_phone);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="order-title">
      <Link href={closeHref} scroll={false} aria-label="إغلاق" className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" />
      <section className="relative flex h-full w-full max-w-[560px] animate-slide-in flex-col overflow-y-auto bg-canvas shadow-pop">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <div>
            <p className="text-[12px] text-muted">رقم الطلب</p>
            <h2 id="order-title" className="text-xl font-semibold text-ink tabular" dir="ltr">
              {order.ref}
            </h2>
            <p className="text-[13px] text-muted">
              {formatDateTime(order.created_at, tz)} · {order.source === "bot" ? "من البوت" : order.source === "manual" ? "يدوي" : "من الموقع"}
              {order.is_demo ? " · تجريبي" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            <Link href={closeHref} scroll={false} className={buttonClass("ghost", "icon", "size-9")} aria-label="إغلاق">
              <X className="size-5" />
            </Link>
          </div>
        </header>

        <div className="flex flex-col gap-4 p-5">
          {status !== "cancelled" ? (
            <ol className="grid grid-cols-4 gap-1.5" aria-label="مراحل الطلب">
              {PROGRESS.map((s, i) => (
                <li key={s} className="flex flex-col gap-1.5">
                  <span className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-line"}`} />
                  <span className={`text-[11px] leading-tight ${i === step ? "font-semibold text-ink" : "text-muted"}`}>{STATUS_LABEL[s]}</span>
                </li>
              ))}
            </ol>
          ) : order.cancel_reason ? (
            <p className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">سبب الإلغاء: {order.cancel_reason}</p>
          ) : null}

          {openRequests.map((request) => (
            <div key={request.id} className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-3.5">
              <Warning className="mt-0.5 size-5 shrink-0 text-warning" />
              <div className="min-w-0 grow">
                <p className="font-semibold text-warning">{request.type === "cancel" ? "طلب العميل إلغاء الطلب" : "طلب العميل تعديل الطلب"}</p>
                {request.text ? <p className="mt-0.5 text-[14px] text-ink">«{request.text}»</p> : null}
                <p className="text-[12px] text-muted">{formatDateTime(request.created_at, tz)}</p>
              </div>
              <ActionForm action={resolveOrderRequest} hiddenFields={{ storeId: store.id, requestId: request.id, status: "done" }}>
                <SubmitButton size="sm" variant="outline">
                  تم
                </SubmitButton>
              </ActionForm>
            </div>
          ))}

          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <KeyValue label="الاسم">{order.customer_name}</KeyValue>
              <KeyValue label="الهاتف" ltr>
                {order.customer_phone}
                {order.customer_phone2 ? ` / ${order.customer_phone2}` : ""}
              </KeyValue>
              <KeyValue label="المنطقة">
                {order.city ?? "—"}
                {order.zone_name ? ` (${order.zone_name})` : ""}
              </KeyValue>
              <KeyValue label="العنوان">{order.address ?? "—"}</KeyValue>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {tel ? (
                <a href={tel} className={buttonClass("outline", "sm")}>
                  <Phone className="size-4" />
                  اتصال
                </a>
              ) : null}
              {wa ? (
                <ExternalButton href={wa} size="sm">
                  <WhatsappLogo className="size-4" />
                  واتساب
                </ExternalButton>
              ) : null}
            </div>
          </div>

          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <h3 className="mb-3 text-[15px] font-semibold">المنتجات</h3>
            <ul className="space-y-2.5">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 text-[14px]">
                  <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md bg-primary-soft px-1 text-[12px] font-semibold text-primary-ink tabular">{item.quantity}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-6">{item.product_name}</p>
                    <p className="text-[12px] text-muted">
                      {item.option_label ? `${item.option_label} · ` : ""}
                      {formatMoney(item.unit_price, symbol)} للقطعة
                    </p>
                  </div>
                  <span className="shrink-0 leading-6 font-semibold tabular">{formatMoney(item.line_total, symbol)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-dashed border-line pt-3 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-muted">المنتجات</dt>
                <dd className="tabular">{formatMoney(order.subtotal, symbol)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">التوصيل</dt>
                <dd className="tabular">{formatMoney(order.delivery_fee, symbol)}</dd>
              </div>
              <div className="flex justify-between pt-1 text-lg font-semibold">
                <dt>المبلغ المطلوب من العميل</dt>
                <dd className="text-primary-ink tabular">{formatMoney(order.total, symbol)}</dd>
              </div>
            </dl>
            <p className="mt-1 text-[12px] text-muted">
              {order.payment_method === "cod" ? "الدفع عند الاستلام" : order.payment_method}
              {status === "pending_review" ? " · تأكد من توفر المنتجات قبل التأكيد" : ""}
            </p>
          </div>

          <CopyDeliveryText
            companies={deliveryCompanies}
            defaultCompanyId={order.delivery_company_id}
            order={{
              ref: order.ref,
              customerName: order.customer_name,
              phone: order.customer_phone,
              phone2: order.customer_phone2,
              city: order.city,
              address: order.address,
              total: order.total ?? order.subtotal + order.delivery_fee,
              currencySymbol: symbol,
              items: order.order_items.map((i) => ({ name: i.product_name, option: i.option_label, quantity: i.quantity })),
            }}
          />

          <OrderStatusActions storeId={store.id} orderId={order.id} orderRef={order.ref} customerName={order.customer_name} status={status} />

          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <h3 className="mb-3 text-[15px] font-semibold">شركة التوصيل وملاحظات</h3>
            <ActionForm action={saveOrderDetails} hiddenFields={{ storeId: store.id, orderId: order.id }} className="grid gap-3 sm:grid-cols-2">
              <Field label="شركة التوصيل" htmlFor="deliveryCompanyId">
                <Select id="deliveryCompanyId" name="deliveryCompanyId" defaultValue={order.delivery_company_id ?? ""}>
                  <option value="">—</option>
                  {deliveryCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="رقم الشحنة" htmlFor="trackingNo">
                <Input id="trackingNo" name="trackingNo" maxLength={80} defaultValue={order.tracking_no ?? ""} dir="ltr" />
              </Field>
              <Field label="ملاحظة للفريق" htmlFor="staffNote" className="sm:col-span-2">
                <Textarea id="staffNote" name="staffNote" maxLength={1000} rows={2} defaultValue={order.staff_note ?? ""} />
              </Field>
              <div>
                <SubmitButton variant="outline" size="sm">
                  حفظ
                </SubmitButton>
              </div>
            </ActionForm>
          </div>

          {order.order_status_history.length > 1 ? (
            <details className="rounded-card border border-line bg-surface p-4">
              <summary className="cursor-pointer text-[14px] font-semibold text-muted">سجل الحالات</summary>
              <ol className="mt-2 space-y-1 text-[13px] text-muted">
                {[...order.order_status_history]
                  .sort((a, b) => a.id - b.id)
                  .map((h) => (
                    <li key={h.id} className="tabular">
                      {formatDateTime(h.created_at, tz)}: {isOrderStatus(h.to_status) ? STATUS_LABEL[h.to_status] : h.to_status}
                    </li>
                  ))}
              </ol>
            </details>
          ) : null}
        </div>
      </section>
    </div>
  );
}
