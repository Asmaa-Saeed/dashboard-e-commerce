import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export type NavCounts = { pendingOrders: number; needsReply: number };

/** Small numbers shown next to the menu items. */
export async function getNavCounts(supabase: ServerSupabase, storeId: string): Promise<NavCounts> {
  const [orders, conversations] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "pending_review"),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "needs_human"),
  ]);
  return { pendingOrders: orders.count ?? 0, needsReply: conversations.count ?? 0 };
}
