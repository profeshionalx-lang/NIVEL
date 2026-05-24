-- Schedules a cron job to ping the session-reminders endpoint every 15 minutes.
-- Prerequisites: two secrets in Supabase Vault before applying this migration:
--   select vault.create_secret('<base url>',   'nivel_url',         'Base URL of Nivel app');
--   select vault.create_secret('<cron secret>', 'nivel_cron_secret', 'Bearer token for /api/cron/* endpoints');
-- Supabase managed Postgres does not allow `ALTER DATABASE SET app.*` for arbitrary GUCs,
-- so we read from Vault instead.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare j_id int;
begin
  select jobid into j_id from cron.job where jobname = 'session-reminders';
  if j_id is not null then
    perform cron.unschedule(j_id);
  end if;
end $$;

select cron.schedule(
  'session-reminders',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'nivel_url') || '/api/cron/session-reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'nivel_cron_secret')
    )
  );
  $$
);
