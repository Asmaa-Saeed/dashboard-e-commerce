"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BellRinging, CheckCircle, Info, Warning, X, XCircle } from "./icons";

export type ToastTone = "success" | "warning" | "error" | "info" | "order";

export type ToastInput = {
  tone: ToastTone;
  title: string;
  description?: string;
  /** milliseconds; 0 = stays until closed */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ toast: (t: ToastInput) => number; dismiss: (id: number) => void } | null>(null);

const TONE: Record<ToastTone, { icon: typeof Info; wrap: string; iconClass: string }> = {
  success: { icon: CheckCircle, wrap: "border-line", iconClass: "bg-success-soft text-success" },
  warning: { icon: Warning, wrap: "border-warning/40", iconClass: "bg-warning-soft text-warning" },
  error: { icon: XCircle, wrap: "border-danger/40", iconClass: "bg-danger-soft text-danger" },
  info: { icon: Info, wrap: "border-line", iconClass: "bg-info-soft text-info" },
  order: { icon: BellRinging, wrap: "border-primary-ring ring-4 ring-primary/10", iconClass: "bg-primary text-on-primary" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-4), { ...t, id }]);
      const duration = t.duration ?? (t.tone === "error" || t.tone === "warning" ? 8000 : 4500);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:left-6 sm:items-end">
        {items.map((t) => {
          const tone = TONE[t.tone];
          const Icon = tone.icon;
          return (
            <div
              key={t.id}
              role={t.tone === "error" || t.tone === "order" ? "alert" : "status"}
              className={cn("pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-card border bg-surface p-3.5 shadow-pop", tone.wrap)}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-chip", tone.iconClass)}>
                <Icon className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.description ? <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{t.description}</p> : null}
                {t.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-2 text-[13px] font-semibold text-primary-ink hover:text-primary-hover"
                  >
                    {t.action.label}
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="إغلاق" className="grid size-7 shrink-0 place-items-center rounded-full text-subtle transition hover:bg-surface-muted hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
