-- In-app + phone notifications (06_notifications.sql). Run as postgres after 01, 02, 05_seed_test_emails,
-- 03, 04, the push stub + 05, the cron stub (70_cron_stub.sql) and 06.
-- Every check raises on failure, so the file stops at the first broken one. No ERROR lines are expected.

create or replace function pg_temp.act(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
end $$;

create or replace function pg_temp.expect(label text, ok boolean) returns text language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', label; end if;
  return 'ok ' || label;
end $$;

-- Raises unless the statement fails.
create or replace function pg_temp.expect_error(label text, stmt text) returns text language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    return 'ok ' || label;
  end;
  raise exception 'FAILED (no error): %', label;
end $$;

-- ---------------------------------------------------------------- setup
select pg_temp.act(null);
delete from notifications;
delete from net.calls;
delete from vault.decrypted_secrets;
delete from push_subscriptions;

insert into stores (slug, name, order_ref_prefix) values ('notif-other', 'متجر آخر', 'NO')
  on conflict (slug) do update set name = excluded.name;
insert into store_members
  select id, '00000000-0000-0000-0000-0000000000b2', 'staff' from stores where slug = 'yasmeen-home'
  on conflict do nothing;
insert into store_members
  select id, '00000000-0000-0000-0000-0000000000c1', 'owner' from stores where slug = 'notif-other'
  on conflict do nothing;

create temp table ids as
  select (select id from stores where slug = 'yasmeen-home') as ys,
         (select id from stores where slug = 'notif-other')  as os;
grant select on ids to authenticated;

-- ---------------------------------------------------------------- schema
select pg_temp.expect('N0 conversations.username exists',
  exists (select 1 from information_schema.columns where table_name = 'conversations' and column_name = 'username')) as test;

-- ---------------------------------------------------------------- events → one row per member
insert into orders (store_id, ref, customer_name, customer_phone, city, subtotal, delivery_fee)
  select ys, 'YH-N-1', 'سماح', '0599000001', 'نابلس', 100, 20 from ids;
select pg_temp.expect('N1 new order → a row for the owner and the staff member',
  (select count(*) from notifications where kind = 'order') = 2
  and (select count(distinct user_id) from notifications where kind = 'order') = 2) as test;
select pg_temp.expect('N1b the other store''s owner gets nothing',
  not exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-0000000000c1')) as test;
select pg_temp.expect('N1c order link opens that order',
  (select bool_and(url like '/s/yasmeen-home/orders?id=%') from notifications where kind = 'order')) as test;

insert into conversations (store_id, channel_type, external_user_id, display_name)
  select ys, 'instagram', 'ig-n-1', 'أم أحمد' from ids;
update conversations set status = 'needs_human', handoff_reason = 'asked_for_human' where external_user_id = 'ig-n-1';
select pg_temp.expect('N2 handoff → 2 rows', (select count(*) from notifications where kind = 'handoff') = 2) as test;
update conversations set status = 'human' where external_user_id = 'ig-n-1';
update conversations set status = 'needs_human' where external_user_id = 'ig-n-1';
select pg_temp.expect('N2b a second handoff of the same conversation is a new event: 4',
  (select count(*) from notifications where kind = 'handoff') = 4) as test;

insert into order_requests (store_id, order_id, type, text)
  select o.store_id, o.id, 'modify', 'بدي أغير اللون' from orders o where o.ref = 'YH-N-1';
select pg_temp.expect('N3 change request → 2 rows',
  (select count(*) from notifications where kind = 'order_request') = 2) as test;

insert into products (store_id, external_id, name) select ys, 'p-n-1', 'طقم أطباق' from ids;
insert into product_variants (store_id, product_id, external_id, label)
  select p.store_id, p.id, v, v from products p, unnest(array['v-n-1', 'v-n-2']) v where p.external_id = 'p-n-1';
update product_variants set out_of_stock = true where external_id = 'v-n-1';
select pg_temp.expect('N4 variant sold out → 2 rows',
  (select count(*) from notifications where kind = 'stock') = 2) as test;
update product_variants set out_of_stock = true where external_id = 'v-n-2';
update products set out_of_stock = true where external_id = 'p-n-1';
select pg_temp.expect('N4b more sell-outs of the same product the same day → still 2',
  (select count(*) from notifications where kind = 'stock') = 2) as test;
update product_variants set stock_qty = 5 where external_id = 'v-n-1';
select pg_temp.expect('N4c unrelated column change → still 2',
  (select count(*) from notifications where kind = 'stock') = 2) as test;

-- ---------------------------------------------------------------- reading: own rows only
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect('N5 staff sees only own rows',
  (select count(*) from notifications) > 0
  and (select bool_and(user_id = '00000000-0000-0000-0000-0000000000b2') from notifications)) as test;
select pg_temp.expect_error('N5b staff cannot edit a notification directly',
  'update notifications set title = ''x''') as test;
select pg_temp.expect_error('N5c staff cannot insert directly',
  format('insert into notifications (store_id, user_id, kind, title) values (%L, %L, ''order'', ''x'')',
         (select ys from ids), '00000000-0000-0000-0000-0000000000b2')) as test;
select pg_temp.expect('N6 mark one read → 1',
  mark_notifications_read((select ys from ids), array[(select id from notifications order by created_at limit 1)]) = 1) as test;
select pg_temp.expect('N6b mark all read → the rest',
  mark_notifications_read((select ys from ids)) > 0) as test;
select pg_temp.expect('N6c nothing unread left for staff',
  not exists (select 1 from notifications where read_at is null)) as test;
select pg_temp.expect_error('N7 staff cannot send platform messages',
  format('select admin_send_notification(%L, ''t'', ''b'', ''/'')', (select ys from ids))) as test;
reset role;
select pg_temp.expect('N6d the owner''s rows are still unread',
  (select count(*) from notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and read_at is null) > 0) as test;

-- ---------------------------------------------------------------- platform messages
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');   -- platform admin
select pg_temp.expect('N8 admin → all stores: returns 2 stores',
  admin_send_notification(null, 'ميزة جديدة', 'صار فيكم ترسلوا صور', '/') = 2) as test;
reset role;
select pg_temp.expect('N8b everyone in both stores got it: 3',
  (select count(*) from notifications where kind = 'announcement') = 3) as test;
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('N9 admin → one store',
  admin_send_notification((select os from ids), 'تنبيه', 'نص', 'https://evil.example') = 1) as test;
reset role;
select pg_temp.expect('N9b only that store, and the outside link is dropped',
  (select count(*) from notifications where kind = 'announcement') = 4
  and (select url from notifications where title = 'تنبيه') is null) as test;
select pg_temp.expect_error('N9c empty title is refused',
  format('select admin_send_notification(null, '' '', ''b'', null)')) as test;

-- ---------------------------------------------------------------- subscription reminders (owners only)
update stores set status = 'trial', trial_ends_at = now() + interval '2 days 20 hours' where slug = 'yasmeen-home';
update stores set status = 'active', subscription_renews_at = now() + interval '30 days' where slug = 'notif-other';
select pg_temp.expect('N10 one store is 3 days from the end → 1', notify_subscription_reminders() = 1) as test;
select pg_temp.expect('N10b only the owner got it',
  (select count(*) from notifications where kind = 'subscription') = 1
  and (select user_id from notifications where kind = 'subscription') = '00000000-0000-0000-0000-0000000000b1') as test;
select notify_subscription_reminders();
select pg_temp.expect('N10c running again the same day adds nothing',
  (select count(*) from notifications where kind = 'subscription') = 1) as test;
select pg_temp.expect('N10d the daily job is scheduled',
  exists (select 1 from cron.job where jobname = 'flowpal-subscription-reminders')) as test;

-- ---------------------------------------------------------------- push follows the same audience
insert into vault.decrypted_secrets values
  ('push_function_url', 'https://ref.supabase.co/functions/v1/send-push'),
  ('push_webhook_secret', 'test-secret-that-is-long-enough-123');
insert into push_subscriptions (store_id, user_id, endpoint, p256dh, auth)
  select ys, '00000000-0000-0000-0000-0000000000b1', 'https://push.example/n', repeat('p', 87), repeat('a', 22) from ids;
select notify_store((select ys from ids), 'subscription', 'اشتراكك', 'ينتهي قريبًا', '/', 'push-test', true);
select pg_temp.expect('N11 owners-only push names the owner',
  (select body -> 'user_ids' from net.calls order by id desc limit 1) = '["00000000-0000-0000-0000-0000000000b1"]'::jsonb) as test;
select notify_store((select ys from ids), 'order', 'طلب', 'x', '/', 'push-test-2', false);
select pg_temp.expect('N11b everyone push sends no user filter',
  (select body -> 'user_ids' from net.calls order by id desc limit 1) is null) as test;

-- ---------------------------------------------------------------- failures never block the event
delete from vault.decrypted_secrets;
alter table notifications add constraint notif_break check (false) not valid;
insert into orders (store_id, ref, customer_name, customer_phone, city, subtotal, delivery_fee)
  select ys, 'YH-N-2', 'هبة', '0599000002', 'رام الله', 50, 20 from ids;
select pg_temp.expect('N12 a broken notifications table does not stop the order',
  exists (select 1 from orders where ref = 'YH-N-2')) as test;
alter table notifications drop constraint notif_break;

select 'all notification checks passed' as test;
