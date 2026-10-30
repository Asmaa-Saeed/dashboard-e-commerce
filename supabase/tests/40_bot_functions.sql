-- Run as the n8n_bot user:  PGPASSWORD=... psql -h 127.0.0.1 -U n8n_bot -d t -f 40_bot_functions.sql
-- Lines marked (expect error) must fail.
\set ON_ERROR_STOP 0
\echo '-- direct table access (expect error x3)'
select count(*) from public.orders;
insert into public.orders (store_id, ref, customer_name, customer_phone, subtotal) select id, 'X-1', 'a', '1', 1 from public.stores limit 1;
select public.store_stats((select id from public.stores limit 1), now() - interval '1 day', now());

\echo '-- begin_turn: new conversation + customer message'
select bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"web_chat","external_user_id":"chat-test-1","message":"مرحبا"}') ->> 'bot_should_reply' as reply,
       jsonb_array_length(bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"web_chat","external_user_id":"chat-test-1","message":"بدي صحون"}') -> 'zones') as zones;
select bot.begin_turn('{"store_slug":"nope","channel_type":"web_chat","external_user_id":"x"}');
\echo '-- bad channel (expect error)'
select bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"sms","external_user_id":"x"}');

\echo '-- submit_order: saved, then duplicate'
\set conv `echo $CONV`
select bot.submit_order(jsonb_build_object(
  'store_id', (bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"web_chat","external_user_id":"chat-test-1"}') ->> 'store_id'),
  'conversation_id', (bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"web_chat","external_user_id":"chat-test-1"}') ->> 'conversation_id'),
  'channel_type', 'web_chat',
  'order', '{"order_ref":"YH-20261028-TEST01","idempotency_key":"k1","customer_name":"سماح","customer_phone":"0599123456","customer_city":"نابلس","customer_address":"رفيديا","delivery_region":"الضفة","delivery_fee":20,"subtotal":1,"items":[{"product_id":"1","product_name":"طقم صحون","quantity":2,"unit_price":45}]}'::jsonb)) ->> 'status' as first,
  bot.submit_order(jsonb_build_object(
  'store_id', (bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"web_chat","external_user_id":"chat-test-1"}') ->> 'store_id'),
  'order', '{"order_ref":"YH-20261028-TEST02","idempotency_key":"k1","customer_name":"x","customer_phone":"1","items":[]}'::jsonb)) as second;
\echo '-- bad item (expect error)'
select bot.submit_order(jsonb_build_object('store_id', (select bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"web_chat","external_user_id":"chat-test-1"}') ->> 'store_id'),
  'order', '{"order_ref":"YH-20261028-TEST03","idempotency_key":"k3","customer_name":"x","customer_phone":"1","items":[{"product_name":"a","quantity":-1,"unit_price":5}]}'::jsonb));

\echo '-- finish_turn: reply, handoff, cancel request'
select bot.finish_turn(jsonb_build_object(
  'store_id', b ->> 'store_id', 'conversation_id', b ->> 'conversation_id',
  'state', '{"version":2,"turns":3}'::jsonb, 'reply_text', 'سجلت طلبك', 'intent', 'modify_order',
  'handoff', '{"reason":"order_change"}'::jsonb,
  'order_request', '{"type":"cancel","order_ref":"YH-20261028-TEST01","text":"بدي الغي"}'::jsonb,
  'events', '[{"type":"handoff","reason":"order_change"},{"type":"bogus"}]'::jsonb))
from (select bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"web_chat","external_user_id":"chat-test-1"}') b) s;
\echo '-- finish_turn on a conversation of another store id (expect error)'
select bot.finish_turn(jsonb_build_object('store_id', gen_random_uuid(), 'conversation_id', bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"web_chat","external_user_id":"chat-test-1"}') ->> 'conversation_id'));

\echo '-- staff take-over keeps the bot quiet: expect false / staff_handling (set by the dashboard as a member)'
-- (00/05 test setup: run "update conversations set status='human', bot_paused_until=now()+interval '1 hour'" as postgres first)
select b ->> 'bot_should_reply' as reply, b ->> 'silent_reason' as why
  from (select bot.begin_turn('{"store_slug":"yasmeen-home","channel_type":"web_chat","external_user_id":"chat-test-1","message":"في حدا؟"}') b) s;

\echo '-- catalog sync: a batch, then finishing without the id list (expect error)'
select bot.sync_catalog('{"store_slug":"yasmeen-home","categories":[{"external_id":"900","title":"تجربة"}],"products":[{"external_id":"9001","name":"منتج تجريبي","price":10,"variants":[{"external_id":"9001-a","label":"أحمر","color":"أحمر","price":10}]}]}');
select bot.sync_catalog('{"store_slug":"yasmeen-home","finish":true,"all_external_ids":[]}');
