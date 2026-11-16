-- =====================================================================
-- Stores platform — notifications inside the app (bell) + phone push
-- Run after 05_push_notifications.sql. Safe to re-run.
-- (If you ever re-run 05, run this file again after it: 05 puts back the older push-only triggers.)
--
-- What happens
--   Every event below creates one row per team member in public.notifications (the bell),
--   and sends one phone push to the same people (through push_notify's Edge Function).
--     order          new order from the bot                       → everyone in the store
--     handoff        conversation now needs a person               → everyone
--     order_request  change / cancel request on an existing order  → everyone
--     stock          a product or one of its variants sold out     → everyone (once per product per day)
--     announcement   a message from the platform admin             → everyone in the chosen store(s)
--     subscription   trial / subscription ends in 3 days           → store owners only (daily job)
--   Read / unread is per person. A notification problem never stops the event itself.
-- =====================================================================

create extension if not exists pg_cron;

-- Instagram / Messenger handle, filled by n8n when Meta provides it (shown as @username).
alter table public.conversations add column if not exists username text;

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('order', 'handoff', 'order_request', 'stock', 'announcement', 'subscription')),
  title      text not null check (length(title) between 1 and 160),
  body       text check (length(body) <= 600),
  url        text check (url is null or (url ~ '^/' and url !~ '^//')),
  dedupe_key text,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists notifications_inbox_idx on public.notifications (user_id, store_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id, store_id) where read_at is null;

-- Each person reads only their own rows. Writing goes through the functions below.
alter table public.notifications enable row level security;
drop policy if exists "own read" on public.notifications;
create policy "own read" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- The bell updates live (Realtime applies the policy above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Sending
-- ---------------------------------------------------------------------

-- Phone push to a store's saved phones, optionally only some people's. Never raises.
create or replace function public.push_send(
  p_store uuid, p_title text, p_body text, p_url text, p_tag text, p_user_ids uuid[] default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from public.push_subscriptions
                 where store_id = p_store and (p_user_ids is null or user_id = any (p_user_ids))) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_strip_nulls(jsonb_build_object(
      'store_id', p_store, 'title', p_title, 'body', p_body, 'url', p_url, 'tag', p_tag,
      'user_ids', to_jsonb(p_user_ids))),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'push_send failed: %', sqlerrm;
end $$;

-- One notification for the store's team (or only its owners): a bell row per person + a phone push.
-- p_dedupe makes repeats harmless: a person never gets two rows with the same key.
-- Returns how many people got a new row. Never raises.
create or replace function public.notify_store(
  p_store uuid, p_kind text, p_title text, p_body text, p_url text, p_dedupe text, p_owners_only boolean default false
) returns int language plpgsql security definer set search_path = '' as $$
declare
  v_users uuid[];
begin
  with added as (
    insert into public.notifications (store_id, user_id, kind, title, body, url, dedupe_key)
    select p_store, m.user_id, p_kind, left(p_title, 160), left(p_body, 600), p_url, p_dedupe
      from public.store_members m
     where m.store_id = p_store and (not p_owners_only or m.role = 'owner')
    on conflict (user_id, dedupe_key) do nothing
    returning user_id
  )
  select array_agg(user_id) into v_users from added;

  if v_users is null then
    return 0;
  end if;
  perform public.push_send(p_store, p_title, p_body, p_url, p_dedupe,
                           case when p_owners_only then v_users end);
  return cardinality(v_users);
exception when others then
  raise warning 'notify_store failed: %', sqlerrm;
  return 0;
end $$;

revoke all on function public.push_send(uuid, text, text, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.notify_store(uuid, text, text, text, text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Events (triggers)
-- ---------------------------------------------------------------------

-- New order (replaces the push-only version from 05)
create or replace function public.tg_push_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_slug   text;
  v_symbol text;
begin
  select slug, currency_symbol into v_slug, v_symbol from public.stores where id = new.store_id;
  perform public.notify_store(
    new.store_id, 'order',
    'طلب جديد ' || new.ref,
    concat_ws(' · ', new.customer_name, nullif(new.city, ''), trim(trailing '.' from trim(trailing '0' from new.total::text)) || ' ' || coalesce(v_symbol, '')),
    '/s/' || v_slug || '/orders?id=' || new.id,
    'order-' || new.id
  );
  return null;
end $$;

-- Conversation now needs a person (replaces the push-only version from 05)
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

  perform public.notify_store(
    new.store_id, 'handoff',
    'محادثة تحتاج إلى رد',
    concat_ws(' · ', coalesce(nullif(new.display_name, ''), 'زبون'), v_reason, nullif(left(new.last_message_preview, 80), '')),
    '/s/' || v_slug || '/conversations?id=' || new.id,
    -- each handoff is its own event, even for the same conversation
    'handoff-' || new.id || '-' || extract(epoch from clock_timestamp())
  );
  return null;
end $$;

-- Change / cancel request on an existing order
create or replace function public.tg_notify_order_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_slug text;
  v_ref  text;
begin
  select s.slug, o.ref into v_slug, v_ref
    from public.orders o join public.stores s on s.id = o.store_id
   where o.id = new.order_id;
  perform public.notify_store(
    new.store_id, 'order_request',
    case new.type when 'cancel' then 'طلب إلغاء للطلب ' else 'طلب تعديل على الطلب ' end || coalesce(v_ref, ''),
    nullif(left(new.text, 200), ''),
    '/s/' || v_slug || '/orders?id=' || new.order_id,
    'request-' || new.id
  );
  return null;
end $$;

drop trigger if exists notify_order_request on public.order_requests;
create trigger notify_order_request after insert on public.order_requests
  for each row execute function public.tg_notify_order_request();

-- Sold out: a product, or one of its variants. One notification per product per day, so a catalog
-- sync that marks many variants at once does not flood the team.
create or replace function public.tg_notify_out_of_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_product uuid;
  v_name    text;
  v_slug    text;
  v_variant text;
begin
  if not new.out_of_stock or old.out_of_stock or not new.in_feed then
    return null;
  end if;

  if tg_table_name = 'products' then
    v_product := new.id;
  else
    v_product := new.product_id;
    v_variant := nullif(new.label, '');
  end if;
  select p.name, s.slug into v_name, v_slug
    from public.products p join public.stores s on s.id = p.store_id
   where p.id = v_product;

  perform public.notify_store(
    new.store_id, 'stock',
    'نفد من المخزون: ' || coalesce(v_name, 'منتج'),
    case when v_variant is not null then 'النوع: ' || v_variant else 'المنتج كله غير متوفر الآن' end,
    '/s/' || v_slug || '/products',
    'stock-' || v_product || '-' || current_date
  );
  return null;
end $$;

drop trigger if exists notify_product_out_of_stock on public.products;
create trigger notify_product_out_of_stock after update of out_of_stock on public.products
  for each row execute function public.tg_notify_out_of_stock();
drop trigger if exists notify_variant_out_of_stock on public.product_variants;
create trigger notify_variant_out_of_stock after update of out_of_stock on public.product_variants
  for each row execute function public.tg_notify_out_of_stock();

revoke all on function public.tg_push_new_order() from public, anon, authenticated;
revoke all on function public.tg_push_needs_human() from public, anon, authenticated;
revoke all on function public.tg_notify_order_request() from public, anon, authenticated;
revoke all on function public.tg_notify_out_of_stock() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Dashboard functions
-- ---------------------------------------------------------------------

-- Marks the caller's notifications in one store as read: the given ids, or all of them.
create or replace function public.mark_notifications_read(p_store uuid, p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.notifications
     set read_at = now()
   where user_id = (select auth.uid())
     and store_id = p_store
     and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Platform admin → one store (p_store) or every store that isn't cancelled (p_store null).
-- Links outside the dashboard are dropped. Returns how many stores were reached.
create or replace function public.admin_send_notification(p_store uuid, p_title text, p_body text, p_url text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_title text := nullif(trim(p_title), '');
  v_body  text := nullif(trim(p_body), '');
  v_url   text := case when p_url ~ '^/([^/\\]|$)' then left(p_url, 300) end;
  v_key   text := 'announcement-' || gen_random_uuid();
  v_count int := 0;
  s       record;
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform admin can send this';
  end if;
  if v_title is null or length(v_title) > 120 or length(coalesce(v_body, '')) > 500 then
    raise exception 'Title is required (up to 120 characters), body up to 500';
  end if;

  for s in
    select id from public.stores
     where (p_store is null and status <> 'cancelled') or id = p_store
  loop
    perform public.notify_store(s.id, 'announcement', v_title, v_body, v_url, v_key);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke all on function public.mark_notifications_read(uuid, uuid[]) from public, anon;
revoke all on function public.admin_send_notification(uuid, text, text, text) from public, anon;
grant execute on function public.mark_notifications_read(uuid, uuid[]) to authenticated;
grant execute on function public.admin_send_notification(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Subscription reminder (daily, owners only)
-- ---------------------------------------------------------------------

-- Stores whose trial ends, or whose subscription renews, in 2–3 days get one reminder for that date.
-- Returns how many stores were reminded.
create or replace function public.notify_subscription_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int := 0;
  s       record;
begin
  for s in
    select id, slug, status,
           case when status = 'trial' then trial_ends_at else subscription_renews_at end as ends_at
      from public.stores
     where status in ('trial', 'active')
  loop
    continue when s.ends_at is null
               or s.ends_at <= now() + interval '2 days'
               or s.ends_at > now() + interval '3 days';
    if public.notify_store(
         s.id, 'subscription',
         case when s.status = 'trial' then 'التجربة المجانية تنتهي بعد 3 أيام' else 'اشتراكك ينتهي بعد 3 أيام' end,
         'جدّد الاشتراك حتى يبقى البوت يرد على عملائك دون توقف. تواصل معنا للتجديد.',
         '/s/' || s.slug || '/settings',
         'subscription-' || s.id || '-' || (s.ends_at::date),
         true
       ) > 0 then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

revoke all on function public.notify_subscription_reminders() from public, anon, authenticated;

-- every day at 07:00 UTC (10:00 in Palestine)
select cron.schedule('flowpal-subscription-reminders', '0 7 * * *', 'select public.notify_subscription_reminders()');
