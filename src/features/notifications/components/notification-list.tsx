"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/lib/format";
import { ChatsCircle, CreditCard, Megaphone, NotePencil, Package, Receipt, type Icon } from "@/components/ui/icons";
import { isNotificationKind, safeNotificationUrl, type NotificationKind } from "../labels";
import { markNotificationsRead } from "../actions";

export type NotificationView = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

const KIND_UI: Record<NotificationKind, { icon: Icon; tile: string }> = {
  order: { icon: Receipt, tile: "bg-primary-soft text-primary" },
  handoff: { icon: ChatsCircle, tile: "bg-warning-soft text-warning" },
  order_request: { icon: NotePencil, tile: "bg-info-soft text-info" },
  stock: { icon: Package, tile: "bg-danger-soft text-danger" },
  announcement: { icon: Megaphone, tile: "bg-accent-soft text-accent" },
  subscription: { icon: CreditCard, tile: "bg-neutral-soft text-neutral" },
};

/** One row in the bell panel or on the notifications page. Opening it marks it read. */
export function NotificationRow({
  item,
  storeId,
  timezone,
  onOpen,
  now,
}: {
  item: NotificationView;
  storeId: string;
  timezone: string;
  onOpen?: () => void;
  now?: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const ui = KIND_UI[isNotificationKind(item.kind) ? item.kind : "announcement"];
  const KindIcon = ui.icon;
  const href = safeNotificationUrl(item.url);
  const unread = !item.read_at;

  function open() {
    onOpen?.();
    startTransition(async () => {
      if (unread) {
        const form = new FormData();
        form.set("storeId", storeId);
        form.set("notificationId", item.id);
        await markNotificationsRead(null, form);
      }
      if (href) router.push(href);
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "group flex w-full items-start gap-3 rounded-[12px] px-3 py-3 text-start transition active:scale-[0.99]",
        unread ? "bg-primary-soft/60 hover:bg-primary-soft" : "hover:bg-surface-muted",
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", ui.tile)}>
        <KindIcon className="size-5" weight={unread ? "fill" : "regular"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-[14px] leading-snug text-ink", unread ? "font-semibold" : "font-medium")}>{item.title}</span>
          <span className="mt-0.5 shrink-0 text-[11px] text-subtle tabular">{formatTimeAgo(item.created_at, timezone, now)}</span>
        </span>
        {item.body ? <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-muted">{item.body}</span> : null}
      </span>
      {unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="غير مقروء" /> : null}
    </button>
  );
}
