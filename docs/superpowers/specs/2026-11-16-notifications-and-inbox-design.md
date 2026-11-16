# Notifications, conversations redesign, mobile app polish — design

Approved in conversation on 2026-11-16 (the owner agreed to every proposal and asked to go ahead).

## Why

Flowpal is used by store teams mostly as an installed phone app. Today a team member only hears about
two events (new order, conversation needs a person), only as a phone push, and there is no place to see
what they missed. The conversations page looks unlike the rest of the products the owner runs and is weak
on a phone. The owner wants: every important event reaches the team on the phone *and* inside the app,
a conversations page modelled on the screenshots she shared, and a dashboard that feels like a real
mobile app.

## Goals

1. **Notifications** for five events, delivered both as phone push and as an in-app inbox (bell):
   - new order from the bot
   - conversation needs a person (bot handed off)
   - change / cancel request on an existing order (`order_requests`)
   - product or variant became out of stock
   - messages from the platform admin: free text (to all stores or one store) and an automatic
     subscription reminder 3 days before the trial ends or the subscription renews
2. **Conversations page redesign** following the shared screenshots: a channels column (all, WhatsApp,
   Messenger, Instagram, website), a list of conversations with name, time ago, preview and a
   "تم الحل" chip, a thread panel with the customer's name and username, a "يحتاج تدخل بشري" toggle that
   filters to handed-off conversations (raised-hand mark on each), a friendly robot illustration in the
   empty state, and a "تم حل هذه المحادثة بنجاح" state after a team member presses "تم الحل".
3. **Mobile app quality** across the dashboard: bottom tab bar on phones, safe-area insets, full-height
   chat on phones, large touch targets.

## Non-goals

- Low-stock warnings (only "out of stock").
- Per-person notification preferences / muting by type.
- WhatsApp replies from the dashboard (Meta rules unchanged; only Messenger and Instagram).
- Changing the colour identity (teal stays).

## Anti-goals

- A notification failure must never block saving an order, a handoff or a stock change.
- No secrets in the browser; the service role key stays in Supabase.
- A store never sees another store's notifications.

## Decisions (from the conversation)

- Read / unread is **per person**: Sara reading a notification does not mark it read for Ahmed.
- "Mark all as read" in the bell, plus a full history page.
- Out of stock notifies whether the quantity reached zero or someone marked it by hand.
- Admin free-text messages: title + body, target = all stores or one store, audience = everyone in the
  store. Subscription reminders are automatic and go to the store owner only.
- Bell lives in the top bar; the sound toggle moves to a speaker icon so the bell means notifications.

## Approaches considered

**Storage of notifications**

| Approach | Trade-off |
|---|---|
| A. One row per recipient (fan-out at insert) — **picked** | Unread count is a simple indexed count; RLS is `user_id = auth.uid()`; realtime filter by user. Teams are small (1–10 people), so fan-out is cheap. New members don't see old notifications (acceptable). |
| B. One row per store + a `reads` table | Less rows, but unread needs an anti-join and "mark all" needs a watermark; realtime filter by store leaks nothing but needs per-user state client side. |
| C. Compute on the fly from orders / conversations | No new table, but admin messages and stock events have no source row, and read state still needs storing. |

**Where the notification is created**: database triggers (picked) — every source (bot via n8n, catalog
sync, dashboard) writes to the database, so a trigger catches them all. Doing it in the Next.js server
would miss events written by n8n.

**Subscription reminder**: `pg_cron` daily job calling a SQL function (picked), with a dedupe key so a
store gets one reminder per date. Alternative (a Vercel cron) would need the service role key outside
Supabase.

**Conversations page**: rewrite the page as a presentational view fed by the existing queries, add a
`channel` filter and a `username` column on `conversations` (n8n fills it when Meta provides it; the UI
falls back gracefully). "تم الحل" uses the existing `close` action (status `closed`).

## Shape

- `supabase/06_notifications.sql` (owner runs it): `notifications` table, `notify_store()`, triggers on
  orders, conversations, order_requests, products, product_variants; `mark_notifications_read()`;
  `admin_send_notification()`; `notify_subscription_reminders()` + cron; `conversations.username`.
  Existing push triggers are routed through `notify_store()` so push and inbox stay in step.
- `send-push` Edge Function accepts optional `user_ids` so owner-only reminders reach only owners' phones.
- `src/features/notifications/` queries, actions, labels; bell + panel in the top bar with realtime;
  `/s/[slug]/notifications` history page; admin page form.
- Conversations: `src/features/conversations/components/*` view components; page fetches and renders.
- Shell: bottom tab bar under `lg`, safe areas, `viewport-fit=cover`.

## Left to the builder

Exact copy, spacing and icon choices within the existing design tokens; the robot illustration (an
original SVG in the spirit of the screenshot, not a copy).
