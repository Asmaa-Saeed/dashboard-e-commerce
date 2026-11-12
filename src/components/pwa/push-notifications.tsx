"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { BellRinging, BellSlash, Export, PlusSquare, X } from "@/components/ui/icons";
import { usePush, type PushState } from "./use-push";

type PushContextValue = ReturnType<typeof usePush>;
const PushContext = createContext<PushContextValue | null>(null);

/** One push state per store page, shared by the top-bar button and the reminder card. */
export function PushProvider({ storeId, children }: { storeId: string; children: ReactNode }) {
  const push = usePush(storeId);
  return <PushContext.Provider value={push}>{children}</PushContext.Provider>;
}

function usePushContext() {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error("usePushContext must be used inside <PushProvider>");
  return ctx;
}

const BUTTON_UI: Partial<Record<PushState, { label: string; on: boolean }>> = {
  on: { label: "إشعارات الهاتف مفعّلة (اضغط للإيقاف)", on: true },
  off: { label: "تفعيل إشعارات الهاتف", on: false },
  denied: { label: "الإشعارات محظورة من إعدادات المتصفح", on: false },
  "needs-install": { label: "ثبّت التطبيق أولًا لتفعيل الإشعارات", on: false },
};

/** Top-bar button: phone notifications on/off for this device. */
export function PushButton() {
  const { state, error, enable, disable } = usePushContext();
  const { toast } = useToast();

  useEffect(() => {
    if (error) toast({ tone: "error", title: error });
  }, [error, toast]);

  if (state === "unsupported") return null;
  const ui = BUTTON_UI[state] ?? { label: "جاري التحميل…", on: false };

  function onClick() {
    if (state === "on") void disable();
    else if (state === "off") void enable();
    else if (state === "denied")
      toast({ tone: "warning", title: "الإشعارات محظورة", description: "اسمح بالإشعارات لهذا الموقع من إعدادات المتصفح أو الهاتف، ثم أعد المحاولة." });
    else if (state === "needs-install")
      toast({ tone: "info", title: "ثبّت التطبيق أولًا", description: "على iPhone: زر المشاركة ← «إضافة إلى الشاشة الرئيسية»، ثم افتح التطبيق من الشاشة الرئيسية." });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "busy"}
      className={cn(
        "grid size-9 place-items-center rounded-control border bg-surface shadow-card transition disabled:opacity-60",
        ui.on ? "border-primary-ring text-primary" : "border-line text-muted hover:text-ink",
      )}
      aria-label={ui.label}
      title={ui.label}
    >
      {ui.on ? <BellRinging className="size-[18px]" weight="fill" /> : <BellSlash className="size-[18px]" />}
    </button>
  );
}

const DISMISS_KEY = "push-card-dismissed-at";
const DISMISS_DAYS = 7;

/** Reminder card on store pages until notifications are on for this phone. */
export function PushCard() {
  const { state, enable } = usePushContext();
  // Safe to read on first render: the card only shows after the push state loads in the browser,
  // so server and first client render both output nothing.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY));
      return Boolean(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
    } catch {
      return false;
    }
  });

  if (dismissed || (state !== "off" && state !== "needs-install")) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setDismissed(true);
  }

  return (
    <div role="region" aria-label="إشعارات الهاتف" className="flex items-start gap-3 rounded-card border border-primary-ring bg-primary-soft px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary text-on-primary">
        <BellRinging className="size-[18px]" weight="fill" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-ink">استلم إشعارًا مع كل طلب جديد</p>
        {state === "off" ? (
          <>
            <p className="mt-0.5 text-muted">وكل محادثة تحتاج إلى رد من موظف، حتى لو كان التطبيق مغلقًا.</p>
            <button
              type="button"
              onClick={() => void enable()}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 font-medium text-on-primary hover:bg-primary-hover"
            >
              <BellRinging className="size-4" />
              تفعيل الإشعارات
            </button>
          </>
        ) : (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-muted">
            على iPhone ثبّت التطبيق أولًا: زر المشاركة
            <Export className="size-4 text-ink" aria-label="مشاركة" />
            ثم «إضافة إلى الشاشة الرئيسية»
            <PlusSquare className="size-4 text-ink" aria-hidden />
            وافتحه من هناك.
          </p>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="إخفاء" className="-m-1 rounded-control p-1 text-subtle hover:text-ink">
        <X className="size-4" />
      </button>
    </div>
  );
}
