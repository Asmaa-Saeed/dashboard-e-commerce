"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageStore, requireStoreById, type StoreContext } from "@/lib/auth/dal";
import { dbError, fail, ok, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { checkbox, httpsUrl, id, money, optionalText, phone, requiredText, textList } from "@/lib/validation";

/** Settings are owner-only. The database enforces the same rule; this gives a clear message first. */
async function requireManager(storeId: string): Promise<StoreContext | null> {
  const ctx = await requireStoreById(storeId);
  return canManageStore(ctx.role) ? ctx : null;
}
const NOT_OWNER = "يعدّل صاحب المتجر الإعدادات فقط.";

function done(ctx: StoreContext, message = "تم الحفظ.") {
  revalidatePath(`/s/${ctx.store.slug}`, "layout");
  return ok(message);
}

// ---------- store profile ----------

const profileSchema = z.object({
  storeId: id,
  name: requiredText(120),
  logoUrl: httpsUrl,
  websiteUrl: httpsUrl,
  whatsapp: phone,
  phone: phone,
  inventoryMode: z.enum(["flag", "quantity"]),
  wholesaleEnabled: checkbox,
});

export async function updateStoreProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("updateStoreProfile", async () => {
    const input = parseForm(profileSchema, formData);
    if (!input) return fail("تحقق من البيانات: يجب أن تبدأ الروابط بـ https:// وأن تحتوي الأرقام على أرقام فقط.");
    const ctx = await requireManager(input.storeId);
    if (!ctx) return fail(NOT_OWNER);

    const { error } = await ctx.supabase
      .from("stores")
      .update({
        name: input.name,
        logo_url: input.logoUrl,
        website_url: input.websiteUrl,
        whatsapp: input.whatsapp,
        phone: input.phone,
        inventory_mode: input.inventoryMode,
        wholesale_enabled: input.wholesaleEnabled,
      })
      .eq("id", ctx.store.id);
    if (error) return dbError(error, "updateStoreProfile");
    return done(ctx);
  });
}

// ---------- policies ----------

const policiesSchema = z.object({
  storeId: id,
  paymentMethods: textList(6, 80),
  deliveryTimeText: optionalText(300),
  exchangeAllowed: checkbox,
  exchangeText: optionalText(600),
  cancellationText: optionalText(600),
  workingHours: optionalText(200),
  wholesaleText: optionalText(600),
});

export async function updatePolicies(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("updatePolicies", async () => {
    const input = parseForm(policiesSchema, formData);
    if (!input) return fail("أحد النصوص طويل جدًا.");
    const ctx = await requireManager(input.storeId);
    if (!ctx) return fail(NOT_OWNER);

    const { error } = await ctx.supabase
      .from("store_policies")
      .update({
        payment_methods: input.paymentMethods,
        delivery_time_text: input.deliveryTimeText,
        exchange_allowed: input.exchangeAllowed,
        exchange_text: input.exchangeText,
        cancellation_text: input.cancellationText,
        working_hours: input.workingHours,
        wholesale_text: input.wholesaleText,
      })
      .eq("store_id", ctx.store.id);
    if (error) return dbError(error, "updatePolicies");
    return done(ctx, "تم الحفظ. سيستخدم البوت النص الجديد بدءًا من الرسالة التالية.");
  });
}

// ---------- bot ----------

const botSchema = z.object({
  storeId: id,
  enabled: checkbox,
  assistantName: requiredText(60),
  greetingText: optionalText(400),
  llmEnabled: checkbox,
  useThumbnails: checkbox,
  handoffWhatsapp: phone,
});

export async function updateBotSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("updateBotSettings", async () => {
    const input = parseForm(botSchema, formData);
    if (!input) return fail("تحقق من البيانات.");
    const ctx = await requireManager(input.storeId);
    if (!ctx) return fail(NOT_OWNER);

    const { error } = await ctx.supabase
      .from("bot_settings")
      .update({
        enabled: input.enabled,
        assistant_name: input.assistantName,
        greeting_text: input.greetingText,
        llm_enabled: input.llmEnabled,
        use_thumbnails: input.useThumbnails,
        handoff_whatsapp: input.handoffWhatsapp,
      })
      .eq("store_id", ctx.store.id);
    if (error) return dbError(error, "updateBotSettings");
    return done(ctx);
  });
}

// ---------- delivery zones ----------

const zoneSchema = z.object({
  storeId: id,
  zoneId: z.union([id, z.literal("")]).transform((v) => (v === "" ? null : v)),
  name: requiredText(60),
  fee: money,
  aliases: textList(150, 60),
  etaText: optionalText(200),
  sort: z.coerce.number().int().min(0).max(999).catch(0),
  active: checkbox,
});

export async function saveDeliveryZone(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("saveDeliveryZone", async () => {
    const input = parseForm(zoneSchema, formData);
    if (!input) return fail("تحقق من الاسم والسعر.");
    const ctx = await requireManager(input.storeId);
    if (!ctx) return fail(NOT_OWNER);

    const values = { name: input.name, fee: input.fee, aliases: input.aliases, eta_text: input.etaText, sort: input.sort, active: input.active };
    const { error } = input.zoneId
      ? await ctx.supabase.from("delivery_zones").update(values).eq("store_id", ctx.store.id).eq("id", input.zoneId)
      : await ctx.supabase.from("delivery_zones").insert({ ...values, store_id: ctx.store.id });
    if (error) return dbError(error, "saveDeliveryZone");
    return done(ctx);
  });
}

// ---------- delivery companies ----------

const companySchema = z.object({
  storeId: id,
  companyId: z.union([id, z.literal("")]).transform((v) => (v === "" ? null : v)),
  name: requiredText(60),
  copyTemplate: optionalText(1500),
  active: checkbox,
});

export async function saveDeliveryCompany(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("saveDeliveryCompany", async () => {
    const input = parseForm(companySchema, formData);
    if (!input) return fail("تحقق من البيانات.");
    const ctx = await requireManager(input.storeId);
    if (!ctx) return fail(NOT_OWNER);

    const values = { name: input.name, copy_template: input.copyTemplate, active: input.active };
    const { error } = input.companyId
      ? await ctx.supabase.from("delivery_companies").update(values).eq("store_id", ctx.store.id).eq("id", input.companyId)
      : await ctx.supabase.from("delivery_companies").insert({ ...values, store_id: ctx.store.id });
    if (error) return dbError(error, "saveDeliveryCompany");
    return done(ctx);
  });
}

// ---------- deleting a zone or company ----------

const deleteSchema = z.object({ storeId: id, kind: z.enum(["zone", "company"]), itemId: id });

export async function deleteSettingItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("deleteSettingItem", async () => {
    const input = parseForm(deleteSchema, formData);
    if (!input) return fail("الطلب غير صالح.");
    const ctx = await requireManager(input.storeId);
    if (!ctx) return fail(NOT_OWNER);

    const table = input.kind === "zone" ? "delivery_zones" : "delivery_companies";
    const { error } = await ctx.supabase.from(table).delete().eq("store_id", ctx.store.id).eq("id", input.itemId);
    if (error) return dbError(error, "deleteSettingItem");
    return done(ctx, "تم الحذف.");
  });
}

// ---------- team ----------

const addMemberSchema = z.object({ storeId: id, email: z.email().max(254), role: z.enum(["owner", "staff"]) });

export async function addTeamMember(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("addTeamMember", async () => {
    const input = parseForm(addMemberSchema, formData);
    if (!input) return fail("أدخل بريدًا إلكترونيًا صحيحًا.");
    const ctx = await requireManager(input.storeId);
    if (!ctx) return fail(NOT_OWNER);

    const { error } = await ctx.supabase.rpc("add_store_member", { p_store: ctx.store.id, p_email: input.email, p_role: input.role });
    if (error) return dbError(error, "addTeamMember");
    return done(ctx, "تمت الإضافة إلى الفريق.");
  });
}

const removeMemberSchema = z.object({ storeId: id, userId: id });

export async function removeTeamMember(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("removeTeamMember", async () => {
    const input = parseForm(removeMemberSchema, formData);
    if (!input) return fail("الطلب غير صالح.");
    const ctx = await requireManager(input.storeId);
    if (!ctx) return fail(NOT_OWNER);

    const { data: removed, error } = await ctx.supabase
      .from("store_members")
      .delete()
      .eq("store_id", ctx.store.id)
      .eq("user_id", input.userId)
      .select("user_id");
    if (error) return dbError(error, "removeTeamMember");
    if (!removed.length) return fail("هذا الشخص ليس ضمن الفريق.");
    return done(ctx, "تمت الإزالة من الفريق.");
  });
}
