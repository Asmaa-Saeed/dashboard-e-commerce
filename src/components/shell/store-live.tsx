"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { playNewOrderChime, unlockAudio } from "@/lib/sound";
import { useToast } from "@/components/ui/toast";

export type LiveState = "connecting" | "live" | "offline";

const LiveContext = createContext<{ live: LiveState; soundOn: boolean; setSoundOn: (on: boolean) => void } | null>(null);

const SOUND_KEY = "dashboard.sound";
const WATCHED = ["orders", "order_requests", "conversations", "messages"] as const;

// The sound choice lives in this browser only (localStorage); other tabs follow via the storage event.
const SOUND_EVENT = "dashboard-sound-change";
function readSoundSetting() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}
function subscribeSound(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SOUND_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SOUND_EVENT, onChange);
  };
}
function writeSoundSetting(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* storage blocked: the choice is not remembered */
  }
  window.dispatchEvent(new Event(SOUND_EVENT));
}

/**
 * Keeps the store's pages up to date while open: new orders and messages refresh the page,
 * a new order also shows a toast and plays a chime. Realtime applies Row Level Security,
 * so a browser only hears about its own store.
 */
export function StoreLive({ storeId, ordersHref, children }: { storeId: string; ordersHref: string; children: ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [live, setLive] = useState<LiveState>("connecting");
  const soundOn = useSyncExternalStore(subscribeSound, readSoundSetting, () => true);
  const soundRef = useRef(soundOn);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const setSoundOn = useCallback((on: boolean) => {
    writeSoundSetting(on);
    if (on) {
      unlockAudio();
      playNewOrderChime();
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`store-${storeId}`);
    const refreshSoon = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 700);
    };

    for (const table of WATCHED) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `store_id=eq.${storeId}` }, (payload) => {
        if (table === "orders" && payload.eventType === "INSERT") {
          const row = payload.new as { ref?: string; customer_name?: string };
          if (soundRef.current) playNewOrderChime();
          toast({
            tone: "order",
            title: "وصل طلب جديد",
            description: [row.ref, row.customer_name].filter(Boolean).join(" · "),
            duration: 0,
            action: { label: "عرض الطلبات", onClick: () => router.push(ordersHref) },
          });
        }
        refreshSoon();
      });
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") setLive("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLive("offline");
    });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [storeId, ordersHref, router, toast]);

  return <LiveContext.Provider value={{ live, soundOn, setSoundOn }}>{children}</LiveContext.Provider>;
}

export function useStoreLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useStoreLive must be used inside <StoreLive>");
  return ctx;
}
