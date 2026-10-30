import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_STATUSES, DONE_STATUSES, type OrderStatus } from "./status";

export const HISTORY_PAGE_SIZE = 30;
const BOARD_LIMIT = 150;

const CARD_FIELDS =
  "id, ref, status, customer_name, customer_phone, city, zone_name, address, subtotal, delivery_fee, total, customer_note, is_demo, created_at, conversation_id, order_items(id, product_name, option_label, quantity, line_total), order_requests(status)";

/**
 * Search text is reduced to letters, digits, spaces and dashes before it reaches the query,
 * so it can't change the filter (PostgREST "or" filters treat commas and brackets as syntax).
 */
export function cleanSearch(raw: string | undefined): string {
  return (raw ?? "").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function searchFilter(q: string) {
  const like = `%${q}%`;
  return `ref.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`;
}

async function fetchCards(supabase: ServerSupabase, storeId: string, statuses: readonly OrderStatus[], q: string, range?: [number, number]) {
  let query = supabase
    .from("orders")
    .select(CARD_FIELDS, { count: "exact" })
    .eq("store_id", storeId)
    .in("status", [...statuses])
    .order("created_at", { ascending: range === undefined });
  if (q) query = query.or(searchFilter(q));
  query = range ? query.range(range[0], range[1]) : query.limit(BOARD_LIMIT);
  const { data, count, error } = await query;
  if (error) throw new Error(`orders: ${error.message}`);
  return { rows: data, total: count ?? 0 };
}

export type OrderCardData = Awaited<ReturnType<typeof fetchCards>>["rows"][number];

/** Orders on the board, oldest first so the one waiting longest is on top. */
export async function listActiveOrders(supabase: ServerSupabase, storeId: string, q: string) {
  const { rows } = await fetchCards(supabase, storeId, ACTIVE_STATUSES, q);
  const columns: Record<(typeof ACTIVE_STATUSES)[number], OrderCardData[]> = { pending_review: [], confirmed: [], shipped: [] };
  for (const row of rows) {
    if (row.status in columns) columns[row.status as keyof typeof columns].push(row);
  }
  return { columns, total: rows.length };
}

/** Delivered and cancelled orders, newest first. */
export async function listDoneOrders(supabase: ServerSupabase, storeId: string, q: string, page: number) {
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  return fetchCards(supabase, storeId, DONE_STATUSES, q, [from, from + HISTORY_PAGE_SIZE - 1]);
}

export async function getOrder(supabase: ServerSupabase, storeId: string, orderId: string) {
  const [order, companies] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, order_items(id, product_name, option_label, quantity, unit_price, line_total), order_requests(id, type, text, status, created_at), order_status_history(id, from_status, to_status, created_at)",
      )
      .eq("store_id", storeId)
      .eq("id", orderId)
      .maybeSingle(),
    supabase.from("delivery_companies").select("id, name, copy_template").eq("store_id", storeId).eq("active", true).order("name"),
  ]);
  if (order.error) throw new Error(`getOrder: ${order.error.message}`);
  if (!order.data) return null;
  return { order: order.data, deliveryCompanies: companies.data ?? [] };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
