-- Local test only: stands in for Supabase pg_net and Vault so 05_push_notifications.sql runs on plain Postgres.
create schema if not exists extensions;
create schema if not exists net;
create table net.calls (id serial, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000)
returns bigint language sql as $$ insert into net.calls (url, body, headers) values (url, body, headers) returning id::bigint $$;
create schema if not exists vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);
