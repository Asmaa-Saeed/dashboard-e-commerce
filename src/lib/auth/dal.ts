import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Data Access Layer: the only place that decides who the user is and what they may do.
 * Pages call these before loading data, and every Server Action calls them again,
 * because a Server Action can be invoked directly without going through the page.
 * Row Level Security in the database is the final guard behind all of this.
 */

export type StoreRole = "owner" | "staff" | "admin";

export type CurrentUser = { id: string; email: string };

export type StoreContext = {
  supabase: ServerSupabase;
  user: CurrentUser;
  role: StoreRole;
  store: Tables<"stores">;
};

/** The logged-in user for this request, or null. Verified against Supabase Auth. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");
  return !error && data === true;
});

export async function requireAdmin() {
  const user = await requireUser();
  if (!(await isPlatformAdmin())) notFound();
  return { supabase: await createClient(), user };
}

async function resolveRole(supabase: ServerSupabase, storeId: string, userId: string): Promise<StoreRole | null> {
  const { data } = await supabase
    .from("store_members")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.role === "owner" || data?.role === "staff") return data.role;
  return (await isPlatformAdmin()) ? "admin" : null;
}

async function loadStore(column: "slug" | "id", value: string): Promise<StoreContext | null> {
  const user = await requireUser();
  const supabase = await createClient();
  // RLS returns the store only to its members and to platform admins.
  const { data: store } = await supabase.from("stores").select("*").eq(column, value).maybeSingle();
  if (!store) return null;
  const role = await resolveRole(supabase, store.id, user.id);
  if (!role) return null;
  return { supabase, user, role, store };
}

/** For pages under /s/[slug]. Unknown store and no access look the same (404), so slugs can't be probed. */
export const requireStoreBySlug = cache(async (slug: string): Promise<StoreContext> => {
  const ctx = await loadStore("slug", slug);
  if (!ctx) notFound();
  return ctx;
});

/** For Server Actions, which receive the store id from a form and must not trust it. */
export async function requireStoreById(storeId: string): Promise<StoreContext> {
  const ctx = await loadStore("id", storeId);
  if (!ctx) throw new AccessDeniedError();
  return ctx;
}

export function canManageStore(role: StoreRole) {
  return role === "owner" || role === "admin";
}

export class AccessDeniedError extends Error {
  constructor() {
    super("Access denied");
    this.name = "AccessDeniedError";
  }
}
