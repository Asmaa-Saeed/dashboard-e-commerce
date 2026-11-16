"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformAdmin, requireStoreById, requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dbError, fail, ok, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { id, optionalText, requiredText } from "@/lib/validation";
import { safeNotificationUrl } from "./labels";

const readSchema = z.object({
  storeId: id,
  // one notification, or none = all of mine in this store
  notificationId: z.union([id, z.literal(""), z.undefined()]).transform((v) => v || null),
});

/** Marks one of the caller's notifications (or all of them in this store) as read. */
export async function markNotificationsRead(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("markNotificationsRead", async () => {
    const input = parseForm(readSchema, formData);
    if (!input) return fail("الطلب غير صالح.");
    const { supabase, store } = await requireStoreById(input.storeId);

    const { error } = await supabase.rpc("mark_notifications_read", {
      p_store: store.id,
      p_ids: input.notificationId ? [input.notificationId] : null,
    });
    if (error) return dbError(error, "markNotificationsRead");

    revalidatePath(`/s/${store.slug}`, "layout");
    return ok(input.notificationId ? "تم." : "تم تعليم كل الإشعارات كمقروءة.");
  });
}

const sendSchema = z.object({
  target: z.union([id, z.literal("all")]),
  title: requiredText(120),
  body: optionalText(500),
  url: optionalText(300),
});

/** Platform admin → a message in the bell (and on the phone) of one store's team or every store's. */
export async function sendAdminNotification(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("sendAdminNotification", async () => {
    await requireUser();
    if (!(await isPlatformAdmin())) return fail("هذا الإجراء لإدارة المنصة فقط.");
    const input = parseForm(sendSchema, formData);
    if (!input) return fail("اكتب عنوانًا (حتى 120 حرفًا) ونصًا لا يزيد على 500 حرف.");
    if (input.url && !safeNotificationUrl(input.url)) return fail("الرابط يجب أن يكون داخل اللوحة ويبدأ بـ /");

    const supabase = await createClient();
    const { data: stores, error } = await supabase.rpc("admin_send_notification", {
      p_store: input.target === "all" ? null : input.target,
      p_title: input.title,
      p_body: input.body,
      p_url: input.url,
    });
    if (error) return dbError(error, "sendAdminNotification");

    revalidatePath("/admin");
    return ok(stores === 1 ? "تم إرسال الإشعار إلى فريق المتجر." : `تم إرسال الإشعار إلى ${stores} متاجر.`);
  });
}
