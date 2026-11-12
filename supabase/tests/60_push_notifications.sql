\set ON_ERROR_STOP 0
-- Phone notifications (05_push_notifications.sql). Run as postgres after 01, 02, 05_seed_test_emails
-- and 05_push_notifications. On plain Postgres (no pg_net / Vault) load the stub first:
--   psql -d t -f 60_push_stub.sql
-- then run 05_push_notifications.sql without its first "create extension pg_net" line.
-- Expected ERROR lines: 5 (P2, P3, P5, P11, S7), all on purpose.

create or replace function pg_temp.act(u text) returns void language plpgsql as $$
begin
  if u is null then perform set_config('request.jwt.claim.sub', '', false);
  else perform set_config('request.jwt.claim.sub', u, false); end if;
end $$;

select id as ys from stores where slug = 'yasmeen-home' \gset
insert into stores (slug, name, order_ref_prefix) values ('push-other', 'متجر آخر', 'PO')
  on conflict (slug) do update set name = excluded.name returning id as os \gset
insert into store_members values (:'ys', '00000000-0000-0000-0000-0000000000b2', 'staff') on conflict do nothing;
delete from push_subscriptions;
delete from net.calls;
delete from vault.decrypted_secrets;

-- ===== saving phones =====
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000b2');   -- staff of Yasmeen
select 'P1 staff saves a phone for own store' as test;
select register_push_subscription(:'ys', 'https://push.example/abc', repeat('p', 87), repeat('a', 22), 'test-agent');
select 'P2 staff saves a phone for another store (expect error)' as test;
select register_push_subscription(:'os', 'https://push.example/zzz', repeat('p', 87), repeat('a', 22));
select 'P3 bad endpoint (expect error)' as test;
select register_push_subscription(:'ys', 'http://push.example/abc', repeat('p', 87), repeat('a', 22));
select 'P4 staff sees own phone only: 1' as test, count(*) from push_subscriptions;
select 'P5 direct insert blocked (expect error)' as test;
insert into push_subscriptions (store_id, user_id, endpoint, p256dh, auth)
  values (:'ys', '00000000-0000-0000-0000-0000000000b2', 'https://push.example/x', 'p', 'a');

select pg_temp.act('00000000-0000-0000-0000-0000000000b1');   -- owner, same phone (shared device)
select 'P6 owner takes over the same phone' as test;
select register_push_subscription(:'ys', 'https://push.example/abc', repeat('q', 87), repeat('b', 22));
select 'P7 owner now sees it: 1' as test, count(*) from push_subscriptions;
select pg_temp.act('00000000-0000-0000-0000-0000000000b2');
select 'P8 staff no longer sees it: 0' as test, count(*) from push_subscriptions;
select 'P9 staff cannot remove the owner''s phone' as test;
select unregister_push_subscription('https://push.example/abc');
reset role;
select 'P10 phone still saved: 1' as test, count(*) from push_subscriptions;

set role anon;
select 'P11 anon cannot save (expect error)' as test;
select register_push_subscription(:'ys', 'https://push.example/anon', repeat('p', 87), repeat('a', 22));
reset role;

-- ===== sending =====
select 'S1 no Vault secrets yet → order saved, nothing sent: 0' as test;
insert into orders (store_id, ref, customer_name, customer_phone, city, subtotal, delivery_fee)
  values (:'ys', 'YH-PUSH-0', 'سماح', '0599000000', 'نابلس', 100, 20);
select count(*) from net.calls;

insert into vault.decrypted_secrets values
  ('push_function_url', 'https://ref.supabase.co/functions/v1/send-push'),
  ('push_webhook_secret', 'test-secret-that-is-long-enough-123');

select 'S2 new order → one call' as test;
insert into orders (store_id, ref, customer_name, customer_phone, city, subtotal, delivery_fee)
  values (:'ys', 'YH-PUSH-1', 'سماح', '0599000000', 'نابلس', 100, 20.5);
select url, body ->> 'title' as title, body ->> 'body' as body, body ->> 'url' as link, headers ->> 'x-push-secret' as secret
  from net.calls order by id desc limit 1;

select 'S3 order in a store with no phones → no call: 1 total' as test;
insert into orders (store_id, ref, customer_name, customer_phone, subtotal) values (:'os', 'PO-1', 'x', '0500000000', 50);
select count(*) from net.calls;

select 'S4 conversation needs a person → one call' as test;
insert into conversations (store_id, channel_type, external_user_id, display_name, last_message_preview)
  values (:'ys', 'instagram', 'ig-push-1', 'أم أحمد', 'بدي أحكي مع حدا') returning id as c1 \gset
update conversations set status = 'needs_human', handoff_reason = 'asked_for_human' where id = :'c1';
select body ->> 'title' as title, body ->> 'body' as body, body ->> 'url' as link from net.calls order by id desc limit 1;

select 'S5 updating it again while still needs_human → no new call: 2 total' as test;
update conversations set status = 'needs_human', last_message_preview = 'وين' where id = :'c1';
select count(*) from net.calls;

select 'S6 staff takes over, then it needs a person again → new call: 3 total' as test;
update conversations set status = 'human' where id = :'c1';
update conversations set status = 'needs_human', handoff_reason = 'wholesale' where id = :'c1';
select count(*) from net.calls;

select 'S7 authenticated cannot call push_notify directly (expect error)' as test;
set role authenticated;
select pg_temp.act('00000000-0000-0000-0000-0000000000b1');
select push_notify(:'ys', 'spam', 'spam', '/', 'x');
reset role;
