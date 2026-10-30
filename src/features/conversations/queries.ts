import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export const CONVERSATIONS_PAGE_SIZE = 30;
const MESSAGES_SHOWN = 200;

export type ConversationFilter = "needs" | "human" | "all";

export async function listConversations(supabase: ServerSupabase, storeId: string, { filter, page }: { filter: ConversationFilter; page: number }) {
  const from = (page - 1) * CONVERSATIONS_PAGE_SIZE;
  let query = supabase
    .from("conversations")
    .select("id, display_name, channel_type, status, handoff_reason, last_message_at, last_message_preview, customer_id, orders(id)", { count: "exact" })
    .eq("store_id", storeId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(from, from + CONVERSATIONS_PAGE_SIZE - 1);
  if (filter === "needs") query = query.eq("status", "needs_human");
  if (filter === "human") query = query.eq("status", "human");

  const { data, count, error } = await query;
  if (error) throw new Error(`listConversations: ${error.message}`);
  return { conversations: data, total: count ?? 0 };
}

export async function countConversations(supabase: ServerSupabase, storeId: string) {
  const [needs, human, all] = await Promise.all([
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "needs_human"),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "human"),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("store_id", storeId),
  ]);
  return { needs: needs.count ?? 0, human: human.count ?? 0, all: all.count ?? 0 };
}

export async function getConversation(supabase: ServerSupabase, storeId: string, conversationId: string) {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id, display_name, channel_type, status, handoff_reason, handoff_at, bot_paused_until, last_message_at, created_at, customers(name, phone, city), orders(id, ref, status)")
    .eq("store_id", storeId)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new Error(`getConversation: ${error.message}`);
  if (!conversation) return null;

  // newest first from the database, shown oldest first
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, role, text, meta, created_at")
    .eq("store_id", storeId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_SHOWN);
  if (messagesError) throw new Error(`getConversation messages: ${messagesError.message}`);

  // Meta accepts a reply only within 24 hours of the customer's last message
  const lastCustomerAt = messages.find((m) => m.role === "customer")?.created_at ?? null;
  const replyWindowOpen = !!lastCustomerAt && Date.now() - new Date(lastCustomerAt).getTime() < 24 * 3_600_000;
  return { conversation, messages: messages.reverse(), truncated: messages.length === MESSAGES_SHOWN, replyWindowOpen };
}

/** How a staff reply did on its way to Messenger / Instagram (messages.meta.delivery). */
export function deliveryOf(meta: unknown): "queued" | "sending" | "sent" | "failed" | null {
  const value = meta && typeof meta === "object" && "delivery" in meta ? (meta as { delivery: unknown }).delivery : null;
  return value === "queued" || value === "sending" || value === "sent" || value === "failed" ? value : null;
}
