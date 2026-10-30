import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChatCircle, Clock, MapPin, Note, Phone, Warning } from "@/components/ui/icons";
import { telUrl } from "@/lib/contact";
import { cn } from "@/lib/cn";
import { formatMoney, formatTimeAgo } from "@/lib/format";
import type { OrderCardData } from "../queries";
import { isOrderStatus, STATUS_LABEL, STATUS_TONE } from "../status";
import { OrderStatusActions } from "./order-status-actions";

export function OrderCard({
  order,
  storeId,
  currencySymbol,
  detailsHref,
  conversationHref,
  highlighted,
}: {
  order: OrderCardData;
  storeId: string;
  currencySymbol: string;
  detailsHref: string;
  conversationHref: string | null;
  highlighted?: boolean;
}) {
  const status = isOrderStatus(order.status) ? order.status : "pending_review";
  const openRequest = order.order_requests.some((r) => r.status === "open");
  const tel = telUrl(order.customer_phone);

  return (
    <article
      id={`order-${order.id}`}
      className={cn("relative scroll-mt-24 overflow-hidden rounded-card border bg-surface shadow-card", highlighted ? "border-primary ring-4 ring-primary/15" : "border-line")}
    >
      <div className="p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-ink tabular" dir="ltr">
              {order.ref}
            </h3>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            {order.is_demo ? <Badge>تجريبي</Badge> : null}
          </div>
          <p className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-subtle tabular">
            <Clock className="size-3" />
            {formatTimeAgo(order.created_at)}
          </p>
        </header>

        {openRequest ? (
          <p className="mt-3 flex items-center gap-1.5 rounded-control bg-warning-soft px-3 py-2 text-[13px] font-semibold text-warning">
            <Warning className="size-4 shrink-0" />
            طلب العميل تعديلًا أو إلغاءً
          </p>
        ) : null}

        <div className="mt-3 flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-primary-soft text-sm font-semibold text-primary-ink">{order.customer_name.trim().charAt(0)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">{order.customer_name}</p>
            {tel ? (
              <a href={tel} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-primary-ink" dir="ltr">
                <Phone className="size-3" />
                {order.customer_phone}
              </a>
            ) : null}
          </div>
          {conversationHref ? (
            <Link
              href={conversationHref}
              title="فتح المحادثة مع العميل"
              aria-label={`فتح المحادثة مع ${order.customer_name}`}
              className="grid size-9 shrink-0 place-items-center rounded-chip border border-line text-muted transition hover:border-primary-ring hover:text-primary-ink"
            >
              <ChatCircle className="size-4" />
            </Link>
          ) : null}
        </div>

        {order.city || order.address ? (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-control bg-surface-muted px-3 py-2 text-[13px] text-ink">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              {[order.city, order.address].filter(Boolean).join("، ")}
              {order.zone_name ? <span className="text-muted"> · {order.zone_name}</span> : null}
            </span>
          </p>
        ) : null}

        <ul className="mt-3.5 space-y-2">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5 text-[14px]">
              <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md bg-primary-soft px-1 text-[12px] font-semibold text-primary-ink tabular">{item.quantity}×</span>
              <p className="min-w-0 flex-1 leading-6 font-medium text-ink">
                {item.product_name}
                {item.option_label ? <span className="text-muted"> · {item.option_label}</span> : null}
              </p>
              <span className="shrink-0 leading-6 text-muted tabular">{formatMoney(item.line_total, currencySymbol)}</span>
            </li>
          ))}
        </ul>

        {order.customer_note ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-control bg-warning-soft px-3 py-2 text-[13px] font-medium text-ink">
            <Note className="mt-0.5 size-3.5 shrink-0 text-warning" />
            {order.customer_note}
          </p>
        ) : null}

        <div className="mt-3.5 flex items-center justify-between border-t border-dashed border-line pt-3">
          <span className="text-[13px] text-muted">
            المبلغ المطلوب
            {order.delivery_fee ? <span className="text-subtle"> (شامل التوصيل {formatMoney(order.delivery_fee, currencySymbol)})</span> : null}
          </span>
          <span className="text-lg font-semibold text-primary-ink tabular">{formatMoney(order.total, currencySymbol)}</span>
        </div>

        <div className="mt-3.5">
          <OrderStatusActions storeId={storeId} orderId={order.id} orderRef={order.ref} customerName={order.customer_name} status={status} detailsHref={detailsHref} compact />
        </div>
      </div>
    </article>
  );
}
