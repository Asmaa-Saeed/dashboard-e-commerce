-- =====================================================================
-- Stores platform — phone notifications (Web Push) for the installed app
-- Run after 04_bot.sql. Safe to re-run.
--
-- What happens
--   1. A team member taps "تفعيل الإشعارات" in the dashboard. The browser gives a push
--      address for that phone, saved here with register_push_subscription().
--   2. A new order, or a conversation that now needs a person (status → needs_human),
--      fires a trigger that calls the Edge Function `send-push` through pg_net.
--   3. The function sends the notification to every saved phone of that store and
--      removes addresses the phone no longer accepts.
--
-- The trigger reads two Vault secrets (see supabase/PUSH_NOTIFICATIONS.md):
--   push_function_url    https://<project-ref>.supabase.co/functions/v1/send-push
--   push_webhook_secret  a long random string, also set as PUSH_WEBHOOK_SECRET on the function
-- Until both exist the triggers do nothing, so orders are never blocked by notifications.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Saved phones
-- ---------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  endpoint     text not null unique check (endpoint ~ '^https://'),
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_store_idx on public.push_subscriptions (store_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Each person sees only their own phones. Saving and removing go through the functions below.
alter table public.push_subscriptions enable row level security;
drop policy if exists "own read" on public.push_subscriptions;
create policy "own read" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

-- ---------------------------------------------------------------------
-- 2. Dashboard functions
-- ---------------------------------------------------------------------

-- Saves (or moves to the current person) this phone's push address for one store.
create or replace function public.register_push_subscription(
  p_store uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.is_store_member(p_store) then
    raise exception 'Not a member of this store';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or coalesce(length(p_p256dh), 0) not between 40 and 200
     or coalesce(length(p_auth), 0) not between 10 and 100 then
    raise exception 'Invalid push subscription';
  end if;

  insert into public.push_subscriptions (store_id, user_id, endpoint, p256dh, auth, user_agent)
  values (p_store, (select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
     set store_id = excluded.store_id,
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         last_seen_at = now();
end $$;

-- Removes this phone (only the person who saved it can).
create or replace function public.unregister_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions
   where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

revoke all on function public.register_push_subscription(uuid, text, text, text, text) from public, anon;
revoke all on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.register_push_subscription(uuid, text, text, text, text) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Sending (triggers → Edge Function)
-- ---------------------------------------------------------------------

-- Queues one notification for every saved phone of a store. Never raises: a notification
-- problem must not stop an order or a handoff from being saved.
create or replace function public.push_notify(p_store uuid, p_title text, p_body text, p_url text, p_tag text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from public.push_subscriptions where store_id = p_store) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('store_id', p_store, 'title', p_title, 'body', p_body, 'url', p_url, 'tag', p_tag),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'push_notify failed: %', sqlerrm;
end $$;

revoke all on function public.push_notify(uuid, text, text, text, text) from public, anon, authenticated;

-- New order → "طلب جديد"
create or replace function public.tg_push_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_slug   text;
  v_symbol text;
begin
  select slug, currency_symbol into v_slug, v_symbol from public.stores where id = new.store_id;
  perform public.push_notify(
    new.store_id,
    'طلب جديد ' || new.ref,
    concat_ws(' · ', new.customer_name, nullif(new.city, ''), trim(trailing '.' from trim(trailing '0' from new.total::text)) || ' ' || coalesce(v_symbol, '')),
    '/s/' || v_slug || '/orders',
    'order-' || new.id
  );
  return null;
end $$;

drop trigger if exists push_new_order on public.orders;
create trigger push_new_order after insert on public.orders
  for each row execute function public.tg_push_new_order();

-- Conversation now needs a person → "محادثة تحتاج إلى رد"
create or replace function public.tg_push_needs_human()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_slug   text;
  v_reason text;
begin
  if new.status <> 'needs_human' or (tg_op = 'UPDATE' and old.status = 'needs_human') then
    return null;
  end if;

  select slug into v_slug from public.stores where id = new.store_id;
  -- same wording as src/features/conversations/labels.ts
  v_reason := case new.handoff_reason
    when 'wholesale'       then 'طلب جملة'
    when 'asked_for_human' then 'طلب التحدث مع موظف'
    when 'order_change'    then 'تعديل أو إلغاء طلب'
    when 'order_failed'    then 'تعذّر حفظ الطلب'
    when 'unknown_info'    then 'سؤال لا يعرف البوت إجابته'
    else 'يحتاج إلى موظف'
  end;

  perform public.push_notify(
    new.store_id,
    'محادثة تحتاج إلى رد',
    concat_ws(' · ', coalesce(nullif(new.display_name, ''), 'زبون'), v_reason, nullif(left(new.last_message_preview, 80), '')),
    '/s/' || v_slug || '/conversations?id=' || new.id,
    'conv-' || new.id
  );
  return null;
end $$;

drop trigger if exists push_needs_human on public.conversations;
create trigger push_needs_human after insert or update of status on public.conversations
  for each row execute function public.tg_push_needs_human();

revoke all on function public.tg_push_new_order() from public, anon, authenticated;
revoke all on function public.tg_push_needs_human() from public, anon, authenticated;
