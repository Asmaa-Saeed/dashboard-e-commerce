import "server-only";
import { z } from "zod";
import type { ServerSupabase } from "@/lib/supabase/server";

const count = z.coerce.number().catch(0);

// store_stats returns JSON; validate its shape instead of trusting it.
const statsSchema = z.object({
  conversations: z.number().catch(0),
  orders: z.number().catch(0),
  orders_value: z.coerce.number().catch(0),
  delivered: z.number().catch(0),
  cancelled: z.number().catch(0),
  conversion_pct: z.coerce.number().catch(0),
  handoffs: z.number().catch(0),
  top_products: z.array(z.object({ name: z.string().nullable(), count })).catch([]),
  no_result_searches: z.array(z.object({ query: z.string().nullable(), count })).catch([]),
  handoff_reasons: z.array(z.object({ reason: z.string().nullable(), count })).catch([]),
});

export type StoreStats = z.infer<typeof statsSchema>;

export const STATS_RANGES = { "7": 7, "30": 30, "90": 90 } as const;
export type StatsRange = keyof typeof STATS_RANGES;

export async function getStoreStats(supabase: ServerSupabase, storeId: string, range: StatsRange): Promise<StoreStats> {
  const from = new Date(Date.now() - STATS_RANGES[range] * 86_400_000).toISOString();
  const { data, error } = await supabase.rpc("store_stats", { p_store: storeId, p_from: from });
  if (error) throw new Error(`store_stats: ${error.message}`);
  return statsSchema.parse(data ?? {});
}
