"use client";

import { useEffect, useState } from "react";
import { DownloadSimple, Export, PlusSquare, X } from "@/components/ui/icons";

// Chrome/Android fire this event when the app can be installed.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 14;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Only Safari can add to the home screen on older iOS; other iOS browsers show their own menu.
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  return isIos && isSafari;
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Registers the service worker and offers to install the dashboard as an app:
 * an "install" button on Android/Chrome, short Add-to-Home-Screen steps on iPhone.
 */
export function PwaInstall() {
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }

    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIosSafari()) iosTimer = setTimeout(() => setMode("ios"), 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setMode("hidden");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setMode("hidden");
  }

  if (mode === "hidden") return null;

  return (
    <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center">
      <div
        role="dialog"
        aria-label="تثبيت التطبيق"
        className="flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-card border border-line bg-surface p-3.5 shadow-pop"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-[10px]" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-ink">ثبّت Flowpal على هاتفك</p>
          {mode === "prompt" ? (
            <>
              <p className="mt-0.5 text-muted">افتح لوحة المتجر بلمسة واحدة مثل أي تطبيق.</p>
              <button
                type="button"
                onClick={install}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 font-medium text-on-primary hover:bg-primary-hover"
              >
                <DownloadSimple className="size-4" />
                تثبيت التطبيق
              </button>
            </>
          ) : (
            <ol className="mt-1 space-y-1 text-muted">
              <li className="flex items-center gap-1.5">
                ١. اضغط زر المشاركة
                <Export className="size-4 shrink-0 text-ink" aria-label="مشاركة" />
                في Safari
              </li>
              <li className="flex items-center gap-1.5">
                ٢. اختر «إضافة إلى الشاشة الرئيسية»
                <PlusSquare className="size-4 shrink-0 text-ink" aria-hidden />
              </li>
            </ol>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="إغلاق" className="-m-1 rounded-control p-1 text-subtle hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
