import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationsSummary = { items: NotificationItem[]; unread: number };

const COLUMNS = "id, kind, title, body, url, read_at, created_at";

/** The current person's newest notifications in one store (RLS also limits rows to them). */
export async function listNotifications(supabase: ServerSupabase, storeId: string, userId: string, limit = 20): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  // The bell must never break the page (e.g. before 06_notifications.sql has been run).
  if (error) {
    console.error("[listNotifications]", error.message);
    return [];
  }
  return data;
}

export async function countUnread(supabase: ServerSupabase, storeId: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    console.error("[countUnread]", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getNotificationsSummary(supabase: ServerSupabase, storeId: string, userId: string, limit = 15): Promise<NotificationsSummary> {
  const [items, unread] = await Promise.all([listNotifications(supabase, storeId, userId, limit), countUnread(supabase, storeId, userId)]);
  return { items, unread };
}
