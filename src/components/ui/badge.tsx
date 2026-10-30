import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "warning" | "info" | "accent" | "success" | "neutral" | "danger" | "primary";

export const TONE: Record<Tone, { text: string; soft: string; dot: string }> = {
  warning: { text: "text-warning", soft: "bg-warning-soft", dot: "bg-warning" },
  info: { text: "text-info", soft: "bg-info-soft", dot: "bg-info" },
  accent: { text: "text-accent", soft: "bg-accent-soft", dot: "bg-accent" },
  success: { text: "text-success", soft: "bg-success-soft", dot: "bg-success" },
  neutral: { text: "text-neutral", soft: "bg-neutral-soft", dot: "bg-neutral" },
  danger: { text: "text-danger", soft: "bg-danger-soft", dot: "bg-danger" },
  primary: { text: "text-primary-ink", soft: "bg-primary-soft", dot: "bg-primary" },
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium", TONE[tone].soft, TONE[tone].text, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", TONE[tone].dot)} aria-hidden="true" />
      {children}
    </span>
  );
}
