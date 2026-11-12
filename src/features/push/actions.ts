"use server";

import { z } from "zod";
import { requireStoreById, requireUser } from "@/lib/auth/dal";
import { dbError, fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { id } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  storeId: id,
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  p256dh: z.string().min(40).max(200),
  auth: z.string().min(10).max(100),
  userAgent: z.string().max(300).optional(),
});

/** Saves this phone so it gets a notification for new orders and conversations that need a person. */
export async function registerPushSubscription(input: z.input<typeof subscriptionSchema>): Promise<ActionResult> {
  return runAction("registerPushSubscription", async () => {
    const parsed = subscriptionSchema.safeParse(input);
    if (!parsed.success) return fail("تعذّر تفعيل الإشعارات على هذا الجهاز.");
    const { supabase, store } = await requireStoreById(parsed.data.storeId);
    const { error } = await supabase.rpc("register_push_subscription", {
      p_store: store.id,
      p_endpoint: parsed.data.endpoint,
      p_p256dh: parsed.data.p256dh,
      p_auth: parsed.data.auth,
      p_user_agent: parsed.data.userAgent ?? null,
    });
    if (error) return dbError(error, "registerPushSubscription");
    return ok("تم تفعيل الإشعارات على هذا الجهاز.");
  });
}

/** Stops notifications on this phone. */
export async function unregisterPushSubscription(endpoint: string): Promise<ActionResult> {
  return runAction("unregisterPushSubscription", async () => {
    const parsed = z.url({ protocol: /^https$/ }).max(1000).safeParse(endpoint);
    if (!parsed.success) return fail("الطلب غير صالح.");
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("unregister_push_subscription", { p_endpoint: parsed.data });
    if (error) return dbError(error, "unregisterPushSubscription");
    return ok("تم إيقاف الإشعارات على هذا الجهاز.");
  });
}
