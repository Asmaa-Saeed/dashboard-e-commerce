-- =====================================================================
-- First store: Yasmeen Home (مؤسسة الياسمين للأدوات المنزلية)
-- Run after 01 and 02. Safe to re-run (updates instead of duplicating).
--
-- Before running: replace the two emails below.
--   1) YOUR_EMAIL   → your login (platform admin, sees every store)
--   2) OWNER_EMAIL  → the store owner's login (leave as is to skip for now)
-- Both people must already exist in Authentication → Users.
-- =====================================================================

do $$
declare
  v_admin_email text := 'YOUR_EMAIL@example.com';
  v_owner_email text := 'OWNER_EMAIL@example.com';
  v_store uuid;
  v_user uuid;
begin
  -- platform admin
  select id into v_user from auth.users where lower(email) = lower(v_admin_email);
  if v_user is not null then
    insert into public.platform_admins (user_id) values (v_user) on conflict do nothing;
  else
    raise notice 'Admin % not found in auth.users — skipped. Create the user, then run this file again.', v_admin_email;
  end if;

  -- store
  insert into public.stores (slug, name, logo_url, brand_color, website_url, whatsapp, phone,
                             currency, currency_symbol, dialect, order_ref_prefix, status,
                             inventory_mode, wholesale_enabled, catalog_source, catalog_config)
  values ('yasmeen-home', 'مؤسسة الياسمين للأدوات المنزلية',
          'https://yasmeenhome.com/upload/04-2025/system/2.png', '#B7790F',
          'https://yasmeenhome.com', '972598844197', '0598844197',
          'ILS', '₪', 'palestinian', 'YH', 'trial',
          'flag', true, 'digital_life_feed',
          jsonb_build_object('feed_url', 'https://yasmeenhome.com/?app=product.api.allProducts'))
  on conflict (slug) do update set name = excluded.name, catalog_config = excluded.catalog_config
  returning id into v_store;

  -- owner
  select id into v_user from auth.users where lower(email) = lower(v_owner_email);
  if v_user is not null then
    insert into public.store_members (store_id, user_id, role) values (v_store, v_user, 'owner')
    on conflict (store_id, user_id) do update set role = 'owner';
  end if;

  -- policies (from the owner's answers)
  update public.store_policies set
    payment_methods    = array['الدفع نقدًا عند الاستلام'],
    delivery_time_text = 'من يوم ليومين، ومندوب التوصيل بيتصل فيك قبل ما يوصل.',
    exchange_allowed   = false,
    exchange_text      = 'ما في تبديل ولا إرجاع، فبنتأكد معك من كل التفاصيل قبل ما نبعت الطلب.',
    cancellation_text  = 'بتقدر تلغي الطلب قبل ما ينبعت مع شركة التوصيل.',
    working_hours      = 'كل أيام الأسبوع',
    wholesale_text     = 'أسعار الجملة حسب الكمية، والفريق بيتواصل معك.'
  where store_id = v_store;

  -- bot
  update public.bot_settings set
    assistant_name        = 'مساعد الياسمين',
    llm_provider          = 'openai',
    llm_model             = 'gpt-4.1-mini',
    featured_category_ids = array['10', '12', '18', '8', '5', '6'],
    use_thumbnails        = true
  where store_id = v_store;

  -- delivery zones
  insert into public.delivery_zones (store_id, name, fee, aliases, sort) values
    (v_store, 'الضفة', 20, array['الضفة','جنين','طوباس','نابلس','سلفيت','طولكرم','قلقيلية','رام الله','البيرة','ضواحي القدس','العيزرية','ابو ديس','الرام','اريحا','الخليل','بيت لحم','قباطية'], 1),
    (v_store, 'القدس', 30, array['القدس','بيت حنينا','شعفاط','سلوان','الطور','جبل المكبر','صور باهر','وادي الجوز','راس العامود'], 2),
    (v_store, 'الداخل', 70, array['الداخل','الداخل 48','الناصرة','حيفا','يافا','عكا','ام الفحم','الطيبة','الطيرة','سخنين','كفر قاسم','اللد','الرملة','رهط','ابو غوش'], 3)
  on conflict (store_id, name) do update set fee = excluded.fee, aliases = excluded.aliases, sort = excluded.sort;

  -- delivery companies for the "copy for delivery" button
  insert into public.delivery_companies (store_id, name) values
    (v_store, 'دايركت'), (v_store, 'ورود فونتي')
  on conflict (store_id, name) do nothing;

  -- web chat channel (the n8n Chat Trigger)
  insert into public.channels (store_id, type, external_id, display_name, status, connected_at)
  values (v_store, 'web_chat', 'yasmeen-home-web', 'شات الموقع', 'connected', now())
  on conflict (type, external_id) do nothing;
end $$;
