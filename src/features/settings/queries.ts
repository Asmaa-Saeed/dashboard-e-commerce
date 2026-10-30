import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export async function getSettings(supabase: ServerSupabase, storeId: string) {
  const [policies, bot, zones, companies, team, channels] = await Promise.all([
    supabase.from("store_policies").select("*").eq("store_id", storeId).maybeSingle(),
    supabase.from("bot_settings").select("*").eq("store_id", storeId).maybeSingle(),
    supabase.from("delivery_zones").select("*").eq("store_id", storeId).order("sort").order("name"),
    supabase.from("delivery_companies").select("*").eq("store_id", storeId).order("name"),
    supabase.rpc("store_team", { p_store: storeId }),
    supabase.from("channels").select("id, type, display_name, status, connected_at").eq("store_id", storeId).order("type"),
  ]);
  for (const [name, result] of Object.entries({ policies, bot, zones, companies, team, channels })) {
    if (result.error) throw new Error(`getSettings ${name}: ${result.error.message}`);
  }
  return {
    policies: policies.data,
    bot: bot.data,
    zones: zones.data ?? [],
    companies: companies.data ?? [],
    team: team.data ?? [],
    channels: channels.data ?? [],
  };
}

export type Settings = Awaited<ReturnType<typeof getSettings>>;
