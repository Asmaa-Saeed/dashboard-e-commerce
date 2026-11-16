# Notifications, Conversations Redesign, Mobile Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five notification types as push + in-app bell, a redesigned conversations page, and a mobile-app-grade shell.

**Architecture:** Database triggers create one notification row per recipient through `notify_store()`, which also fires the existing push. The app reads the caller's rows (RLS `user_id = auth.uid()`), listens on realtime, and renders a bell panel and a history page. The conversations page becomes a server page that feeds presentational components.

**Tech Stack:** Next.js 16.4 (App Router, Server Actions), React 19.3, Tailwind 4, Supabase (Postgres, RLS, Realtime, pg_net, pg_cron, Edge Functions), Zod 4, Phosphor icons, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-16-notifications-and-inbox-design.md`

## Global Constraints

- Arabic RTL copy, IBM Plex Sans Arabic, colours only from tokens in `src/app/globals.css`.
- Icons only through `src/components/ui/icons.ts`.
- SQL files are re-runnable (`create or replace`, `if not exists`, `drop trigger if exists`).
- A notification failure never raises out of a trigger (wrap in `exception when others`).
- No service-role key in the app; admin functions check `public.is_platform_admin()`.
- `npm run check` (lint + typecheck + unit tests) passes.

## Review Focus

1. Catalog sync flips many variants to out-of-stock at once → one notification per product, not per variant (dedupe key `stock-<product_id>-<date>`).
2. Same event fired twice (trigger re-run, status toggled back and forth) → unique `(user_id, dedupe_key)` keeps one row.
3. Conversation with no display name and no username → list and header show «زائر» and the channel name, never "null".
4. Notification `url` from the admin form → only in-app paths starting with `/` and not `//` are accepted.
5. Phone width 360px → no horizontal scroll on conversations, bell panel becomes a full-width sheet, bottom bar doesn't cover the reply box.

---

### Task 1: SQL — notifications schema, triggers, admin + reminders

**Files:**
- Create: `supabase/06_notifications.sql`
- Create: `supabase/tests/70_notifications.sql`
- Modify: `supabase/functions/send-push/index.ts` (optional `user_ids: string[]` filter)
- Modify: `src/lib/supabase/database.types.ts` (notifications table, `conversations.username`, new RPCs)

**Produces:**
- table `public.notifications(id uuid, store_id uuid, user_id uuid, kind text check in ('order','handoff','order_request','stock','announcement','subscription'), title text, body text, url text, dedupe_key text, read_at timestamptz, created_at timestamptz)`, unique `(user_id, dedupe_key)`.
- `public.notify_store(p_store uuid, p_kind text, p_title text, p_body text, p_url text, p_dedupe text, p_owners_only boolean default false) returns void`
- `public.mark_notifications_read(p_store uuid, p_ids uuid[] default null) returns int` (null = all of mine in that store)
- `public.admin_send_notification(p_store uuid, p_title text, p_body text, p_url text) returns int` (p_store null = all stores; returns stores reached)
- `public.notify_subscription_reminders() returns int` + `cron.schedule('flowpal-subscription-reminders', '0 7 * * *', ...)`
- column `conversations.username text`

- [ ] Write `70_notifications.sql` asserting: new order → one row per member; owners-only reminder → only owner rows; same dedupe twice → one row; member B can't select member A's rows; non-admin calling `admin_send_notification` raises.
- [ ] Write `06_notifications.sql`; route `tg_push_new_order` and `tg_push_needs_human` through `notify_store`; add triggers on `order_requests` insert and `products`/`product_variants` `out_of_stock` false→true.
- [ ] Update `send-push` to filter by `user_ids` when present.
- [ ] Commit.

### Task 2: Notifications — pure helpers (TDD)

**Files:** Create `src/features/notifications/labels.ts`; Test `tests/unit.test.ts`

**Produces:** `NOTIFICATION_KINDS`, `type NotificationKind`, `notificationIcon(kind)` key map, `safeNotificationUrl(url: unknown): string | null`, `groupByDay(items, timezone)`.

- [ ] Test: `safeNotificationUrl("/s/a/orders") === "/s/a/orders"`; `"//evil.com"`, `"https://x"`, `"javascript:1"`, `42` → `null`.
- [ ] Test: `groupByDay` puts today's items under «اليوم», yesterday under «أمس», older under the formatted date.
- [ ] Implement, run `npm test`, commit.

### Task 3: Notifications — data, actions, bell, page, admin form

**Files:**
- Create: `src/features/notifications/queries.ts` (`listNotifications(supabase, storeId, {limit})`, `countUnread(supabase, storeId)`)
- Create: `src/features/notifications/actions.ts` (`markNotificationsRead(prev, formData)`, `sendAdminNotification(prev, formData)`)
- Create: `src/features/notifications/components/notification-bell.tsx`, `notification-list.tsx`
- Create: `src/app/s/[slug]/notifications/page.tsx`
- Modify: `src/components/shell/app-shell.tsx` (bell in top bar; sound toggle → speaker icon), `src/app/s/[slug]/layout.tsx` (pass unread + latest), `src/app/admin/page.tsx` (send form), `src/components/ui/icons.ts`

- [ ] Bell shows unread count, opens panel (popover ≥ sm, bottom sheet < sm), realtime insert on `notifications` filtered `user_id=eq.<me>` refreshes and toasts.
- [ ] `npm run typecheck && npm run lint`, commit.

### Task 4: Conversations redesign

**Files:**
- Modify: `src/features/conversations/queries.ts` (`channel` filter, `countByChannel`, select `username`)
- Create: `src/features/conversations/components/channel-rail.tsx`, `conversation-list.tsx`, `conversation-thread.tsx`, `robot-illustration.tsx`, `resolved-state.tsx`
- Modify: `src/app/s/[slug]/conversations/page.tsx`, `src/features/conversations/labels.ts` (`conversationTitle`, `conversationHandle`)
- Test: `tests/unit.test.ts`

- [ ] Test `conversationTitle({display_name:null, customer_name:null})` → «زائر»; `conversationHandle({username:"sama_88", channel_type:"instagram"})` → `"@sama_88"`; no username → channel label.
- [ ] Build components; "تم الحل" uses `updateConversation` action `close`; closed thread shows the resolved state; toggle «يحتاج تدخل بشري» is a link switching `filter=needs`.
- [ ] Phone: channels become a horizontal chip row; list and thread are each full screen; composer sticky above the bottom bar.
- [ ] `npm run check`, commit.

### Task 5: Mobile shell polish

**Files:** Modify `src/components/shell/app-shell.tsx`, `src/app/layout.tsx` (`viewportFit: "cover"`), `src/app/globals.css` (safe-area utilities)

- [ ] Bottom tab bar under `lg`: الطلبات، المحادثات، المنتجات، الإشعارات، المزيد (opens drawer); badges for counts; `pb-[env(safe-area-inset-bottom)]`.
- [ ] `npm run check`, commit.

### Task 6: Verify and screenshots

- [ ] `npm run check` passes; `npm run build` passes.
- [ ] Temporary dev-only preview route with fixture data (not committed) → screenshots at 390px and 1440px of conversations (list, open thread, resolved, empty), bell panel, notifications page, admin form.
- [ ] Whole-branch review (superpowers:requesting-code-review).
