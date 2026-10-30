-- =====================================================================
-- Stores platform — access rules (RLS), automation and dashboard functions
-- Run after 01_setup.sql. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Who is the current user?
-- ---------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create or replace function public.is_store_member(p_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin()
      or exists (select 1 from public.store_members
                 where store_id = p_store and user_id = (select auth.uid()));
$$;

create or replace function public.is_store_owner(p_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin()
      or exists (select 1 from public.store_members
                 where store_id = p_store and user_id = (select auth.uid()) and role = 'owner');
$$;

-- The dashboard calls this after login to know which stores to show.
create or replace function public.my_stores()
returns table (store_id uuid, slug text, name text, role text, brand_color text, logo_url text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.slug, s.name,
         case when public.is_platform_admin() then 'admin' else m.role end,
         s.brand_color, s.logo_url
  from public.stores s
  left join public.store_members m on m.store_id = s.id and m.user_id = (select auth.uid())
  where public.is_platform_admin() or m.user_id is not null
  order by s.name;
$$;

-- ---------------------------------------------------------------------
-- 2. Row Level Security
-- ---------------------------------------------------------------------

-- Nothing is readable without logging in. The chat widget talks to n8n, never to the database.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

do $$
declare
  t text;
  -- read: members · write: members (day-to-day work)
  ops text[] := array['customers', 'conversations', 'messages', 'orders', 'order_items', 'order_requests'];
  -- read: members · write: owner (store settings)
  cfg text[] := array['store_policies', 'bot_settings', 'delivery_zones', 'delivery_companies', 'channels', 'categories'];
  -- read: members · insert/delete: owner · update: members (stock toggles, hide from bot)
  cat text[] := array['products', 'product_variants'];
  -- read: members · written by triggers or the bot only
  ro  text[] := array['order_status_history', 'analytics_events'];
  all_tables text[] := ops || cfg || cat || ro || array['stores', 'store_members', 'platform_admins', 'inventory_movements', 'llm_usage'];
  p record;
begin
  foreach t in array all_tables loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;

  foreach t in array ops loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_store_member(store_id))', t);
    execute format('create policy "members insert" on public.%I for insert to authenticated with check (public.is_store_member(store_id))', t);
    execute format('create policy "members update" on public.%I for update to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id))', t);
    execute format('create policy "owners delete" on public.%I for delete to authenticated using (public.is_store_owner(store_id))', t);
  end loop;

  foreach t in array cfg loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_store_member(store_id))', t);
    execute format('create policy "owners insert" on public.%I for insert to authenticated with check (public.is_store_owner(store_id))', t);
    execute format('create policy "owners update" on public.%I for update to authenticated using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id))', t);
    execute format('create policy "owners delete" on public.%I for delete to authenticated using (public.is_store_owner(store_id))', t);
  end loop;

  foreach t in array cat loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_store_member(store_id))', t);
    execute format('create policy "owners insert" on public.%I for insert to authenticated with check (public.is_store_owner(store_id))', t);
    execute format('create policy "members update" on public.%I for update to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id))', t);
    execute format('create policy "owners delete" on public.%I for delete to authenticated using (public.is_store_owner(store_id))', t);
  end loop;

  foreach t in array ro loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_store_member(store_id))', t);
  end loop;
end $$;

-- stores: members read, owners edit (subscription fields are protected by a trigger), admins create/delete
create policy "members read" on public.stores for select to authenticated using (public.is_store_member(id));
create policy "owners update" on public.stores for update to authenticated using (public.is_store_owner(id)) with check (public.is_store_owner(id));
create policy "admins insert" on public.stores for insert to authenticated with check (public.is_platform_admin());
create policy "admins delete" on public.stores for delete to authenticated using (public.is_platform_admin());

-- team: everyone sees their store's team, owners manage it
create policy "members read" on public.store_members for select to authenticated using (public.is_store_member(store_id));
create policy "owners insert" on public.store_members for insert to authenticated with check (public.is_store_owner(store_id));
create policy "owners update" on public.store_members for update to authenticated using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy "owners delete" on public.store_members for delete to authenticated using (public.is_store_owner(store_id));

-- platform admins: only admins see the list
create policy "admins read" on public.platform_admins for select to authenticated using (public.is_platform_admin());

-- stock history: members read and add (restock, count, shop sale); nobody edits history
create policy "members read" on public.inventory_movements for select to authenticated using (public.is_store_member(store_id));
create policy "members insert" on public.inventory_movements for insert to authenticated
  with check (public.is_store_member(store_id) and reason in ('restock', 'adjustment', 'manual_sale', 'return'));

-- AI cost: admins only
create policy "admins read" on public.llm_usage for select to authenticated using (public.is_platform_admin());

-- ---------------------------------------------------------------------
-- 3. Automation
-- ---------------------------------------------------------------------

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['stores', 'store_policies', 'bot_settings', 'products', 'product_variants', 'customers', 'conversations', 'orders'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- Store owners cannot change their own subscription or address (slug).
create or replace function public.tg_protect_store_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_platform_admin() then
    if new.slug is distinct from old.slug
       or new.status is distinct from old.status
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.subscription_renews_at is distinct from old.subscription_renews_at then
      raise exception 'Only the platform admin can change the subscription or store address';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_store_fields on public.stores;
create trigger protect_store_fields before update on public.stores
  for each row execute function public.tg_protect_store_fields();

-- Each new store gets its settings rows.
create or replace function public.tg_store_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.store_policies (store_id) values (new.id) on conflict do nothing;
  insert into public.bot_settings (store_id, assistant_name) values (new.id, 'مساعد ' || new.name) on conflict do nothing;
  return new;
end $$;
drop trigger if exists store_defaults on public.stores;
create trigger store_defaults after insert on public.stores
  for each row execute function public.tg_store_defaults();

-- A stock movement updates the variant's quantity. At 0 the variant is marked out of stock,
-- so the bot stops offering it; a restock marks it available again.
create or replace function public.tg_apply_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- A person always records as themselves, and only the order trigger may link a movement to an order.
  -- pg_trigger_depth() = 1 means the row came straight from a client, not from another trigger.
  if (select auth.uid()) is not null and pg_trigger_depth() = 1 then
    new.created_by := (select auth.uid());
    new.order_id := null;
  end if;
  update public.product_variants v
     set stock_qty = coalesce(v.stock_qty, 0) + new.delta,
         out_of_stock = (coalesce(v.stock_qty, 0) + new.delta) <= 0
   where v.id = new.variant_id and v.store_id = new.store_id;
  return new;
end $$;
drop trigger if exists apply_movement on public.inventory_movements;
create trigger apply_movement before insert on public.inventory_movements
  for each row execute function public.tg_apply_movement();

-- Order status: timestamps, history, and stock.
-- Stock is taken when staff confirm the order (not when the bot records it, since it may still be cancelled),
-- and given back if a confirmed order is cancelled or moved back to review.
-- Only variants that are being counted (stock_qty not null) in stores using quantity mode are touched.
create or replace function public.tg_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_mode text;
  takes_stock boolean := new.status in ('confirmed', 'shipped', 'delivered');
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  -- people (not the bot) can only move an order along these steps
  if tg_op = 'UPDATE' and (select auth.uid()) is not null and not (
       (old.status = 'pending_review' and new.status in ('confirmed', 'cancelled'))
    or (old.status = 'confirmed'      and new.status in ('shipped', 'cancelled', 'pending_review'))
    or (old.status = 'shipped'        and new.status in ('delivered', 'cancelled', 'confirmed'))
    or (old.status = 'delivered'      and new.status in ('shipped'))
    or (old.status = 'cancelled'      and new.status in ('pending_review'))
  ) then
    raise exception 'Order status cannot change from % to %', old.status, new.status;
  end if;

  -- each timestamp is when the order last reached that step; moving back clears the later steps
  if tg_op = 'UPDATE' then
    new.confirmed_at := case when new.status = 'confirmed' then now() when new.status in ('shipped', 'delivered') then old.confirmed_at end;
    new.shipped_at   := case when new.status = 'shipped' then now() when new.status = 'delivered' then old.shipped_at end;
    new.delivered_at := case when new.status = 'delivered' then now() end;
    new.cancelled_at := case when new.status = 'cancelled' then now() end;
  end if;

  if tg_op = 'UPDATE' then
    select inventory_mode into v_mode from public.stores where id = new.store_id;

    if takes_stock and not old.stock_applied and v_mode = 'quantity' then
      insert into public.inventory_movements (store_id, variant_id, delta, reason, order_id)
      select i.store_id, i.variant_id, -sum(i.quantity), 'order_confirmed', new.id
        from public.order_items i
        join public.product_variants v on v.id = i.variant_id
       where i.order_id = new.id and v.stock_qty is not null
       group by i.store_id, i.variant_id;
      new.stock_applied := true;
    elsif not takes_stock and old.stock_applied then
      -- give back exactly what this order took
      insert into public.inventory_movements (store_id, variant_id, delta, reason, order_id)
      select m.store_id, m.variant_id, -sum(m.delta), 'order_cancelled', new.id
        from public.inventory_movements m
       where m.order_id = new.id
       group by m.store_id, m.variant_id
      having sum(m.delta) <> 0;
      new.stock_applied := false;
    end if;
  end if;

  insert into public.order_status_history (store_id, order_id, from_status, to_status, changed_by)
  values (new.store_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status, (select auth.uid()));
  return new;
end $$;
drop trigger if exists order_status_upd on public.orders;
-- history rows reference the order, so the insert case runs after the row exists
create trigger order_status_upd before update of status on public.orders
  for each row execute function public.tg_order_status();

create or replace function public.tg_order_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.order_status_history (store_id, order_id, from_status, to_status, changed_by)
  values (new.store_id, new.id, null, new.status, (select auth.uid()));
  if new.customer_id is not null then
    update public.customers set orders_count = orders_count + 1 where id = new.customer_id;
  end if;
  return new;
end $$;
drop trigger if exists order_created on public.orders;
create trigger order_created after insert on public.orders
  for each row execute function public.tg_order_created();

-- Column guards for people (the bot uses the service role and is not affected).
-- RLS decides WHICH rows someone may update; this decides WHICH columns.
--   everyone:          rows never move to another store
--   product_variants:  quantities change only through stock movements (or start counting at 0)
--   products/variants: staff may only switch out_of_stock / manual_hidden; owners may edit the rest
--   orders:            stock and timeline bookkeeping is never edited by hand; staff can't change money fields
-- Changes made by other triggers (pg_trigger_depth() > 1) are trusted.
create or replace function public.tg_guard_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := to_jsonb(old);
  changed text[];
  locked text[];
  owner boolean;
begin
  if (select auth.uid()) is null or pg_trigger_depth() > 1 then return new; end if;
  if new.store_id is distinct from old.store_id then
    raise exception 'Rows cannot move to another store';
  end if;

  select coalesce(array_agg(n.key), '{}') into changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from old_row -> n.key and n.key <> 'updated_at';
  owner := public.is_store_owner(new.store_id);

  if tg_table_name = 'products' then
    locked := case when owner then '{}'::text[] else array(select unnest(changed) except select unnest(array['out_of_stock', 'manual_hidden'])) end;
  elsif tg_table_name = 'product_variants' then
    locked := case when owner then '{}'::text[] else array(select unnest(changed) except select unnest(array['out_of_stock', 'stock_qty'])) end;
    -- starting to count a variant at 0 is the only direct quantity change
    if 'stock_qty' = any (changed) and not (old.stock_qty is null and new.stock_qty = 0) then
      locked := locked || 'stock_qty'::text;
    end if;
  elsif tg_table_name = 'orders' then
    locked := array(
      select unnest(changed)
      intersect
      select unnest(array['stock_applied', 'created_at', 'confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at', 'ref', 'idempotency_key', 'source']
                    || case when owner then '{}'::text[] else array['subtotal', 'delivery_fee', 'currency', 'is_demo', 'customer_id', 'conversation_id'] end));
  end if;

  if cardinality(locked) > 0 then
    raise exception 'Locked fields: %', array_to_string(locked, ', ');
  end if;
  return new;
end $$;

-- "aa_" so these run before the other BEFORE UPDATE triggers (Postgres runs them in name order)
do $$
declare t text;
begin
  foreach t in array array['products', 'product_variants', 'orders'] loop
    execute format('drop trigger if exists aa_guard_columns on public.%I', t);
    execute format('create trigger aa_guard_columns before update on public.%I for each row execute function public.tg_guard_columns()', t);
  end loop;
end $$;

-- Live updates in the dashboard (new orders and messages appear without refreshing).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['orders', 'order_requests', 'conversations', 'messages'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Dashboard functions
-- ---------------------------------------------------------------------

-- Platform admin: create a store and make an existing user (by email) its owner.
-- The owner must sign up (or be invited from Authentication → Users) first.
create or replace function public.admin_create_store(
  p_name text, p_slug text, p_order_ref_prefix text, p_owner_email text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid;
  v_user uuid;
begin
  if not public.is_platform_admin() and (select auth.uid()) is not null then
    raise exception 'Only the platform admin can create stores';
  end if;
  insert into public.stores (name, slug, order_ref_prefix, status, trial_ends_at)
  values (p_name, p_slug, p_order_ref_prefix, 'trial', now() + interval '14 days')
  returning id into v_store;
  if p_owner_email is not null then
    select id into v_user from auth.users where lower(email) = lower(p_owner_email);
    if v_user is null then
      raise exception 'No user with email %. Add the user in Authentication → Users first.', p_owner_email;
    end if;
    insert into public.store_members (store_id, user_id, role) values (v_store, v_user, 'owner');
  end if;
  return v_store;
end $$;

-- Owner: add a team member by email (the person must have an account).
create or replace function public.add_store_member(p_store uuid, p_email text, p_role text default 'staff')
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.is_store_owner(p_store) then raise exception 'Only the store owner can add team members'; end if;
  if p_role not in ('owner', 'staff') then raise exception 'Role must be owner or staff'; end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'No user with email %', p_email; end if;
  insert into public.store_members (store_id, user_id, role) values (p_store, v_user, p_role)
  on conflict (store_id, user_id) do update set role = excluded.role;
end $$;

-- Team page: members with their emails (auth.users is not readable from the browser).
create or replace function public.store_team(p_store uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_store_member(p_store) then raise exception 'Not a member of this store'; end if;
  return query
  select m.user_id, u.email::text, m.role, m.created_at
    from public.store_members m join auth.users u on u.id = m.user_id
   where m.store_id = p_store
   order by m.role, u.email;
end $$;

-- A store always keeps at least one owner.
create or replace function public.tg_keep_one_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.stores where id = old.store_id)
     and not exists (select 1 from public.store_members
                      where store_id = old.store_id and role = 'owner' and user_id <> old.user_id) then
    raise exception 'A store must keep at least one owner';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists keep_one_owner on public.store_members;
create trigger keep_one_owner before update or delete on public.store_members
  for each row execute function public.tg_keep_one_owner();

-- Statistics page. Runs with the caller's rights, so RLS limits it to the caller's stores.
create or replace function public.store_stats(p_store uuid, p_from timestamptz, p_to timestamptz default now())
returns jsonb language sql stable security invoker set search_path = '' as $$
  with conv as (
    select count(*) as n from public.conversations
     where store_id = p_store and created_at >= p_from and created_at < p_to
  ), ord as (
    select count(*) filter (where status <> 'cancelled') as n,
           coalesce(sum(subtotal) filter (where status <> 'cancelled'), 0) as value,
           count(*) filter (where status = 'delivered') as delivered,
           count(*) filter (where status = 'cancelled') as cancelled
      from public.orders
     where store_id = p_store and created_at >= p_from and created_at < p_to and not is_demo
  ), handoff as (
    select count(*) as n from public.conversations
     where store_id = p_store and handoff_at >= p_from and handoff_at < p_to
  )
  select jsonb_build_object(
    'conversations', conv.n,
    'orders', ord.n,
    'orders_value', ord.value,
    'delivered', ord.delivered,
    'cancelled', ord.cancelled,
    'conversion_pct', case when conv.n > 0 then round(100.0 * ord.n / conv.n, 1) else 0 end,
    'handoffs', handoff.n,
    'top_products', coalesce((
      select jsonb_agg(x order by x.count desc) from (
        select p.name, count(*) as count
          from public.analytics_events e join public.products p on p.id = e.product_id
         where e.store_id = p_store and e.type = 'product_shown' and e.created_at >= p_from and e.created_at < p_to
         group by p.name order by count(*) desc limit 10) x), '[]'::jsonb),
    'no_result_searches', coalesce((
      select jsonb_agg(x order by x.count desc) from (
        select lower(trim(query)) as query, count(*) as count
          from public.analytics_events
         where store_id = p_store and type = 'search_no_result' and query is not null
           and created_at >= p_from and created_at < p_to
         group by lower(trim(query)) order by count(*) desc limit 10) x), '[]'::jsonb),
    'handoff_reasons', coalesce((
      select jsonb_agg(x order by x.count desc) from (
        select handoff_reason as reason, count(*) as count
          from public.conversations
         where store_id = p_store and handoff_at >= p_from and handoff_at < p_to
         group by handoff_reason) x), '[]'::jsonb)
  )
  from conv, ord, handoff;
$$;

-- Admin panel: one row per store for the last 30 days.
create or replace function public.admin_store_overview()
returns table (
  store_id uuid, name text, slug text, status text, trial_ends_at timestamptz, subscription_renews_at timestamptz,
  bot_enabled boolean, channels_connected bigint, conversations_30d bigint, orders_30d bigint,
  orders_value_30d numeric, llm_cost_usd_30d numeric, last_message_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Admins only'; end if;
  return query
  select s.id, s.name, s.slug, s.status, s.trial_ends_at, s.subscription_renews_at,
         b.enabled,
         (select count(*) from public.channels c where c.store_id = s.id and c.status = 'connected'),
         (select count(*) from public.conversations c where c.store_id = s.id and c.created_at > now() - interval '30 days'),
         (select count(*) from public.orders o where o.store_id = s.id and o.created_at > now() - interval '30 days' and o.status <> 'cancelled' and not o.is_demo),
         (select coalesce(sum(o.subtotal), 0) from public.orders o where o.store_id = s.id and o.created_at > now() - interval '30 days' and o.status <> 'cancelled' and not o.is_demo),
         (select coalesce(sum(u.cost_usd), 0) from public.llm_usage u where u.store_id = s.id and u.created_at > now() - interval '30 days'),
         (select max(c.last_message_at) from public.conversations c where c.store_id = s.id)
    from public.stores s
    left join public.bot_settings b on b.store_id = s.id
   order by s.name;
end $$;

revoke all on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
