"use client";

import { useCallback, useEffect, useState } from "react";
import { registerPushSubscription, unregisterPushSubscription } from "@/features/push/actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/**
 * unsupported  → this browser can't get notifications (or the app isn't configured yet)
 * needs-install → iPhone: notifications work only after "Add to Home Screen"
 * off / on / denied / busy
 */
export type PushState = "unsupported" | "needs-install" | "off" | "on" | "denied" | "busy";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function base64UrlToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

async function save(storeId: string, sub: PushSubscription) {
  const json = sub.toJSON();
  return registerPushSubscription({
    storeId,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: navigator.userAgent.slice(0, 300),
  });
}

async function subscribe(storeId: string) {
  const reg = await getRegistration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
  return save(storeId, sub);
}

/** Turns phone notifications on/off for this device and one store. */
export function usePush(storeId: string) {
  const [state, setState] = useState<PushState>("busy");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const set = (s: PushState) => !cancelled && setState(s);

    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!VAPID_PUBLIC_KEY) return set("unsupported");
      if (!supported) return set(isIos() && !isStandalone() ? "needs-install" : "unsupported");
      if (Notification.permission === "denied") return set("denied");
      if (Notification.permission !== "granted") return set("off");

      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return set("off");
      // Re-save on every visit: links the phone to this store and keeps it fresh.
      const result = await save(storeId, sub);
      set(result.ok ? "on" : "off");
    })().catch(() => set("off"));

    // The browser rotated the push address (see public/sw.js): save the new one.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "push-subscription-changed" && Notification.permission === "granted") {
        void subscribe(storeId).catch(() => {});
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    return () => {
      cancelled = true;
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [storeId]);

  const enable = useCallback(async () => {
    setError(null);
    setState("busy");
    try {
      // Must run straight from the tap: iPhone only allows the permission prompt after a user action.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const result = await subscribe(storeId);
      if (!result.ok) {
        setError(result.error);
        setState("off");
        return;
      }
      setState("on");
    } catch {
      setError("تعذّر تفعيل الإشعارات على هذا الجهاز.");
      setState("off");
    }
  }, [storeId]);

  const disable = useCallback(async () => {
    setError(null);
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unregisterPushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }, []);

  return { state, error, enable, disable };
}

/** Called on sign-out so a shared phone stops getting this account's notifications. */
export async function stopPushOnThisDevice() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await unregisterPushSubscription(sub.endpoint);
    await sub.unsubscribe();
  } catch {
    /* signing out must never be blocked by this */
  }
}
