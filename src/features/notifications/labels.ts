// Pure helpers for notifications (no imports, so the unit tests can load them directly).

/** Same list as the check constraint in supabase/06_notifications.sql. */
export const NOTIFICATION_KINDS = ["order", "handoff", "order_request", "stock", "announcement", "subscription"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  order: "طلب جديد",
  handoff: "محادثة تحتاج إلى رد",
  order_request: "طلب تعديل",
  stock: "نفد من المخزون",
  announcement: "من Flowpal",
  subscription: "الاشتراك",
};

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

/** Only links inside the dashboard ("/…", never "//…" or "/\…"). Anything else → null. */
export function safeNotificationUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith("/")) return null;
  if (url.startsWith("//") || url.startsWith("/\\")) return null;
  return url;
}

const dayKey = (time: number, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(time);

/** Groups newest-first items under «اليوم», «أمس», then a date — days counted in the store's timezone. */
export function groupByDay<T extends { created_at: string }>(items: T[], timeZone: string, now = Date.now()) {
  const today = dayKey(now, timeZone);
  const yesterday = dayKey(now - 86_400_000, timeZone);
  const groups: Array<{ label: string; items: T[] }> = [];
  for (const item of items) {
    const time = Date.parse(item.created_at);
    const key = dayKey(time, timeZone);
    const label =
      key === today
        ? "اليوم"
        : key === yesterday
          ? "أمس"
          : new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone, day: "numeric", month: "long" }).format(time);
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
