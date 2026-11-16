import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/lib/format";
import { Check, ChatsCircle, HandPalm, Receipt } from "@/components/ui/icons";
import { conversationTitle, handoffLabel } from "../labels";
import { channelUi } from "./channel-ui";

export type ConversationListItem = {
  id: string;
  display_name: string | null;
  username: string | null;
  channel_type: string;
  status: string;
  handoff_reason: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  customers: { name: string | null } | null;
  orders: Array<{ id: string }>;
};

type Props = {
  title: string;
  conversations: ConversationListItem[];
  selectedId: string | null;
  needsOnly: boolean;
  needsCount: number;
  timezone: string;
  hrefFor: (id: string) => string;
  toggleHref: string;
  pagination?: ReactNode;
  now?: number;
};

/** The list column: a header with the «يحتاج تدخل بشري» switch, then one row per conversation. */
export function ConversationList({ title, conversations, selectedId, needsOnly, needsCount, timezone, hrefFor, toggleHref, pagination, now }: Props) {
  return (
    <section aria-label={title} className="flex min-h-0 flex-col lg:rounded-[18px] lg:border lg:border-line lg:bg-surface lg:shadow-card">
      <header className="flex flex-wrap items-center gap-3 pb-3 lg:border-b lg:border-line lg:px-4 lg:py-4">
        <h2 className="flex-1 text-[19px] font-semibold tracking-tight text-ink lg:text-[17px]">{title}</h2>
        <NeedsSwitch href={toggleHref} on={needsOnly} count={needsCount} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {conversations.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-surface-muted text-subtle">
              {needsOnly ? <Check className="size-7" /> : <ChatsCircle className="size-7" />}
            </span>
            <p className="mt-3 text-[15px] font-semibold text-ink">{needsOnly ? "لا أحد ينتظر موظفًا الآن" : "لا توجد محادثات بعد"}</p>
            <p className="mt-1 max-w-[260px] text-[13px] text-muted">
              {needsOnly ? "عندما يطلب عميل التحدث مع شخص، تظهر محادثته هنا مع علامة اليد المرفوعة." : "تظهر هنا رسائل العملاء من كل القنوات المربوطة."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2 lg:gap-0 lg:divide-y lg:divide-line lg:px-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <Row item={c} selected={c.id === selectedId} href={hrefFor(c.id)} timezone={timezone} now={now} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {pagination}
    </section>
  );
}

function Row({ item, selected, href, timezone, now }: { item: ConversationListItem; selected: boolean; href: string; timezone: string; now?: number }) {
  const name = conversationTitle({ display_name: item.display_name, customer_name: item.customers?.name });
  const channel = channelUi(item.channel_type);
  const ChannelIcon = channel.icon;
  const needs = item.status === "needs_human";

  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex gap-3 px-3 py-3.5 transition active:scale-[0.99]",
        // phones: each conversation is its own rounded row
        "rounded-[16px] border border-line bg-surface shadow-card lg:rounded-[12px] lg:border-0 lg:shadow-none",
        selected ? "lg:bg-primary-soft/70" : "lg:hover:bg-surface-muted",
        needs && "max-lg:border-warning/40",
      )}
    >
      <span className="relative shrink-0">
        <Avatar name={name} />
        <span className="absolute -end-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border-2 border-surface bg-surface shadow-card">
          <ChannelIcon className={cn("size-3.5", channel.mark)} weight="fill" />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{name}</span>
          <span className="shrink-0 text-[12px] text-subtle tabular">{formatTimeAgo(item.last_message_at, timezone, now)}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted">{item.last_message_preview ?? "—"}</span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusChip status={item.status} reason={item.handoff_reason} />
          {item.orders.length ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-success-soft px-2 text-[11px] font-semibold text-success">
              <Receipt className="size-3.5" />
              أرسل طلبًا
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-[1.5px] border-[#c7d2e0] bg-[#eef2f7] font-semibold text-[#3d4f66]",
        size === "lg" ? "size-12 text-[17px]" : "size-12 text-[16px] lg:size-11 lg:text-[15px]",
      )}
      aria-hidden="true"
    >
      {name.trim().charAt(0)}
    </span>
  );
}

export function StatusChip({ status, reason }: { status: string; reason: string | null }) {
  if (status === "needs_human")
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-soft px-2 text-[11px] font-semibold text-warning">
        <HandPalm className="size-3.5" weight="fill" />
        {handoffLabel(reason) ?? "يحتاج تدخل بشري"}
      </span>
    );
  if (status === "human") return <span className="inline-flex h-6 items-center rounded-full bg-info-soft px-2 text-[11px] font-semibold text-info">يرد موظف</span>;
  if (status === "closed")
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-full border border-line bg-surface-muted px-2 text-[11px] font-semibold text-neutral">
        <Check className="size-3" weight="bold" />
        تم الحل
      </span>
    );
  return null;
}

/** «يحتاج تدخل بشري»: a link styled as a switch, so the filter is a shareable URL and works without JavaScript. */
function NeedsSwitch({ href, on, count }: { href: string; on: boolean; count: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      role="switch"
      aria-checked={on}
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-full border px-3 text-[13px] font-medium transition active:scale-[0.98]",
        on ? "border-warning/40 bg-warning-soft text-ink" : "border-line bg-surface-muted text-muted hover:text-ink",
      )}
    >
      <HandPalm className={cn("size-[18px]", on ? "text-warning" : "text-subtle")} weight={on ? "fill" : "regular"} />
      يحتاج تدخل بشري
      {count ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-warning px-1.5 text-[11px] font-bold text-white tabular">{count}</span> : null}
      <span className={cn("relative h-5 w-9 rounded-full transition", on ? "bg-warning" : "bg-line")} aria-hidden="true">
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[inset-inline-start]", on ? "start-[18px]" : "start-0.5")} />
      </span>
    </Link>
  );
}
