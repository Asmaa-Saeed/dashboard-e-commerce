import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { CircleNotch } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(16_24_40/0.08)] hover:bg-primary-hover",
  secondary: "border border-line bg-surface text-ink shadow-card hover:bg-surface-muted",
  outline: "border border-line bg-surface text-ink shadow-card hover:border-primary-ring hover:text-primary-ink",
  ghost: "text-muted hover:bg-surface-muted hover:text-ink",
  danger: "bg-danger text-white shadow-card hover:brightness-95",
  "danger-ghost": "text-danger hover:bg-danger-soft",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
  icon: "size-10",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra = "") {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-control font-medium transition disabled:pointer-events-none disabled:opacity-55 [&>svg]:shrink-0",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

type Common = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = "secondary", size = "md", loading, disabled, className, children, type = "button", ...rest }: ComponentProps<"button"> & Common & { loading?: boolean }) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)} {...rest}>
      {loading ? <CircleNotch className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "secondary", size = "md", className, ...rest }: ComponentProps<typeof Link> & Common) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

/** For links that leave the dashboard (WhatsApp, the store's site). */
export function ExternalButton({ variant = "outline", size = "md", className, ...rest }: ComponentProps<"a"> & Common) {
  return <a target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)} {...rest} />;
}
