import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export const PRODUCTS_PAGE_SIZE = 25;
export type ProductFilter = "all" | "out";

/** Escapes LIKE wildcards so a search for "50%" means the text "50%". */
function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listProducts(
  supabase: ServerSupabase,
  storeId: string,
  { filter, search, page }: { filter: ProductFilter; search: string; page: number },
) {
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  let query = supabase
    .from("products")
    .select(
      "id, external_id, name, url, thumbnail_url, image_url, price, original_price, max_price, out_of_stock, in_feed, product_variants(id, label, color, size, price, stock_qty, out_of_stock, low_stock_threshold, in_feed)",
      { count: "exact" },
    )
    .eq("store_id", storeId)
    .eq("in_feed", true)
    .order("name")
    .range(from, from + PRODUCTS_PAGE_SIZE - 1);

  if (search) query = query.ilike("name", likePattern(search));
  if (filter === "out") query = query.eq("out_of_stock", true);

  const { data, count, error } = await query;
  if (error) throw new Error(`listProducts: ${error.message}`);
  return { products: data, total: count ?? 0 };
}

export type ProductRow = Awaited<ReturnType<typeof listProducts>>["products"][number];

export async function countProducts(supabase: ServerSupabase, storeId: string) {
  const base = () => supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("in_feed", true);
  const [all, out] = await Promise.all([base(), base().eq("out_of_stock", true)]);
  return { all: all.count ?? 0, out: out.count ?? 0 };
}

export async function recentMovements(supabase: ServerSupabase, storeId: string) {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("id, delta, reason, note, created_at, product_variants(label, products(name))")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) throw new Error(`recentMovements: ${error.message}`);
  return data;
}
