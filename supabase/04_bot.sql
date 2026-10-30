-- =====================================================================
-- Bot access for n8n (run after 01, 02 and 03)
--
-- n8n connects with its own database user, n8n_bot, through a Postgres
-- credential. That user can't read or write any table directly: it can
-- only call the three functions below, which live in their own schema
-- (bot) that the website API never exposes.
--
--   bot.begin_turn(payload)   → finds the store and the conversation, saves the
--                                customer's message, returns the saved memory,
--                                the store settings, and whether the bot may reply
--   bot.submit_order(payload) → saves a confirmed order once (idempotent)
--   bot.finish_turn(payload)  → saves the bot's reply, its memory, handoffs,
--                                change/cancel requests and stats events
--   bot.sync_catalog(payload) → copies the products from the store's website
--                                (the "Catalog Sync" workflow, every 30 minutes)
--   bot.claim_staff_reply / bot.finish_staff_reply
--                              → the "Staff Reply" workflow sends a reply the team
--                                wrote in the dashboard to Messenger / Instagram
--
-- And one function for the dashboard (signed-in team members):
--   public.queue_staff_reply(conversation_id, text)
--
-- After running this file, set the password (pick a long random one and keep
-- it only in the n8n credential):
--   alter role n8n_bot with password 'PUT-A-LONG-RANDOM-PASSWORD-HERE';
--
-- Safe to re-run.
-- =====================================================================

create schema if not exists bot;
revoke all on schema bot from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'n8n_bot') then
    create role n8n_bot login noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end $$;
alter role n8n_bot set statement_timeout = '15s';
alter role n8n_bot set idle_in_transaction_session_timeout = '30s';
grant usage on schema bot to n8n_bot;

-- ---------------------------------------------------------------------
-- begin_turn
-- payload: {store_slug, channel_type, external_user_id, message, display_name?,
--           channel_external_id?, request_id?}
-- ---------------------------------------------------------------------
create or replace function bot.begin_turn(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store   public.stores%rowtype;
  v_bot     public.bot_settings%rowtype;
  v_pol     public.store_policies%rowtype;
  v_conv    public.conversations%rowtype;
  v_type    text := p ->> 'channel_type';
  v_user    text := left(btrim(coalesce(p ->> 'external_user_id', '')), 200);
  v_text    text := left(btrim(coalesce(p ->> 'message', '')), 2000);
  v_channel uuid;
  v_silent  text;
begin
  select * into v_store from public.stores where slug = p ->> 'store_slug';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'store_not_found');
  end if;
  if v_type is null or v_type not in ('web_chat', 'messenger', 'instagram', 'whatsapp') then
    raise exception 'begin_turn: unknown channel_type %', v_type;
  end if;
  if v_user = '' then
    raise exception 'begin_turn: external_user_id is required';
  end if;

  select * into v_bot from public.bot_settings where store_id = v_store.id;
  select * into v_pol from public.store_policies where store_id = v_store.id;
  select id into v_channel
    from public.channels
   where store_id = v_store.id and type = v_type
     and (p ->> 'channel_external_id' is null or external_id = p ->> 'channel_external_id')
   order by (status = 'connected') desc, created_at
   limit 1;

  insert into public.conversations as c (store_id, channel_id, channel_type, external_user_id, display_name)
  values (v_store.id, v_channel, v_type, v_user, nullif(left(btrim(coalesce(p ->> 'display_name', '')), 120), ''))
  on conflict (store_id, channel_type, external_user_id) do update
    set display_name = coalesce(excluded.display_name, c.display_name),
        channel_id   = coalesce(c.channel_id, excluded.channel_id)
  returning * into v_conv;

  -- A closed conversation opens again when the customer writes; a staff
  -- take-over ends when its pause runs out.
  if v_conv.status = 'closed'
     or (v_conv.status = 'human' and v_conv.bot_paused_until is not null and v_conv.bot_paused_until <= now()) then
    update public.conversations
       set status = 'bot', bot_paused_until = null
     where id = v_conv.id
    returning * into v_conv;
  end if;

  if v_text <> '' then
    insert into public.messages (store_id, conversation_id, role, text, meta)
    values (v_store.id, v_conv.id, 'customer', v_text,
            jsonb_strip_nulls(jsonb_build_object('request_id', p ->> 'request_id')));
    update public.conversations
       set last_message_at = now(), last_message_preview = left(v_text, 140)
     where id = v_conv.id;
  end if;

  v_silent := case
    when v_store.status in ('paused', 'cancelled') then 'store_inactive'
    when not coalesce(v_bot.enabled, true) then 'bot_disabled'
    when v_conv.status = 'human' then 'staff_handling'
    when v_conv.bot_paused_until is not null and v_conv.bot_paused_until > now() then 'staff_handling'
  end;

  return jsonb_build_object(
    'ok', true,
    'store_id', v_store.id,
    'conversation_id', v_conv.id,
    'conversation_status', v_conv.status,
    'state', v_conv.state,
    'bot_should_reply', v_silent is null,
    'silent_reason', v_silent,
    'store', jsonb_build_object(
      'name', v_store.name, 'whatsapp', v_store.whatsapp, 'phone', v_store.phone,
      'website_url', v_store.website_url, 'currency', v_store.currency,
      'currency_symbol', v_store.currency_symbol, 'order_ref_prefix', v_store.order_ref_prefix),
    'policies', case when v_pol.store_id is null then null else to_jsonb(v_pol) - 'store_id' - 'updated_at' end,
    'bot', case when v_bot.store_id is null then null else to_jsonb(v_bot) - 'store_id' - 'updated_at' end,
    'zones', (select coalesce(jsonb_agg(jsonb_build_object('name', z.name, 'fee', z.fee, 'aliases', to_jsonb(z.aliases), 'eta_text', z.eta_text)
                                         order by z.sort, z.name), '[]'::jsonb)
                from public.delivery_zones z
               where z.store_id = v_store.id and z.active),
    'unavailable_product_ids', (select coalesce(jsonb_agg(pr.external_id), '[]'::jsonb)
                                  from public.products pr
                                 where pr.store_id = v_store.id and (pr.manual_hidden or pr.out_of_stock))
  );
end;
$$;

-- ---------------------------------------------------------------------
-- submit_order
-- payload: {store_id, conversation_id, channel_type,
--           order: {order_ref, idempotency_key, customer_name, customer_phone,
--                   customer_city, customer_address, customer_notes,
--                   delivery_region, delivery_fee,
--                   items: [{product_id, variant_id, product_name, option, quantity, unit_price}]}}
-- product_id / variant_id are the ids on the store website (external ids).
-- Returns {status: 'saved' | 'duplicate', order_ref, order_id}.
-- ---------------------------------------------------------------------
create or replace function bot.submit_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store    uuid := nullif(p ->> 'store_id', '')::uuid;
  v_conv     uuid := nullif(p ->> 'conversation_id', '')::uuid;
  o          jsonb := p -> 'order';
  v_key      text := btrim(coalesce(p -> 'order' ->> 'idempotency_key', ''));
  v_ref      text := btrim(coalesce(p -> 'order' ->> 'order_ref', ''));
  v_name     text := left(btrim(coalesce(p -> 'order' ->> 'customer_name', '')), 120);
  v_phone    text := left(btrim(coalesce(p -> 'order' ->> 'customer_phone', '')), 40);
  v_city     text := nullif(left(btrim(coalesce(p -> 'order' ->> 'customer_city', '')), 120), '');
  v_address  text := nullif(left(btrim(coalesce(p -> 'order' ->> 'customer_address', '')), 400), '');
  v_currency text;
  v_zone     public.delivery_zones%rowtype;
  v_fee      numeric(10, 2);
  v_subtotal numeric(10, 2);
  v_customer uuid;
  v_order    uuid;
  v_existing record;
  it         jsonb;
begin
  if v_store is null or v_key = '' then
    raise exception 'submit_order: store_id and idempotency_key are required';
  end if;
  select currency into v_currency from public.stores where id = v_store;
  if not found then
    raise exception 'submit_order: unknown store';
  end if;

  -- The same confirmation sent twice gives back the first order.
  select id, ref into v_existing from public.orders where store_id = v_store and idempotency_key = v_key;
  if found then
    return jsonb_build_object('status', 'duplicate', 'order_ref', v_existing.ref, 'order_id', v_existing.id);
  end if;

  if v_ref !~ '^[A-Za-z0-9-]{4,40}$' then raise exception 'submit_order: bad order_ref'; end if;
  if v_name = '' or v_phone = '' then raise exception 'submit_order: customer name and phone are required'; end if;
  if jsonb_typeof(o -> 'items') is distinct from 'array'
     or jsonb_array_length(o -> 'items') not between 1 and 50 then
    raise exception 'submit_order: items must be a list of 1 to 50 lines';
  end if;
  for it in select value from jsonb_array_elements(o -> 'items') loop
    if btrim(coalesce(it ->> 'product_name', '')) = ''
       or coalesce(it ->> 'quantity', '') !~ '^[0-9]{1,3}$' or (it ->> 'quantity')::int not between 1 and 999
       or coalesce(it ->> 'unit_price', '') !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'submit_order: bad item %', it;
    end if;
  end loop;
  -- The total is worked out here from the lines, never taken from the caller.
  select sum((value ->> 'quantity')::int * (value ->> 'unit_price')::numeric) into v_subtotal
    from jsonb_array_elements(o -> 'items');

  if v_conv is not null and not exists (select 1 from public.conversations where id = v_conv and store_id = v_store) then
    v_conv := null;
  end if;

  select * into v_zone from public.delivery_zones
   where store_id = v_store and active and name = o ->> 'delivery_region';
  -- The fee the customer was told wins; the zone's fee fills the gap.
  v_fee := case when coalesce(o ->> 'delivery_fee', '') ~ '^[0-9]+(\.[0-9]+)?$' then (o ->> 'delivery_fee')::numeric else v_zone.fee end;

  insert into public.customers as cu (store_id, name, phone, city, address, first_channel)
  values (v_store, v_name, v_phone, v_city, v_address, p ->> 'channel_type')
  on conflict (store_id, phone) where phone is not null do update
    set name = excluded.name,
        city = coalesce(excluded.city, cu.city),
        address = coalesce(excluded.address, cu.address)
  returning id into v_customer;

  insert into public.orders (store_id, ref, idempotency_key, source, conversation_id, customer_id,
                             customer_name, customer_phone, city, zone_id, zone_name, address,
                             subtotal, delivery_fee, currency, customer_note)
  values (v_store, v_ref, v_key, 'bot', v_conv, v_customer,
          v_name, v_phone, v_city, v_zone.id, coalesce(v_zone.name, nullif(o ->> 'delivery_region', '')), v_address,
          v_subtotal, coalesce(v_fee, 0), v_currency, nullif(left(btrim(coalesce(o ->> 'customer_notes', '')), 500), ''))
  on conflict (store_id, idempotency_key) where idempotency_key is not null do nothing
  returning id into v_order;

  if v_order is null then
    -- Another call saved the same order a moment ago.
    select id, ref into v_existing from public.orders where store_id = v_store and idempotency_key = v_key;
    return jsonb_build_object('status', 'duplicate', 'order_ref', v_existing.ref, 'order_id', v_existing.id);
  end if;

  insert into public.order_items (store_id, order_id, product_id, variant_id, product_name, option_label, quantity, unit_price)
  select v_store, v_order,
         (select pr.id from public.products pr where pr.store_id = v_store and pr.external_id = i.value ->> 'product_id'),
         (select va.id from public.product_variants va where va.store_id = v_store and va.external_id = i.value ->> 'variant_id'),
         left(btrim(i.value ->> 'product_name'), 300),
         nullif(left(btrim(coalesce(i.value ->> 'option', '')), 120), ''),
         (i.value ->> 'quantity')::int,
         (i.value ->> 'unit_price')::numeric
    from jsonb_array_elements(o -> 'items') as i;

  if v_conv is not null then
    update public.conversations set customer_id = v_customer,
           display_name = coalesce(display_name, v_name)
     where id = v_conv;
  end if;

  insert into public.analytics_events (store_id, conversation_id, type, payload)
  values (v_store, v_conv, 'order_submitted', jsonb_build_object('order_ref', v_ref, 'subtotal', v_subtotal));

  return jsonb_build_object('status', 'saved', 'order_ref', v_ref, 'order_id', v_order);
end;
$$;

-- ---------------------------------------------------------------------
-- finish_turn
-- payload: {store_id, conversation_id, state, reply_text, intent, meta,
--           handoff: {reason} | null,
--           order_request: {type: 'modify' | 'cancel', order_ref, text} | null,
--           events: [{type, product_id?, query?}]}
-- ---------------------------------------------------------------------
create or replace function bot.finish_turn(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid := nullif(p ->> 'store_id', '')::uuid;
  v_conv  uuid := nullif(p ->> 'conversation_id', '')::uuid;
  v_text  text := left(btrim(coalesce(p ->> 'reply_text', '')), 4000);
  v_order uuid;
  ev      jsonb;
begin
  if not exists (select 1 from public.conversations where id = v_conv and store_id = v_store) then
    raise exception 'finish_turn: unknown conversation';
  end if;

  update public.conversations
     set state = case when jsonb_typeof(p -> 'state') = 'object' then p -> 'state' else state end
   where id = v_conv;

  if v_text <> '' then
    insert into public.messages (store_id, conversation_id, role, text, intent, meta)
    values (v_store, v_conv, 'bot', v_text, left(p ->> 'intent', 60),
            case when jsonb_typeof(p -> 'meta') = 'object' then p -> 'meta' else '{}'::jsonb end);
    update public.conversations
       set last_message_at = now(), last_message_preview = left(v_text, 140)
     where id = v_conv;
  end if;

  -- The bot asked for a person: the conversation shows up as "needs a reply".
  if jsonb_typeof(p -> 'handoff') = 'object' then
    update public.conversations
       set status = 'needs_human',
           handoff_reason = left(p -> 'handoff' ->> 'reason', 60),
           handoff_at = now()
     where id = v_conv and status = 'bot';
  end if;

  if jsonb_typeof(p -> 'order_request') = 'object' and p -> 'order_request' ->> 'type' in ('modify', 'cancel') then
    select id into v_order from public.orders
     where store_id = v_store and conversation_id = v_conv
       and ref = p -> 'order_request' ->> 'order_ref';
    if v_order is not null then
      insert into public.order_requests (store_id, order_id, type, text)
      values (v_store, v_order, p -> 'order_request' ->> 'type', left(p -> 'order_request' ->> 'text', 1000));
    end if;
  end if;

  if jsonb_typeof(p -> 'events') = 'array' then
    for ev in select value from jsonb_array_elements(p -> 'events') limit 20 loop
      if ev ->> 'type' in ('product_shown', 'search_no_result', 'add_to_cart', 'checkout_started', 'handoff') then
        insert into public.analytics_events (store_id, conversation_id, type, product_id, query, payload)
        values (v_store, v_conv, ev ->> 'type',
                (select pr.id from public.products pr where pr.store_id = v_store and pr.external_id = ev ->> 'product_id'),
                left(ev ->> 'query', 300),
                jsonb_strip_nulls(jsonb_build_object('product_external_id', ev ->> 'product_id', 'reason', ev ->> 'reason')));
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'conversation_id', v_conv);
end;
$$;

-- ---------------------------------------------------------------------
-- sync_catalog
-- Called in batches by the "Catalog Sync" workflow:
--   {store_slug, categories: [{external_id, title}],
--    products: [{external_id, name, subtitle, description, url, image_url, thumbnail_url,
--                images, category_ids, price, original_price, max_price, attributes,
--                options, review_status, issues,
--                variants: [{external_id, label, color, size, price, original_price, image_url}]}]}
-- then once more with {store_slug, finish: true, all_external_ids: [...every product on the
-- website...]}: any other product has left the website and is marked in_feed = false.
-- The team's own fields (out_of_stock, stock counts, hidden) are never touched.
-- ---------------------------------------------------------------------
create or replace function bot.sync_catalog(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store   uuid;
  v_product uuid;
  v_count   int := 0;
  pr        jsonb;
  va        jsonb;
  v_ids     text[];
  num       constant text := '^[0-9]+(\.[0-9]+)?$';
begin
  select id into v_store from public.stores where slug = p ->> 'store_slug';
  if v_store is null then raise exception 'sync_catalog: unknown store'; end if;

  if coalesce((p ->> 'finish')::boolean, false) then
    -- an empty list would hide every product: the workflow stops before this when the website fails
    if jsonb_typeof(p -> 'all_external_ids') is distinct from 'array' or jsonb_array_length(p -> 'all_external_ids') = 0 then
      raise exception 'sync_catalog: all_external_ids is required to finish';
    end if;
    v_ids := array(select jsonb_array_elements_text(p -> 'all_external_ids'));
    update public.products set in_feed = false
     where store_id = v_store and in_feed and not (external_id = any (v_ids));
    get diagnostics v_count = row_count;
    update public.stores set catalog_synced_at = now() where id = v_store;
    return jsonb_build_object('ok', true, 'removed', v_count);
  end if;

  if jsonb_typeof(p -> 'products') is distinct from 'array' or jsonb_array_length(p -> 'products') > 500 then
    raise exception 'sync_catalog: products must be a list of up to 500';
  end if;

  if jsonb_typeof(p -> 'categories') = 'array' then
    insert into public.categories (store_id, external_id, title)
    select v_store, left(c ->> 'external_id', 40), left(c ->> 'title', 120)
      from jsonb_array_elements(p -> 'categories') c
     where coalesce(c ->> 'external_id', '') <> '' and coalesce(c ->> 'title', '') <> ''
    on conflict (store_id, external_id) do update set title = excluded.title;
  end if;

  for pr in select value from jsonb_array_elements(p -> 'products') loop
    continue when coalesce(pr ->> 'external_id', '') = '' or coalesce(pr ->> 'name', '') = '';
    insert into public.products as t (store_id, external_id, name, subtitle, description, url, image_url, thumbnail_url,
                                      images, category_ids, price, original_price, max_price, attributes, options,
                                      review_status, issues, in_feed, synced_at)
    values (v_store, left(pr ->> 'external_id', 60), left(pr ->> 'name', 300), left(pr ->> 'subtitle', 300),
            left(pr ->> 'description', 5000), left(pr ->> 'url', 1000), left(pr ->> 'image_url', 1000),
            left(pr ->> 'thumbnail_url', 1000),
            case when jsonb_typeof(pr -> 'images') = 'array' then pr -> 'images' else '[]'::jsonb end,
            coalesce(array(select left(x, 40) from jsonb_array_elements_text(case when jsonb_typeof(pr -> 'category_ids') = 'array' then pr -> 'category_ids' else '[]'::jsonb end) x), '{}'),
            case when pr ->> 'price' ~ num then (pr ->> 'price')::numeric end,
            case when pr ->> 'original_price' ~ num then (pr ->> 'original_price')::numeric end,
            case when pr ->> 'max_price' ~ num then (pr ->> 'max_price')::numeric end,
            case when jsonb_typeof(pr -> 'attributes') = 'object' then pr -> 'attributes' else '{}'::jsonb end,
            case when jsonb_typeof(pr -> 'options') in ('array', 'object') then pr -> 'options' else '[]'::jsonb end,
            case when pr ->> 'review_status' in ('ok', 'needs_review', 'blocked') then pr ->> 'review_status' else 'ok' end,
            case when jsonb_typeof(pr -> 'issues') = 'array' then pr -> 'issues' else '[]'::jsonb end,
            true, now())
    on conflict (store_id, external_id) do update
      set name = excluded.name, subtitle = excluded.subtitle, description = excluded.description, url = excluded.url,
          image_url = excluded.image_url, thumbnail_url = excluded.thumbnail_url, images = excluded.images,
          category_ids = excluded.category_ids, price = excluded.price, original_price = excluded.original_price,
          max_price = excluded.max_price, attributes = excluded.attributes, options = excluded.options,
          review_status = excluded.review_status, issues = excluded.issues, in_feed = true, synced_at = now()
    returning id into v_product;

    v_ids := '{}';
    for va in select value from jsonb_array_elements(case when jsonb_typeof(pr -> 'variants') = 'array' then pr -> 'variants' else '[]'::jsonb end) loop
      continue when coalesce(va ->> 'external_id', '') = '';
      v_ids := v_ids || left(va ->> 'external_id', 60);
      insert into public.product_variants as t (store_id, product_id, external_id, label, color, size, price, original_price, image_url, in_feed)
      values (v_store, v_product, left(va ->> 'external_id', 60), left(va ->> 'label', 120), left(va ->> 'color', 60), left(va ->> 'size', 60),
              case when va ->> 'price' ~ num then (va ->> 'price')::numeric end,
              case when va ->> 'original_price' ~ num then (va ->> 'original_price')::numeric end,
              left(va ->> 'image_url', 1000), true)
      on conflict (store_id, external_id) do update
        set product_id = excluded.product_id, label = excluded.label, color = excluded.color, size = excluded.size,
            price = excluded.price, original_price = excluded.original_price, image_url = excluded.image_url, in_feed = true;
    end loop;
    -- options removed from the website
    update public.product_variants set in_feed = false
     where product_id = v_product and in_feed and not (external_id = any (v_ids));
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saved', v_count);
end;
$$;

-- ---------------------------------------------------------------------
-- Staff replies from the dashboard (Messenger / Instagram)
--
-- 1. The dashboard calls public.queue_staff_reply as the signed-in member: it
--    checks access and Meta's 24-hour window, saves the message with
--    meta.delivery = 'queued' and pauses the bot.
-- 2. The dashboard server sends ONLY the message id to the "Staff Reply" n8n
--    workflow, which calls bot.claim_staff_reply (queued → sending, once),
--    sends it with the page token kept in n8n, then bot.finish_staff_reply.
-- n8n can therefore only ever send text a team member wrote, once.
-- ---------------------------------------------------------------------
create or replace function public.queue_staff_reply(p_conversation uuid, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_conv public.conversations%rowtype;
  v_text text := btrim(coalesce(p_text, ''));
  v_last timestamptz;
  v_id   bigint;
begin
  select * into v_conv from public.conversations where id = p_conversation;
  if v_uid is null or not found or not public.is_store_member(v_conv.store_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if v_text = '' or length(v_text) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'bad_text');
  end if;
  if v_conv.channel_type not in ('messenger', 'instagram') then
    return jsonb_build_object('ok', false, 'error', 'channel_not_supported');
  end if;
  -- Meta only accepts a reply within 24 hours of the customer's last message.
  select max(created_at) into v_last from public.messages where conversation_id = v_conv.id and role = 'customer';
  if v_last is null or v_last < now() - interval '24 hours' then
    return jsonb_build_object('ok', false, 'error', 'window_closed');
  end if;

  insert into public.messages (store_id, conversation_id, role, text, meta)
  values (v_conv.store_id, v_conv.id, 'staff', v_text, jsonb_build_object('delivery', 'queued', 'by', v_uid))
  returning id into v_id;

  update public.conversations
     set status = 'human', handled_by = v_uid, handled_at = now(),
         bot_paused_until = greatest(coalesce(bot_paused_until, now()), now() + interval '12 hours'),
         last_message_at = now(), last_message_preview = left(v_text, 140)
   where id = v_conv.id;

  return jsonb_build_object('ok', true, 'message_id', v_id);
end;
$$;

-- payload: {message_id}. Returns what n8n needs to send it, or {ok: false} if it is not waiting to be sent.
create or replace function bot.claim_staff_reply(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg     public.messages%rowtype;
  v_conv    public.conversations%rowtype;
  v_account text;
begin
  if coalesce(p ->> 'message_id', '') !~ '^[0-9]{1,18}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  update public.messages
     set meta = meta || jsonb_build_object('delivery', 'sending')
   where id = (p ->> 'message_id')::bigint
     and role = 'staff' and meta ->> 'delivery' = 'queued' and meta ? 'by'
     and created_at > now() - interval '10 minutes'
  returning * into v_msg;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_queued');
  end if;

  select * into v_conv from public.conversations where id = v_msg.conversation_id;
  -- the page / Instagram account the conversation came in on (or the store's connected one)
  select ch.external_id into v_account
    from public.channels ch
   where ch.store_id = v_conv.store_id and ch.type = v_conv.channel_type
   order by (ch.id = v_conv.channel_id) desc nulls last, (ch.status = 'connected') desc, ch.created_at
   limit 1;

  return jsonb_build_object('ok', true, 'message_id', v_msg.id, 'channel_type', v_conv.channel_type,
                            'recipient_id', v_conv.external_user_id, 'account_id', v_account, 'text', v_msg.text);
end;
$$;

-- payload: {message_id, ok, error?, provider_message_id?}
create or replace function bot.finish_staff_reply(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean := coalesce((p ->> 'ok')::boolean, false);
begin
  if coalesce(p ->> 'message_id', '') !~ '^[0-9]{1,18}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  update public.messages
     set meta = meta || jsonb_strip_nulls(jsonb_build_object(
           'delivery', case when v_ok then 'sent' else 'failed' end,
           'error', case when v_ok then null else left(coalesce(p ->> 'error', 'send_failed'), 200) end,
           'provider_message_id', left(p ->> 'provider_message_id', 200)))
   where id = (p ->> 'message_id')::bigint and role = 'staff' and meta ->> 'delivery' = 'sending';
  return jsonb_build_object('ok', found, 'delivery', case when v_ok then 'sent' else 'failed' end);
end;
$$;

revoke all on function public.queue_staff_reply(uuid, text) from public, anon;
grant execute on function public.queue_staff_reply(uuid, text) to authenticated;

-- Only n8n_bot may call these (Supabase gives new functions to anon and
-- authenticated by default).
revoke all on function bot.begin_turn(jsonb), bot.submit_order(jsonb), bot.finish_turn(jsonb), bot.sync_catalog(jsonb),
  bot.claim_staff_reply(jsonb), bot.finish_staff_reply(jsonb)
  from public, anon, authenticated;
grant execute on function bot.begin_turn(jsonb), bot.submit_order(jsonb), bot.finish_turn(jsonb), bot.sync_catalog(jsonb),
  bot.claim_staff_reply(jsonb), bot.finish_staff_reply(jsonb) to n8n_bot;
