import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className, as: Tag = "section", label }: { children: ReactNode; className?: string; as?: "section" | "div" | "article"; label?: string }) {
  return (
    <Tag aria-label={label} className={cn("rounded-card border border-line bg-surface shadow-card", className)}>
      {children}
    </Tag>
  );
}

export function CardTitle({ children, aside, icon }: { children: ReactNode; aside?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
        {icon ? <span className="grid size-8 place-items-center rounded-control border border-line bg-surface text-muted shadow-card">{icon}</span> : null}
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid place-items-center px-6 py-14 text-center", className)}>
      {icon ? <span className="grid size-12 place-items-center rounded-card border border-line bg-surface text-subtle shadow-card">{icon}</span> : null}
      <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
      {children ? <p className="mt-1 max-w-sm text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function KeyValue({ label, children, ltr = false }: { label: string; children: ReactNode; ltr?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={cn("text-[15px] font-semibold break-words text-ink", ltr && "text-right [direction:ltr]")}>{children}</dd>
    </div>
  );
}

/** Underlined tabs, as plain links (each tab is its own URL). */
export function TabLinks({ tabs, label }: { tabs: Array<{ href: string; label: string; active: boolean; count?: number; icon?: ReactNode }>; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-6 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 text-[14px] font-medium transition",
            t.active ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.icon ? <span className={t.active ? "text-primary" : ""}>{t.icon}</span> : null}
          {t.label}
          {t.count !== undefined ? (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular", t.active ? "bg-primary-soft text-primary-ink" : "bg-surface-muted text-muted")}>
              {t.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** Pill switcher (filters, periods), as links. */
export function SegmentLinks({ items, label }: { items: Array<{ href: string; label: string; active: boolean; count?: number }>; label: string }) {
  return (
    <nav aria-label={label} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-control border border-line bg-surface-muted p-0.5">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "true" : undefined}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium transition",
            i.active ? "bg-surface text-ink shadow-[0_1px_2px_rgb(16_24_40/0.08),0_0_0_1px_rgb(16_24_40/0.04)]" : "text-muted hover:text-ink",
          )}
        >
          {i.label}
          {i.count !== undefined ? <span className={cn("rounded-full px-1.5 text-[11px] tabular", i.active ? "bg-primary-soft text-primary-ink" : "bg-line/70")}>{i.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
