"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/cn";
import { Bell, BellSlash, ChartBar, ChatsCircle, GearSix, List, Receipt, SignOut, SquaresFour, Tag, X, type Icon } from "@/components/ui/icons";
import type { NavCounts } from "@/features/stores/nav-counts";
import { useStoreLive, type LiveState } from "./store-live";

type Props = {
  store: { name: string; slug: string; logoUrl: string | null };
  email: string;
  roleLabel: string;
  canManage: boolean;
  isAdmin: boolean;
  counts: NavCounts;
  children: ReactNode;
};

type NavItem = { href: string; label: string; icon: Icon; count?: number };

export function AppShell({ store, email, roleLabel, canManage, isAdmin, counts, children }: Props) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const base = `/s/${store.slug}`;
  const work: NavItem[] = [
    { href: `${base}/orders`, label: "الطلبات", icon: Receipt, count: counts.pendingOrders },
    { href: `${base}/conversations`, label: "المحادثات", icon: ChatsCircle, count: counts.needsReply },
    { href: `${base}/products`, label: "المنتجات والمخزون", icon: Tag },
  ];
  const insight: NavItem[] = [
    { href: `${base}/stats`, label: "الإحصائيات", icon: ChartBar },
    { href: `${base}/settings`, label: canManage ? "الإعدادات" : "معلومات المتجر", icon: GearSix },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const current = [...work, ...insight].find((item) => isActive(item.href));
  const close = () => setDrawerOpen(false);

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only z-50 rounded-control bg-primary px-4 py-2 text-sm font-medium text-on-primary focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        انتقل إلى المحتوى
      </a>

      {/* sidebar: fixed on large screens, a drawer on phones */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-40 flex w-[256px] flex-col border-e border-line bg-surface transition-transform duration-300 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          drawerOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 p-3">
          <StoreCard name={store.name} logoUrl={store.logoUrl} roleLabel={roleLabel} adminHref={isAdmin ? "/admin" : null} />
          <button type="button" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-surface-muted lg:hidden" aria-label="إغلاق القائمة">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="القائمة الرئيسية">
          <NavGroup title="العمل اليومي" items={work} isActive={isActive} onNavigate={close} />
          <NavGroup title="المتابعة والإعداد" items={insight} isActive={isActive} onNavigate={close} />
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-[13px] font-semibold uppercase text-muted">{email.charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-right text-[13px] font-medium text-ink" dir="ltr">
                {email}
              </p>
              <p className="text-[12px] text-muted">{roleLabel}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="grid size-8 shrink-0 place-items-center rounded-control text-subtle transition hover:bg-danger-soft hover:text-danger" aria-label="تسجيل الخروج" title="تسجيل الخروج">
                <SignOut className="size-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {drawerOpen ? <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={close} aria-hidden="true" /> : null}

      <div className="min-w-0 flex-1">
        <TopBar storeName={store.name} pageLabel={current?.label ?? null} onMenu={() => setDrawerOpen(true)} />
        <main id="main" tabIndex={-1} className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
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
                  "flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[14px] transition",
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

function StoreLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- the store's own logo, from its site
    <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-[6px] border border-line object-cover" />
  ) : (
    <span className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-primary text-[14px] font-semibold text-on-primary">{name.trim().charAt(0)}</span>
  );
}

function TopBar({ storeName, pageLabel, onMenu }: { storeName: string; pageLabel: string | null; onMenu: () => void }) {
  const { live, soundOn, setSoundOn } = useStoreLive();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button type="button" onClick={onMenu} className="grid size-9 place-items-center rounded-control border border-line bg-surface text-ink shadow-card lg:hidden" aria-label="فتح القائمة">
        <List className="size-[18px]" />
      </button>
      <nav aria-label="المسار" className="flex min-w-0 items-center gap-2 text-[14px]">
        <span className="hidden truncate text-muted sm:inline">{storeName}</span>
        {pageLabel ? (
          <>
            <span className="hidden text-subtle sm:inline" aria-hidden="true">
              /
            </span>
            <span className="truncate font-medium text-ink">{pageLabel}</span>
          </>
        ) : null}
      </nav>
      <div className="ms-auto flex items-center gap-2">
        <LiveBadge state={live} />
        <button
          type="button"
          onClick={() => setSoundOn(!soundOn)}
          className={cn("grid size-9 place-items-center rounded-control border bg-surface shadow-card transition", soundOn ? "border-line text-muted hover:text-ink" : "border-danger/30 text-danger")}
          aria-label={soundOn ? "إيقاف صوت التنبيه" : "تشغيل صوت التنبيه"}
          title={soundOn ? "صوت التنبيه مفعّل" : "صوت التنبيه متوقف"}
        >
          {soundOn ? <Bell className="size-[18px]" /> : <BellSlash className="size-[18px]" />}
        </button>
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
    <span className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13px] font-medium text-muted shadow-card" title="تظهر الطلبات والرسائل الجديدة تلقائيًا دون تحديث الصفحة">
      <span className="relative flex size-2">
        {state === "live" ? <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", ui.dot)} /> : null}
        <span className={cn("relative size-2 rounded-full", ui.dot)} />
      </span>
      <span className="hidden sm:inline">{ui.label}</span>
    </span>
  );
}
