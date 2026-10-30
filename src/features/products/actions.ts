"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStoreById } from "@/lib/auth/dal";
import { dbError, fail, ok, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { id, optionalText } from "@/lib/validation";

const flagSchema = z.object({
  storeId: id,
  productId: id,
  value: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** Marks a whole product as out of stock (the bot stops offering it) or available again. */
export async function setProductOutOfStock(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("setProductOutOfStock", async () => {
    const input = parseForm(flagSchema, formData);
    if (!input) return fail("الطلب غير صالح.");
    const { supabase, store } = await requireStoreById(input.storeId);

    const { data: updated, error } = await supabase
      .from("products")
      .update({ out_of_stock: input.value })
      .eq("store_id", store.id)
      .eq("id", input.productId)
      .select("id");
    if (error) return dbError(error, "setProductOutOfStock");
    if (!updated.length) return fail("المنتج غير موجود.");

    revalidatePath(`/s/${store.slug}`, "layout");
    return ok(input.value ? "تم. لن يعرض البوت هذا المنتج." : "عاد المنتج للعرض.");
  });
}

const variantFlagSchema = z.object({
  storeId: id,
  variantId: id,
  value: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function setVariantOutOfStock(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("setVariantOutOfStock", async () => {
    const input = parseForm(variantFlagSchema, formData);
    if (!input) return fail("الطلب غير صالح.");
    const { supabase, store } = await requireStoreById(input.storeId);

    const { data: updated, error } = await supabase
      .from("product_variants")
      .update({ out_of_stock: input.value })
      .eq("store_id", store.id)
      .eq("id", input.variantId)
      .select("id");
    if (error) return dbError(error, "setVariantOutOfStock");
    if (!updated.length) return fail("النوع غير موجود.");

    revalidatePath(`/s/${store.slug}/products`);
    return ok(input.value ? "تم تسجيل نفاد الكمية." : "أصبح متوفرًا.");
  });
}

const movementSchema = z.object({
  storeId: id,
  variantId: id,
  kind: z.enum(["restock", "manual_sale", "return", "count"]),
  quantity: z.coerce.number().int().min(0).max(100_000),
  note: optionalText(200),
});

/**
 * Records a stock change. The database trigger updates the quantity, so the history and the number never disagree.
 * "count" is a stock-take: the person types what is on the shelf and we record the difference.
 */
export async function recordStockMovement(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("recordStockMovement", async () => {
    const input = parseForm(movementSchema, formData);
    if (!input) return fail("أدخل عددًا صحيحًا.");
    const { supabase, store } = await requireStoreById(input.storeId);

    const { data: variant } = await supabase
      .from("product_variants")
      .select("stock_qty")
      .eq("store_id", store.id)
      .eq("id", input.variantId)
      .maybeSingle();
    if (!variant) return fail("النوع غير موجود.");

    let delta: number;
    let reason: "restock" | "manual_sale" | "return" | "adjustment";
    if (input.kind === "count") {
      delta = input.quantity - (variant.stock_qty ?? 0);
      reason = "adjustment";
      if (delta === 0 && variant.stock_qty !== null) return ok("العدد نفسه، لم يتغير شيء.");
    } else {
      if (input.quantity === 0) return fail("أدخل عددًا أكبر من صفر.");
      delta = input.kind === "manual_sale" ? -input.quantity : input.quantity;
      reason = input.kind;
    }

    if (delta === 0) {
      // first count of a variant with none on the shelf: start counting at 0
      // (the one direct quantity change the database allows; everything else goes through movements)
      const { error } = await supabase.from("product_variants").update({ stock_qty: 0, out_of_stock: true }).eq("store_id", store.id).eq("id", input.variantId);
      if (error) return dbError(error, "recordStockMovement");
      revalidatePath(`/s/${store.slug}/products`);
      return ok("بدأ العد من صفر، وسُجّل أن الكمية نفدت.");
    }

    const { error } = await supabase
      .from("inventory_movements")
      .insert({ store_id: store.id, variant_id: input.variantId, delta, reason, note: input.note });
    if (error) return dbError(error, "recordStockMovement");

    revalidatePath(`/s/${store.slug}/products`);
    return ok("تم الحفظ.");
  });
}
