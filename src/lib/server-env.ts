import "server-only";
import { z } from "zod";

/**
 * Server-only settings (never sent to the browser). The staff-reply link to n8n is optional:
 * without it the dashboard still works, and the reply box says replying is not set up yet.
 */
const schema = z.object({
  N8N_STAFF_REPLY_URL: z.url({ protocol: /^https$/ }).or(z.url({ protocol: /^http$/, hostname: /^(localhost|127\.0\.0\.1)$/ })),
  N8N_DASHBOARD_KEY: z.string().min(24, "use a long random key"),
  N8N_DASHBOARD_KEY_HEADER: z.string().regex(/^[A-Za-z0-9-]{1,64}$/).default("X-Dashboard-Key"),
});

function load() {
  if (!process.env.N8N_STAFF_REPLY_URL && !process.env.N8N_DASHBOARD_KEY) return null;
  const parsed = schema.safeParse({
    N8N_STAFF_REPLY_URL: process.env.N8N_STAFF_REPLY_URL,
    N8N_DASHBOARD_KEY: process.env.N8N_DASHBOARD_KEY,
    N8N_DASHBOARD_KEY_HEADER: process.env.N8N_DASHBOARD_KEY_HEADER || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid staff-reply settings: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. See .env.example.`);
  }
  return parsed.data;
}

/** null when replying from the dashboard is not set up. */
export const staffReplyConfig = load();
