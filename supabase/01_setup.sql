-- =====================================================================
-- Stores platform — full database setup (Supabase / Postgres 15+)
-- One database for every store. Each row carries store_id and Row Level
-- Security makes sure a store's team only ever sees its own store.
--
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run: every object uses IF NOT EXISTS / OR REPLACE.
--
-- Who can see what
--   platform admin (you)  → every store (table platform_admins)
--   store owner           → their store, including settings and team
--   store staff           → their store's orders, conversations, products, stock
--   n8n bot               → its own database user (n8n_bot) that can only call
--                           the bot.* functions in 04_bot.sql
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Stores and people
-- ---------------------------------------------------------------------

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name                   text not null,
  logo_url               text,
  brand_color            text not null default '#1F5C45' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  website_url            text,
  whatsapp               text,                       -- international digits, e.g. 972598844197
  phone                  text,
  currency               text not null default 'ILS',
  currency_symbol        text not null default '₪',
  dialect                text not null default 'palestinian'
                           check (dialect in ('palestinian', 'egyptian', 'gulf', 'msa')),
  timezone               text not null default 'Asia/Hebron',
  order_ref_prefix       text not null default 'ST' check (order_ref_prefix ~ '^[A-Z]{2,5}$'),
  -- subscription (one plan for everyone)
  status                 text not null default 'trial'
                           check (status in ('trial', 'active', 'paused', 'cancelled')),
  trial_ends_at          timestamptz,
  subscription_renews_at timestamptz,
  -- features each store switches on for its own way of working (not plan gates)
  inventory_mode         text not null default 'flag'
                           check (inventory_mode in ('flag', 'quantity')),   -- flag = in/out only
  wholesale_enabled      boolean not null default false,
  -- where the product catalog comes from
  catalog_source         text not null default 'manual'
                           check (catalog_source in ('manual', 'digital_life_feed', 'shopify', 'woocommerce', 'custom_feed')),
  catalog_config         jsonb not null default '{}'::jsonb,   -- e.g. {"feed_url": "..."}; never secrets
  catalog_synced_at      timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.store_members (
  store_id   uuid not null references public.stores (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index if not exists store_members_user_idx on public.store_members (user_id);

-- ---------------------------------------------------------------------
-- 2. Store settings the bot reads
-- ---------------------------------------------------------------------

create table if not exists public.store_policies (
  store_id           uuid primary key references public.stores (id) on delete cascade,
  payment_methods    text[] not null default array['الدفع نقدًا عند الاستلام'],
  delivery_time_text text,                 -- "من يوم ليومين"
  exchange_allowed   boolean not null default false,
  exchange_text      text,                 -- shown when exchange_allowed, or the "no exchange" wording
  cancellation_text  text,
  working_hours      text,
  wholesale_text     text,
  extra_faq          jsonb not null default '[]'::jsonb,   -- [{"q": "...", "a": "..."}]
  updated_at         timestamptz not null default now()
);

create table if not exists public.bot_settings (
  store_id              uuid primary key references public.stores (id) on delete cascade,
  enabled               boolean not null default true,
  assistant_name        text not null default 'مساعد المتجر',
  llm_enabled           boolean not null default true,
  llm_provider          text not null default 'openai' check (llm_provider in ('openai', 'anthropic')),
  llm_model             text not null default 'gpt-4.1-mini',
  candidate_products    int  not null default 25 check (candidate_products between 5 and 60),
  max_products_default  int  not null default 3  check (max_products_default between 1 and 10),
  max_products_asked    int  not null default 6  check (max_products_asked between 1 and 12),
  max_quantity_per_item int  not null default 10 check (max_quantity_per_item between 1 and 999),
  featured_category_ids text[] not null default '{}',
  hidden_category_ids   text[] not null default '{}',
  use_thumbnails        boolean not null default true,
  handoff_whatsapp      text,              -- null = stores.whatsapp
  greeting_text         text,
  updated_at            timestamptz not null default now()
);

create table if not exists public.delivery_zones (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  name       text not null,                -- "الضفة"
  fee        numeric(10, 2) not null check (fee >= 0),
  aliases    text[] not null default '{}', -- towns the bot maps to this zone
  eta_text   text,                         -- overrides store_policies.delivery_time_text
  sort       int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, name),
  unique (id, store_id)
);
create index if not exists delivery_zones_store_idx on public.delivery_zones (store_id);

create table if not exists public.delivery_companies (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  name          text not null,             -- "دايركت"
  copy_template text,                      -- text for the "copy for delivery" button; null = default
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (store_id, name),
  unique (id, store_id)
);

-- Messaging channels. Access tokens are NOT stored here: keep them in n8n credentials.
create table if not exists public.channels (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  type          text not null check (type in ('web_chat', 'messenger', 'instagram', 'whatsapp')),
  external_id   text not null,             -- page id / instagram account id / whatsapp phone number id / chat widget key
  display_name  text,
  status        text not null default 'pending' check (status in ('pending', 'connected', 'error', 'disabled')),
  last_error    text,
  connected_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (type, external_id),              -- an incoming webhook finds its store from this
  unique (id, store_id)
);
create index if not exists channels_store_idx on public.channels (store_id);

-- ---------------------------------------------------------------------
-- 3. Catalog (synced from the store website, or entered by hand)
-- ---------------------------------------------------------------------

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  external_id text not null,               -- the id on the store website
  title       text not null,
  parent_external_id text,
  synonyms    text[] not null default '{}',-- extra words customers use
  hidden      boolean not null default false,
  sort        int not null default 0,
  unique (store_id, external_id)
);

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores (id) on delete cascade,
  external_id     text not null,
  name            text not null,
  subtitle        text,
  description     text,
  url             text,
  image_url       text,
  thumbnail_url   text,
  images          jsonb not null default '[]'::jsonb,
  category_ids    text[] not null default '{}',   -- categories.external_id
  price           numeric(10, 2),                 -- lowest variant price
  original_price  numeric(10, 2),
  max_price       numeric(10, 2),
  attributes      jsonb not null default '{}'::jsonb,  -- {"set_label": "...", "piece_count": 12}
  options         jsonb not null default '[]'::jsonb,  -- normalized option groups for the bot
  review_status   text not null default 'ok' check (review_status in ('ok', 'needs_review', 'blocked')),
  issues          jsonb not null default '[]'::jsonb,  -- data-quality findings from the sync
  in_feed         boolean not null default true,       -- false = removed from the website
  manual_hidden   boolean not null default false,      -- hidden from the bot by the store
  out_of_stock    boolean not null default false,      -- whole product (flag mode)
  source_hash     text,                                -- skip rewrites when nothing changed
  synced_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (store_id, external_id),
  unique (id, store_id)
);
create index if not exists products_store_idx on public.products (store_id);
create index if not exists products_review_idx on public.products (store_id, review_status) where review_status <> 'ok';

-- Every product has at least one variant (a "default" one when it has no options).
create table if not exists public.product_variants (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references public.stores (id) on delete cascade,
  product_id          uuid not null,
  external_id         text not null,
  color               text,
  size                text,
  label               text,                 -- what the customer sees, e.g. "أسود / 24 سم"
  price               numeric(10, 2),
  original_price      numeric(10, 2),
  image_url           text,
  in_feed             boolean not null default true,
  out_of_stock        boolean not null default false,   -- flag mode, or auto-set at quantity 0
  stock_qty           int,                               -- quantity mode; null = not counted yet
  low_stock_threshold int not null default 2 check (low_stock_threshold >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (store_id, external_id),
  unique (id, store_id),
  foreign key (product_id, store_id) references public.products (id, store_id) on delete cascade
);
create index if not exists product_variants_product_idx on public.product_variants (product_id);

-- Every stock change, so the numbers can always be explained.
create table if not exists public.inventory_movements (
  id         bigint generated always as identity primary key,
  store_id   uuid not null references public.stores (id) on delete cascade,
  variant_id uuid not null,
  delta      int not null check (delta <> 0),
  reason     text not null check (reason in ('order_confirmed', 'order_cancelled', 'restock', 'adjustment', 'manual_sale', 'return')),
  order_id   uuid,
  note       text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (variant_id, store_id) references public.product_variants (id, store_id) on delete cascade
);
create index if not exists inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index if not exists inventory_movements_store_idx on public.inventory_movements (store_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. Customers, conversations, messages
-- ---------------------------------------------------------------------

create table if not exists public.customers (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores (id) on delete cascade,
  name             text,
  phone            text,
  city             text,
  address          text,
  first_channel    text,
  orders_count     int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, store_id)
);
create unique index if not exists customers_store_phone_uidx on public.customers (store_id, phone) where phone is not null;

create table if not exists public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null references public.stores (id) on delete cascade,
  channel_id           uuid,
  channel_type         text not null check (channel_type in ('web_chat', 'messenger', 'instagram', 'whatsapp')),
  external_user_id     text not null,        -- chat session id / PSID / IG scoped id / phone
  customer_id          uuid,
  display_name         text,
  state                jsonb not null default '{}'::jsonb,   -- bot memory (cart, checkout stage...)
  status               text not null default 'bot' check (status in ('bot', 'needs_human', 'human', 'closed')),
  handoff_reason       text,                 -- wholesale / asked_for_human / order_change / order_failed / unknown_info
  handoff_at           timestamptz,
  handled_by           uuid references auth.users (id) on delete set null,
  handled_at           timestamptz,
  bot_paused_until     timestamptz,          -- staff took over: the bot stays quiet until then
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (store_id, channel_type, external_user_id),
  unique (id, store_id),
  foreign key (channel_id, store_id) references public.channels (id, store_id) on delete set null (channel_id),
  foreign key (customer_id, store_id) references public.customers (id, store_id) on delete set null (customer_id)
);
create index if not exists conversations_inbox_idx on public.conversations (store_id, status, last_message_at desc);

create table if not exists public.messages (
  id              bigint generated always as identity primary key,
  store_id        uuid not null references public.stores (id) on delete cascade,
  conversation_id uuid not null,
  role            text not null check (role in ('customer', 'bot', 'staff')),
  text            text,
  intent          text,
  meta            jsonb not null default '{}'::jsonb,   -- product ids shown, reply source, etc.
  created_at      timestamptz not null default now(),
  foreign key (conversation_id, store_id) references public.conversations (id, store_id) on delete cascade
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists messages_store_idx on public.messages (store_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. Orders
-- ---------------------------------------------------------------------

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references public.stores (id) on delete cascade,
  ref                 text not null,                       -- YH-20261026-K7Q2MA
  idempotency_key     text,                                -- set by the bot, stops double orders
  source              text not null default 'bot' check (source in ('bot', 'manual', 'website')),
  conversation_id     uuid,
  customer_id         uuid,
  customer_name       text not null,
  customer_phone      text not null,
  customer_phone2     text,
  city                text,
  zone_id             uuid,
  zone_name           text,
  address             text,
  subtotal            numeric(10, 2) not null check (subtotal >= 0),
  delivery_fee        numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  total               numeric(10, 2) generated always as (subtotal + delivery_fee) stored,
  currency            text not null default 'ILS',
  payment_method      text not null default 'cod',
  status              text not null default 'pending_review'
                        check (status in ('pending_review', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  stock_applied       boolean not null default false,      -- stock was taken for this order
  delivery_company_id uuid,
  tracking_no         text,
  customer_note       text,
  staff_note          text,
  cancel_reason       text,
  is_demo             boolean not null default false,
  confirmed_at        timestamptz,
  shipped_at          timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (store_id, ref),
  unique (id, store_id),
  foreign key (conversation_id, store_id) references public.conversations (id, store_id) on delete set null (conversation_id),
  foreign key (customer_id, store_id) references public.customers (id, store_id) on delete set null (customer_id),
  foreign key (zone_id, store_id) references public.delivery_zones (id, store_id) on delete set null (zone_id),
  foreign key (delivery_company_id, store_id) references public.delivery_companies (id, store_id) on delete set null (delivery_company_id)
);
create unique index if not exists orders_idempotency_uidx on public.orders (store_id, idempotency_key) where idempotency_key is not null;
create index if not exists orders_store_status_idx on public.orders (store_id, status, created_at desc);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  order_id     uuid not null,
  product_id   uuid,
  variant_id   uuid,
  product_name text not null,               -- copy at order time, prices can change later
  option_label text,
  quantity     int not null check (quantity between 1 and 999),
  unit_price   numeric(10, 2) not null check (unit_price >= 0),
  line_total   numeric(10, 2) generated always as (quantity * unit_price) stored,
  foreign key (order_id, store_id) references public.orders (id, store_id) on delete cascade,
  foreign key (product_id, store_id) references public.products (id, store_id) on delete set null (product_id),
  foreign key (variant_id, store_id) references public.product_variants (id, store_id) on delete set null (variant_id)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- Change / cancel requests the customer sent through the bot after ordering.
create table if not exists public.order_requests (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  order_id    uuid not null,
  type        text not null check (type in ('modify', 'cancel')),
  text        text,
  status      text not null default 'open' check (status in ('open', 'done', 'rejected')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  foreign key (order_id, store_id) references public.orders (id, store_id) on delete cascade
);
create index if not exists order_requests_open_idx on public.order_requests (store_id, status) where status = 'open';

create table if not exists public.order_status_history (
  id          bigint generated always as identity primary key,
  store_id    uuid not null references public.stores (id) on delete cascade,
  order_id    uuid not null,
  from_status text,
  to_status   text not null,
  changed_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (order_id, store_id) references public.orders (id, store_id) on delete cascade
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------
-- 6. Stats and costs
-- ---------------------------------------------------------------------

-- Bot events for the statistics page.
create table if not exists public.analytics_events (
  id              bigint generated always as identity primary key,
  store_id        uuid not null references public.stores (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  type            text not null check (type in ('product_shown', 'search_no_result', 'add_to_cart', 'checkout_started', 'order_submitted', 'handoff')),
  product_id      uuid references public.products (id) on delete set null,
  query           text,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists analytics_events_store_idx on public.analytics_events (store_id, type, created_at desc);

-- AI cost per store, for your admin panel (one price for everyone, so watch the cost).
create table if not exists public.llm_usage (
  id              bigint generated always as identity primary key,
  store_id        uuid not null references public.stores (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  purpose         text not null check (purpose in ('understanding', 'reply')),
  provider        text not null,
  model           text not null,
  input_tokens    int not null default 0,
  output_tokens   int not null default 0,
  cost_usd        numeric(10, 6) not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists llm_usage_store_idx on public.llm_usage (store_id, created_at desc);
