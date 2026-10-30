import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type MyStore = { id: string; slug: string; name: string; role: string; brandColor: string; logoUrl: string | null };

/** Stores the current user can open (all of them for a platform admin). */
export const getMyStores = cache(async (): Promise<MyStore[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_stores");
  if (error) {
    console.error("[my_stores]", error.code, error.message);
    return [];
  }
  return data.map((s) => ({ id: s.store_id, slug: s.slug, name: s.name, role: s.role, brandColor: s.brand_color, logoUrl: s.logo_url }));
});
