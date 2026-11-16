"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/cn";
import { PushButton } from "@/components/pwa/push-notifications";
import { stopPushOnThisDevice } from "@/components/pwa/use-push";
import {
  Bell,
  ChartBar,
  ChatsCircle,
  DotsThree,
  GearSix,
  Receipt,
  SignOut,
  SpeakerHigh,
  SpeakerSlash,
  SquaresFour,
  Tag,
  X,
  type Icon,
} from "@/components/ui/icons";
import type { NavCounts } from "@/features/stores/nav-counts";
import type { NotificationsSummary } from "@/features/notifications/queries";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useStoreLive, type LiveState } from "./store-live";

type Props = {
  store: { id: string; name: string; slug: string; logoUrl: string | null; timezone: string };
  userId: string;
  email: string;
  roleLabel: string;
  canManage: boolean;
  isAdmin: boolean;
  counts: NavCounts;
  notifications: NotificationsSummary;
  children: ReactNode;
};

type NavItem = { href: string; label: string; short?: string; icon: Icon; count?: number };

export function AppShell({ store, userId, email, roleLabel, canManage, isAdmin, counts, notifications, children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const base = `/s/${store.slug}`;
  const work: NavItem[] = [
    { href: `${base}/orders`, label: "الطلبات", icon: Receipt, count: counts.pendingOrders },
    { href: `${base}/conversations`, label: "المحادثات", icon: ChatsCircle, count: counts.needsReply },
    { href: `${base}/products`, label: "المنتجات والمخزون", short: "المنتجات", icon: Tag },
    { href: `${base}/notifications`, label: "الإشعارات", icon: Bell, count: notifications.unread },
  ];
  const insight: NavItem[] = [
    { href: `${base}/stats`, label: "الإحصائيات", icon: ChartBar },
    { href: `${base}/settings`, label: canManage ? "الإعدادات" : "معلومات المتجر", icon: GearSix },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const current = [...work, ...insight].find((item) => isActive(item.href));
  const close = () => setDrawerOpen(false);
  // Inside an open chat on a phone the tab bar steps aside, like a native messaging app.
  const inThread = isActive(`${base}/conversations`) && searchParams.has("id");

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only z-50 rounded-control bg-primary px-4 py-2 text-sm font-medium text-on-primary focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        انتقل إلى المحتوى
      </a>

      {/* sidebar: fixed on large screens, a drawer ("المزيد") on phones */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-[272px] flex-col border-e border-line bg-surface pt-[env(safe-area-inset-top)] transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-[256px] lg:translate-x-0 lg:pt-0",
          drawerOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-label="القائمة"
      >
        <div className="flex items-center gap-2 p-3">
          <StoreCard name={store.name} logoUrl={store.logoUrl} roleLabel={roleLabel} adminHref={isAdmin ? "/admin" : null} />
          <button type="button" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-muted lg:hidden" aria-label="إغلاق القائمة">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="القائمة الرئيسية">
          <NavGroup title="العمل اليومي" items={work} isActive={isActive} onNavigate={close} />
          <NavGroup title="المتابعة والإعداد" items={insight} isActive={isActive} onNavigate={close} />
        </nav>

        <DeviceControls />

        <div className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-[13px] font-semibold uppercase text-muted">{email.charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-right text-[13px] font-medium text-ink" dir="ltr">
                {email}
              </p>
              <p className="text-[12px] text-muted">{roleLabel}</p>
            </div>
            <form action={async () => { await stopPushOnThisDevice(); await signOut(); }}>
              <button type="submit" className="grid size-9 shrink-0 place-items-center rounded-control text-subtle transition hover:bg-danger-soft hover:text-danger" aria-label="تسجيل الخروج" title="تسجيل الخروج">
                <SignOut className="size-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {drawerOpen ? <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={close} aria-hidden="true" /> : null}

      <div className="min-w-0 flex-1">
        <TopBar
          store={store}
          userId={userId}
          pageLabel={current?.label ?? null}
          notifications={notifications}
          hiddenOnPhone={inThread}
        />
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-5 outline-none sm:px-6 lg:gap-6 lg:px-8 lg:py-6 lg:pb-6",
            inThread ? "max-lg:p-0 max-lg:pb-0" : "pb-[calc(84px+env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </main>
      </div>

      {inThread ? null : <BottomTabs items={work} isActive={isActive} onMore={() => setDrawerOpen(true)} moreActive={insight.some((i) => isActive(i.href))} />}
    </div>
  );
}

function NavGroup({ title, items, isActive, onNavigate }: { title: string; items: NavItem[]; isActive: (href: string) => boolean; onNavigate: () => void }) {
  return (
    <div className="pt-4">
      <p className="px-2.5 pb-1.5 text-[12px] font-medium text-subtle">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(item.href);
          const ItemIcon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex h-10 items-center gap-2.5 rounded-control px-2.5 text-[14px] transition lg:h-9",
                  active ? "bg-primary-soft font-semibold text-primary-ink" : "font-medium text-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                <ItemIcon weight={active ? "fill" : "regular"} className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-subtle")} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.count ? (
                  <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular", active ? "bg-primary text-on-primary" : "bg-surface-muted text-muted")}>
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Phones: this device's alert sound and phone notifications, inside the "المزيد" drawer. */
function DeviceControls() {
  const { soundOn, setSoundOn } = useStoreLive();
  return (
    <div className="border-t border-line px-3 py-3 lg:hidden">
      <p className="px-2.5 pb-2 text-[12px] font-medium text-subtle">هذا الجهاز</p>
      <div className="flex items-center gap-2 px-1">
        <PushButton />
        <button
          type="button"
          onClick={() => setSoundOn(!soundOn)}
          className={cn(
            "flex h-9 flex-1 items-center gap-2 rounded-control border bg-surface px-3 text-[13px] font-medium shadow-card transition",
            soundOn ? "border-line text-muted" : "border-danger/30 text-danger",
          )}
        >
          {soundOn ? <SpeakerHigh className="size-[18px]" /> : <SpeakerSlash className="size-[18px]" />}
          {soundOn ? "صوت التنبيه مفعّل" : "صوت التنبيه متوقف"}
        </button>
      </div>
    </div>
  );
}

/** Phone navigation: four daily tabs plus "المزيد" (the drawer), above the home indicator. */
function BottomTabs({ items, isActive, onMore, moreActive }: { items: NavItem[]; isActive: (href: string) => boolean; onMore: () => void; moreActive: boolean }) {
  const cell = "relative flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition active:scale-95";
  return (
    <nav
      aria-label="التنقل السريع"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-12px_rgb(16_24_40/0.18)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = isActive(item.href);
          const ItemIcon = item.icon;
          return (
            <li key={item.href} className="flex flex-1">
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(cell, active ? "text-primary-ink" : "text-subtle")}>
                <span className={cn("relative grid h-8 w-14 place-items-center rounded-full transition", active && "bg-primary-soft")}>
                  <ItemIcon weight={active ? "fill" : "regular"} className={cn("size-[22px]", active ? "text-primary" : "")} />
                  {item.count ? (
                    <span className="absolute -top-1 end-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] leading-none font-bold text-white tabular">
                      {item.count > 99 ? "99+" : item.count}
                    </span>
                  ) : null}
                </span>
                <span className={cn(active && "font-semibold")}>{item.short ?? item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button type="button" onClick={onMore} className={cn(cell, moreActive ? "text-primary-ink" : "text-subtle")}>
            <span className={cn("grid h-8 w-14 place-items-center rounded-full", moreActive && "bg-primary-soft")}>
              <DotsThree weight="bold" className={cn("size-[22px]", moreActive && "text-primary")} />
            </span>
            <span className={cn(moreActive && "font-semibold")}>المزيد</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** The store this dashboard belongs to. A client account has exactly one; only the admin can jump to the admin page. */
function StoreCard({ name, logoUrl, roleLabel, adminHref }: { name: string; logoUrl: string | null; roleLabel: string; adminHref: string | null }) {
  const body = (
    <>
      <StoreLogo name={name} logoUrl={logoUrl} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[14px] font-semibold text-ink">{name}</span>
        <span className="block truncate text-[12px] text-muted">{roleLabel}</span>
      </span>
      {adminHref ? <SquaresFour className="size-4 shrink-0 text-subtle" /> : null}
    </>
  );
  const cls = "flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-line bg-surface p-2 shadow-card";
  return adminHref ? (
    <Link href={adminHref} className={cn(cls, "transition hover:bg-surface-muted")} title="إدارة المنصة">
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function StoreLogo({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- the store's own logo, from its site
    <img src={logoUrl} alt="" className={cn("size-8 shrink-0 rounded-[8px] border border-line object-cover", className)} />
  ) : (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-[8px] bg-primary text-[14px] font-semibold text-on-primary", className)}>{name.trim().charAt(0)}</span>
  );
}

function TopBar({
  store,
  userId,
  pageLabel,
  notifications,
  hiddenOnPhone,
}: {
  store: Props["store"];
  userId: string;
  pageLabel: string | null;
  notifications: NotificationsSummary;
  hiddenOnPhone: boolean;
}) {
  const { live, soundOn, setSoundOn } = useStoreLive();
  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-md",
        hiddenOnPhone && "max-lg:hidden",
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* phones: the store's logo and the page name, like an app title bar */}
        <StoreLogo name={store.name} logoUrl={store.logoUrl} className="lg:hidden" />
        <nav aria-label="المسار" className="flex min-w-0 items-center gap-2 text-[14px]">
          <span className="hidden truncate text-muted lg:inline">{store.name}</span>
          {pageLabel ? (
            <>
              <span className="hidden text-subtle lg:inline" aria-hidden="true">
                /
              </span>
              <span className="truncate text-[17px] font-semibold text-ink lg:text-[14px] lg:font-medium">{pageLabel}</span>
            </>
          ) : null}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LiveBadge state={live} />
          <span className="hidden sm:contents">
            <PushButton />
          </span>
          <button
            type="button"
            onClick={() => setSoundOn(!soundOn)}
            className={cn(
              "hidden size-9 place-items-center rounded-control border bg-surface shadow-card transition sm:grid",
              soundOn ? "border-line text-muted hover:text-ink" : "border-danger/30 text-danger",
            )}
            aria-label={soundOn ? "إيقاف صوت التنبيه" : "تشغيل صوت التنبيه"}
            title={soundOn ? "صوت التنبيه مفعّل" : "صوت التنبيه متوقف"}
          >
            {soundOn ? <SpeakerHigh className="size-[18px]" /> : <SpeakerSlash className="size-[18px]" />}
          </button>
          <NotificationBell storeId={store.id} userId={userId} slug={store.slug} timezone={store.timezone} items={notifications.items} unread={notifications.unread} />
        </div>
      </div>
    </header>
  );
}

const LIVE_UI: Record<LiveState, { label: string; dot: string }> = {
  live: { label: "مباشر", dot: "bg-success" },
  connecting: { label: "جاري الاتصال…", dot: "bg-warning" },
  offline: { label: "غير متصل، حدّث الصفحة", dot: "bg-danger" },
};

function LiveBadge({ state }: { state: LiveState }) {
  const ui = LIVE_UI[state];
  return (
    <span
      className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-2.5 text-[13px] font-medium text-muted shadow-card sm:rounded-control sm:px-3"
      title="تظهر الطلبات والرسائل الجديدة تلقائيًا دون تحديث الصفحة"
      aria-label={ui.label}
    >
      <span className="relative flex size-2">
        {state === "live" ? <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", ui.dot)} /> : null}
        <span className={cn("relative size-2 rounded-full", ui.dot)} />
      </span>
      <span className="hidden sm:inline">{ui.label}</span>
    </span>
  );
}
