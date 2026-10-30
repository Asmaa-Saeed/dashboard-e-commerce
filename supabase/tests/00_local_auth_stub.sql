create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create publication supabase_realtime;
insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-00000000000a','admin@test.com'),
 ('00000000-0000-0000-0000-0000000000b1','owner@yasmeen.com'),
 ('00000000-0000-0000-0000-0000000000b2','staff@yasmeen.com'),
 ('00000000-0000-0000-0000-0000000000c1','owner@other.com');
