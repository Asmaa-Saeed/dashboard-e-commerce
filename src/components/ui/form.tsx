import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "h-10 w-full rounded-control border border-line bg-surface px-3 text-[14px] text-ink shadow-card transition placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15 disabled:bg-surface-muted disabled:text-muted";

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "h-auto min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "pe-9", className)} {...props} />;
}

/**
 * On/off switch that is a real checkbox underneath, so it submits with its form
 * and works with the keyboard and screen readers.
 */
export function Switch({ label, description, id, className, ...props }: ComponentProps<"input"> & { label: string; description?: string; id: string }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-control border border-line bg-surface px-3.5 py-2.5", className)}>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {description ? <span className="block text-[12px] text-muted">{description}</span> : null}
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" {...props} />
        <span className="absolute inset-0 rounded-full bg-line transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
        <span className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-[inset-inline-start] peer-checked:start-[1.375rem]" />
      </span>
    </label>
  );
}

export function SearchField({ name, defaultValue, placeholder, label, className }: { name: string; defaultValue?: string; placeholder: string; label: string; className?: string }) {
  return (
    <label className={cn("flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 shadow-card transition focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15", className)}>
      <svg className="size-[18px] shrink-0 text-subtle" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
        <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
      </svg>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={80}
        className="h-full w-full bg-transparent text-sm text-ink outline-none placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  );
}
