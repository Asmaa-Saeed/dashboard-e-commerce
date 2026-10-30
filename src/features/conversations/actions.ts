"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStoreById } from "@/lib/auth/dal";
import { dbError, fail, ok, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { id } from "@/lib/validation";
import { staffReplyConfig } from "@/lib/server-env";

const BOT_PAUSE_HOURS = 12;

const schema = z.object({
  storeId: id,
  conversationId: id,
  action: z.enum(["take_over", "back_to_bot", "close"]),
});

/**
 * take_over   → a team member answers; the bot stays quiet for a while so they don't talk over each other.
 * back_to_bot → done; the bot answers again.
 * close       → nothing more to do.
 */
export async function updateConversation(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("updateConversation", async () => {
    const input = parseForm(schema, formData);
    if (!input) return fail("الطلب غير صالح.");
    const { supabase, store, user } = await requireStoreById(input.storeId);
    const now = new Date();

    const changes =
      input.action === "take_over"
        ? { status: "human", handled_by: user.id, bot_paused_until: new Date(now.getTime() + BOT_PAUSE_HOURS * 3_600_000).toISOString() }
        : { status: input.action === "close" ? "closed" : "bot", handled_by: user.id, handled_at: now.toISOString(), bot_paused_until: null };

    const { data: updated, error } = await supabase
      .from("conversations")
      .update(changes)
      .eq("store_id", store.id)
      .eq("id", input.conversationId)
      .select("id");
    if (error) return dbError(error, "updateConversation");
    if (!updated.length) return fail("المحادثة غير موجودة.");

    revalidatePath(`/s/${store.slug}`, "layout");
    const messages = { take_over: `تم. سيتوقف البوت ${BOT_PAUSE_HOURS} ساعة لترد بنفسك.`, back_to_bot: "عادت المحادثة إلى البوت.", close: "تم إغلاق المحادثة." };
    return ok(messages[input.action]);
  });
}

const replySchema = z.object({
  storeId: id,
  conversationId: id,
  text: z.string().trim().min(1).max(1000),
});

const REPLY_ERRORS: Record<string, string> = {
  window_closed: "مرّت أكثر من 24 ساعة على آخر رسالة من العميل، وMeta لا تسمح بالرد بعدها. تواصل معه على واتساب.",
  channel_not_supported: "الرد من اللوحة متاح لمحادثات ماسنجر وإنستغرام فقط.",
  bad_text: "اكتب رسالة لا تزيد على 1000 حرف.",
};
const SEND_ERRORS: Record<string, string> = {
  window_closed: REPLY_ERRORS.window_closed,
  token_invalid: "انتهت صلاحية ربط الصفحة. تواصل مع فريق الدعم.",
  not_queued: "أُرسلت هذه الرسالة من قبل.",
};

/**
 * Sends a reply to a Messenger / Instagram customer. The database checks access and Meta's 24-hour window
 * and saves the message (queue_staff_reply); n8n then sends it with the page token it keeps. Only the
 * message id leaves this server, with a key the browser never sees.
 */
export async function sendStaffReply(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("sendStaffReply", async () => {
    const input = parseForm(replySchema, formData);
    if (!input) return fail(REPLY_ERRORS.bad_text);
    if (!staffReplyConfig) return fail("الرد من اللوحة غير مفعّل بعد. تواصل مع فريق الدعم.");
    const { supabase, store, user } = await requireStoreById(input.storeId);

    const { data, error } = await supabase.rpc("queue_staff_reply", { p_conversation: input.conversationId, p_text: input.text });
    if (error) return dbError(error, "sendStaffReply");
    const queued = data as { ok: boolean; error?: string; message_id?: number };
    if (!queued.ok || !queued.message_id) return fail(REPLY_ERRORS[queued.error ?? ""] ?? "تعذّر إرسال الرد.");

    revalidatePath(`/s/${store.slug}`, "layout");
    const sent = await deliver(queued.message_id);
    if (sent.ok) return ok("تم إرسال الرد.");

    // n8n never answered: mark the message so it shows as not sent (n8n marks its own failures)
    if (sent.error === "unreachable") {
      await supabase
        .from("messages")
        .update({ meta: { delivery: "failed", error: "unreachable", by: user.id } })
        .eq("id", queued.message_id)
        .eq("meta->>delivery", "queued");
    }
    return fail(SEND_ERRORS[sent.error] ?? "لم يُرسل الرد. حاول مرة أخرى.");
  });
}

async function deliver(messageId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = staffReplyConfig!;
  try {
    const res = await fetch(config.N8N_STAFF_REPLY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", [config.N8N_DASHBOARD_KEY_HEADER]: config.N8N_DASHBOARD_KEY },
      body: JSON.stringify({ message_id: messageId }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res.ok && body?.ok) return { ok: true };
    console.error("[sendStaffReply] n8n", res.status, body?.error);
    return { ok: false, error: body?.error ?? `http_${res.status}` };
  } catch (error) {
    console.error("[sendStaffReply] n8n unreachable", error);
    return { ok: false, error: "unreachable" };
  }
}
