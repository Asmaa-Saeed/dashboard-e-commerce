-- Staff replies. Run after 40_bot_functions.sql, as postgres:
--   psql -d t -f 50_staff_reply.sql
-- Lines marked (expect error) must fail.
\set ON_ERROR_STOP 0
create or replace function pg_temp.act(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', coalesce(u,''), false); end $$;

-- setup: staff member, a Messenger conversation with a fresh customer message, an old one, a web chat one
insert into store_members (store_id, user_id, role)
select id, '00000000-0000-0000-0000-0000000000b2', 'staff' from stores where slug = 'yasmeen-home' on conflict do nothing;
insert into channels (store_id, type, external_id, status) select id, 'messenger', 'PAGE-1', 'connected' from stores where slug = 'yasmeen-home' on conflict do nothing;
delete from conversations where external_user_id in ('PSID-1', 'PSID-OLD', 'web-1');
insert into conversations (store_id, channel_type, external_user_id) select id, t, u from stores, (values ('messenger', 'PSID-1'), ('messenger', 'PSID-OLD'), ('web_chat', 'web-1')) v(t, u) where slug = 'yasmeen-home';
insert into messages (store_id, conversation_id, role, text, created_at)
select store_id, id, 'customer', 'مرحبا', case when external_user_id = 'PSID-OLD' then now() - interval '2 days' else now() end from conversations where external_user_id in ('PSID-1', 'PSID-OLD', 'web-1');

set role authenticated; select pg_temp.act('00000000-0000-0000-0000-0000000000b2');
\echo '-- S1 staff queues a reply: ok + message_id'
select queue_staff_reply((select id from conversations where external_user_id = 'PSID-1'), 'أهلا، معك الفريق') ->> 'ok' as ok;
\echo '-- S2 older than 24h: window_closed'
select queue_staff_reply((select id from conversations where external_user_id = 'PSID-OLD'), 'مرحبا') ->> 'error' as error;
\echo '-- S3 web chat: channel_not_supported'
select queue_staff_reply((select id from conversations where external_user_id = 'web-1'), 'مرحبا') ->> 'error' as error;
\echo '-- S4 empty text: bad_text'
select queue_staff_reply((select id from conversations where external_user_id = 'PSID-1'), '   ') ->> 'error' as error;
reset role;
\echo '-- S5 owner of another store, passing the id directly (expect error)'
select format('select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-0000000000c1'', false); set role authenticated; select queue_staff_reply(%L, %L);', id, 'hack') as q from conversations where external_user_id = 'PSID-1' \gset
:q
reset role;
\echo '-- S6 conversation is now handled by staff and the bot paused'
select status, bot_paused_until > now() + interval '11 hours' as paused, last_message_preview from conversations where external_user_id = 'PSID-1';

\echo '-- S7 n8n claims it once, the second claim gets not_queued'
select max(id) as mid from messages where role = 'staff' \gset
set role n8n_bot;
select bot.claim_staff_reply(jsonb_build_object('message_id', :mid)) - 'message_id' as claim;
select bot.claim_staff_reply(jsonb_build_object('message_id', :mid)) ->> 'error' as second;
select bot.finish_staff_reply(jsonb_build_object('message_id', :mid, 'ok', true, 'provider_message_id', 'm_1')) as finish;
\echo '-- S8 the bot user still cannot read messages directly (expect error)'
select count(*) from messages;
reset role;
select meta - 'by' as meta from messages where id = (select max(id) from messages where role = 'staff');
