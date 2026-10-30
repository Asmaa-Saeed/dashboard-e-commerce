"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformAdmin, requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dbError, fail, ok, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { id, requiredText } from "@/lib/validation";

const NOT_ADMIN = "هذا الإجراء لإدارة المنصة فقط.";

const createSchema = z.object({
  name: requiredText(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, "slug"),
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z]{2,5}$/),
  ownerEmail: z.union([z.email().max(254), z.literal("")]).transform((v) => (v === "" ? undefined : v)),
});

export async function createStore(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("createStore", async () => {
    await requireUser();
    if (!(await isPlatformAdmin())) return fail(NOT_ADMIN);
    const input = parseForm(createSchema, formData);
    if (!input) return fail("الرابط: حروف إنجليزية صغيرة وأرقام وشرطة. بادئة الطلبات: من 2 إلى 5 حروف إنجليزية.");

    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_create_store", {
      p_name: input.name,
      p_slug: input.slug,
      p_order_ref_prefix: input.prefix,
      p_owner_email: input.ownerEmail,
    });
    if (error) return dbError(error, "createStore");

    revalidatePath("/admin");
    return ok(`تم إنشاء المتجر. رابطه: /s/${input.slug}`);
  });
}

const subscriptionSchema = z.object({
  storeId: id,
  status: z.enum(["trial", "active", "paused", "cancelled"]),
  renewsAt: z.union([z.iso.date(), z.literal("")]).transform((v) => (v === "" ? null : `${v}T00:00:00Z`)),
});

export async function updateSubscription(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("updateSubscription", async () => {
    await requireUser();
    if (!(await isPlatformAdmin())) return fail(NOT_ADMIN);
    const input = parseForm(subscriptionSchema, formData);
    if (!input) return fail("تحقق من البيانات.");

    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("stores")
      .update({ status: input.status, subscription_renews_at: input.renewsAt })
      .eq("id", input.storeId)
      .select("id");
    if (error) return dbError(error, "updateSubscription");
    if (!updated.length) return fail("المتجر غير موجود.");

    revalidatePath("/admin");
    return ok("تم الحفظ.");
  });
}
