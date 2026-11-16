"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { Bell, BellRinging, Checks, X } from "@/components/ui/icons";
import { markNotificationsRead } from "../actions";
import { NotificationRow, type NotificationView } from "./notification-list";

type Props = {
  storeId: string;
  userId: string;
  slug: string;
  timezone: string;
  items: NotificationView[];
  unread: number;
};

/**
 * The bell in the top bar: unread count, a panel with the newest notifications
 * (a dropdown on wide screens, a bottom sheet on phones), live updates while open.
 */
export function NotificationBell({ storeId, userId, slug, timezone, items, unread }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // New notification for me → refresh the bell; orders already have their own toast and chime.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload.new as { store_id?: string; kind?: string; title?: string; body?: string | null };
        if (row.store_id !== storeId) return;
        if (row.kind !== "order") toast({ tone: row.kind === "stock" ? "warning" : "info", title: row.title ?? "إشعار جديد", description: row.body ?? undefined });
        router.refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [storeId, userId, router, toast]);

  // Close on Escape or a click outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function markAll() {
    startTransition(async () => {
      const form = new FormData();
      form.set("storeId", storeId);
      await markNotificationsRead(null, form);
      router.refresh();
    });
  }

  const label = unread ? `الإشعارات، ${unread} غير مقروءة` : "الإشعارات";

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className={cn(
          "relative grid size-10 place-items-center rounded-full border bg-surface shadow-card transition active:scale-95 sm:size-9 sm:rounded-control",
          open ? "border-primary-ring text-primary" : "border-line text-muted hover:text-ink",
        )}
      >
        {unread ? <BellRinging className="size-[19px]" weight="fill" /> : <Bell className="size-[19px]" />}
        {unread ? (
          <span className="absolute -end-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] leading-none font-bold text-white tabular">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* phones: dimmed backdrop behind the bottom sheet */}
          <div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[1px] sm:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            ref={panel}
            role="dialog"
            aria-label="الإشعارات"
            className={cn(
              "z-50 flex flex-col overflow-hidden bg-surface shadow-pop",
              "fixed inset-x-0 bottom-0 max-h-[82dvh] rounded-t-[22px] pb-[env(safe-area-inset-bottom)] animate-slide-in",
              "sm:absolute sm:inset-x-auto sm:end-0 sm:top-[calc(100%+8px)] sm:bottom-auto sm:max-h-[min(560px,75dvh)] sm:w-[400px] sm:rounded-card sm:border sm:border-line sm:pb-0 sm:animate-pop-in",
            )}
          >
            <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
            <header className="flex items-center gap-2 px-4 pt-3 pb-2">
              <h2 className="flex-1 text-[16px] font-semibold text-ink">الإشعارات</h2>
              {unread ? (
                <button
                  type="button"
                  onClick={markAll}
                  disabled={pending}
                  className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-primary-ink transition hover:bg-primary-soft disabled:opacity-60"
                >
                  <Checks className="size-4" />
                  تعليم الكل كمقروء
                </button>
              ) : null}
              <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-muted sm:hidden" aria-label="إغلاق">
                <X className="size-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
              {items.length === 0 ? (
                <div className="grid place-items-center px-6 py-12 text-center">
                  <span className="grid size-14 place-items-center rounded-full bg-surface-muted text-subtle">
                    <Bell className="size-7" />
                  </span>
                  <p className="mt-3 text-[14px] font-semibold text-ink">لا توجد إشعارات بعد</p>
                  <p className="mt-1 text-[13px] text-muted">ستظهر هنا الطلبات الجديدة والمحادثات التي تحتاج إلى رد.</p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <NotificationRow item={item} storeId={storeId} timezone={timezone} onOpen={() => setOpen(false)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-line p-2">
              <Link
                href={`/s/${slug}/notifications`}
                onClick={() => setOpen(false)}
                className="flex h-10 items-center justify-center rounded-control text-[13px] font-semibold text-primary-ink transition hover:bg-primary-soft"
              >
                عرض كل الإشعارات
              </Link>
            </footer>
          </div>
        </>
      ) : null}
    </div>
  );
}
