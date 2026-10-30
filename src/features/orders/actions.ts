"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStoreById } from "@/lib/auth/dal";
import { dbError, fail, ok, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { id, optionalText } from "@/lib/validation";
import { canMove, isOrderStatus, ORDER_STATUSES, STATUS_LABEL } from "./status";

const changeStatusSchema = z.object({
  storeId: id,
  orderId: id,
  to: z.enum(ORDER_STATUSES),
  cancelReason: optionalText(300),
});

export async function changeOrderStatus(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("changeOrderStatus", async () => {
    const input = parseForm(changeStatusSchema, formData);
    if (!input) return fail("الطلب غير صالح.");
    const { supabase, store } = await requireStoreById(input.storeId);

    const { data: order } = await supabase.from("orders").select("status").eq("store_id", store.id).eq("id", input.orderId).maybeSingle();
    if (!order || !isOrderStatus(order.status)) return fail("الطلب غير موجود.");
    if (!canMove(order.status, input.to)) return fail("لا يمكن نقل الطلب إلى هذه الحالة من حالته الحالية.");

    const { data: updated, error } = await supabase
      .from("orders")
      .update({ status: input.to, ...(input.to === "cancelled" ? { cancel_reason: input.cancelReason } : {}) })
      .eq("store_id", store.id)
      .eq("id", input.orderId)
      .eq("status", order.status) // only if nobody changed it in the meantime
      .select("id");
    if (error) return dbError(error, "changeOrderStatus");
    if (!updated.length) return fail("عدّل شخص آخر هذا الطلب الآن. حدّث الصفحة لمعرفة حالته.");

    revalidatePath(`/s/${store.slug}`, "layout");
    return ok(`أصبح الطلب: ${STATUS_LABEL[input.to]}`);
  });
}

const detailsSchema = z.object({
  storeId: id,
  orderId: id,
  deliveryCompanyId: z.union([id, z.literal("")]).transform((v) => (v === "" ? null : v)),
  trackingNo: optionalText(80),
  staffNote: optionalText(1000),
});

export async function saveOrderDetails(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("saveOrderDetails", async () => {
    const input = parseForm(detailsSchema, formData);
    if (!input) return fail("تحقق من البيانات.");
    const { supabase, store } = await requireStoreById(input.storeId);

    const { error } = await supabase
      .from("orders")
      .update({ delivery_company_id: input.deliveryCompanyId, tracking_no: input.trackingNo, staff_note: input.staffNote })
      .eq("store_id", store.id)
      .eq("id", input.orderId);
    if (error) return dbError(error, "saveOrderDetails");

    revalidatePath(`/s/${store.slug}/orders`);
    return ok("تم الحفظ.");
  });
}

const requestSchema = z.object({ storeId: id, requestId: id, status: z.enum(["done", "rejected"]) });

export async function resolveOrderRequest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("resolveOrderRequest", async () => {
    const input = parseForm(requestSchema, formData);
    if (!input) return fail("الطلب غير صالح.");
    const { supabase, store, user } = await requireStoreById(input.storeId);

    const { data: updated, error } = await supabase
      .from("order_requests")
      .update({ status: input.status, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq("store_id", store.id)
      .eq("id", input.requestId)
      .eq("status", "open")
      .select("id");
    if (error) return dbError(error, "resolveOrderRequest");
    if (!updated.length) return fail("تمت معالجة هذا الطلب من قبل.");

    revalidatePath(`/s/${store.slug}`, "layout");
    return ok(input.status === "done" ? "تم." : "تم رفض الطلب.");
  });
}
