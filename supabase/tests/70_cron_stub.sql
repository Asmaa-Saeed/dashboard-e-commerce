-- Local test only: stands in for Supabase pg_cron so 06_notifications.sql runs on plain Postgres.
create schema if not exists cron;
create table if not exists cron.job (jobid serial primary key, jobname text unique, schedule text, command text);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint
language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid::bigint
$$;
