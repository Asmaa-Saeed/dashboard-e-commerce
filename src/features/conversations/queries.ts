import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { CHANNELS, type Channel } from "./labels";

export const CONVERSATIONS_PAGE_SIZE = 30;
const MESSAGES_SHOWN = 200;

export type ConversationQuery = { channel: Channel | null; needs: boolean; page: number };

export async function listConversations(supabase: ServerSupabase, storeId: string, { channel, needs, page }: ConversationQuery) {
  const from = (page - 1) * CONVERSATIONS_PAGE_SIZE;
  let query = supabase
    .from("conversations")
    .select("id, display_name, username, channel_type, status, handoff_reason, last_message_at, last_message_preview, customer_id, customers(name), orders(id)", { count: "exact" })
    .eq("store_id", storeId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(from, from + CONVERSATIONS_PAGE_SIZE - 1);
  if (channel) query = query.eq("channel_type", channel);
  if (needs) query = query.eq("status", "needs_human");

  const { data, count, error } = await query;
  if (error) throw new Error(`listConversations: ${error.message}`);
  return { conversations: data, total: count ?? 0 };
}

export type ConversationCounts = { all: number; needs: number; needsByChannel: Record<Channel, number> };

/** Totals for the toggle and the channel column: how many conversations wait for a person, per channel. */
export async function countConversations(supabase: ServerSupabase, storeId: string, channel: Channel | null): Promise<ConversationCounts> {
  const head = () => supabase.from("conversations").select("id", { count: "exact", head: true }).eq("store_id", storeId);
  const scoped = () => (channel ? head().eq("channel_type", channel) : head());
  const [all, needs, ...perChannel] = await Promise.all([
    scoped(),
    scoped().eq("status", "needs_human"),
    ...CHANNELS.map((c) => head().eq("channel_type", c).eq("status", "needs_human")),
  ]);
  const needsByChannel = Object.fromEntries(CHANNELS.map((c, i) => [c, perChannel[i].count ?? 0])) as Record<Channel, number>;
  return { all: all.count ?? 0, needs: needs.count ?? 0, needsByChannel };
}

export async function getConversation(supabase: ServerSupabase, storeId: string, conversationId: string) {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id, display_name, username, channel_type, status, handoff_reason, handoff_at, handled_at, bot_paused_until, last_message_at, created_at, customers(name, phone, city), orders(id, ref, status)")
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
