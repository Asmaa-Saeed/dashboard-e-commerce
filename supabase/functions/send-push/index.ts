// Supabase Edge Function: send-push
// Called only by the database triggers in supabase/05_push_notifications.sql (through pg_net),
// with the shared secret in the x-push-secret header. Sends one notification to every saved
// phone of the store and removes phones that no longer accept notifications.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   PUSH_WEBHOOK_SECRET   same value as the Vault secret push_webhook_secret
//   VAPID_PUBLIC_KEY      same value as NEXT_PUBLIC_VAPID_PUBLIC_KEY on Vercel
//   VAPID_PRIVATE_KEY     never leaves Supabase
//   VAPID_SUBJECT         mailto:you@example.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase inside the function
// and never leave it.
//
// Deploy: supabase functions deploy send-push --no-verify-jwt

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

type Payload = { store_id: string; title: string; body?: string; url?: string; tag?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// Constant-time compare so the secret cannot be guessed from response timing.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
  if (secret.length < 24 || !safeEqual(req.headers.get("x-push-secret") ?? "", secret)) {
    return json(401, { error: "unauthorized" });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid json" });
  }
  if (!UUID.test(payload.store_id ?? "") || !payload.title) return json(400, { error: "store_id and title are required" });
  // Only links inside the dashboard.
  const url = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//") ? payload.url : "/";

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@flowpal.app",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("store_id", payload.store_id);
  if (error) return json(500, { error: error.message });
  if (!subs?.length) return json(200, { sent: 0, removed: 0 });

  const message = JSON.stringify({
    title: payload.title.slice(0, 120),
    body: (payload.body ?? "").slice(0, 240),
    url,
    tag: (payload.tag ?? "").slice(0, 80) || undefined,
  });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, {
        TTL: 60 * 60 * 24, // keep trying for a day if the phone is off
        urgency: "high",
      }),
    ),
  );

  // 404/410 = the phone unsubscribed or the app was removed: forget it.
  const gone = subs
    .filter((_, i) => {
      const r = results[i];
      const code = r.status === "rejected" ? (r.reason as { statusCode?: number })?.statusCode : undefined;
      return code === 404 || code === 410;
    })
    .map((s) => s.id);
  if (gone.length) await supabase.from("push_subscriptions").delete().in("id", gone);

  const failed = results.filter((r) => r.status === "rejected").length - gone.length;
  if (failed > 0) {
    console.error(
      "push failures",
      results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => {
          const e = r.reason as { statusCode?: number; body?: string; message?: string };
          return `${e?.statusCode ?? "network"}: ${e?.body || e?.message || String(e)}`.slice(0, 300);
        }),
    );
  }

  return json(200, { sent: results.length - failed - gone.length, removed: gone.length, failed });
});
