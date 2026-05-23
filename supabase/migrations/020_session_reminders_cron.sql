-- Schedules a cron job to ping the session-reminders endpoint every 15 minutes.
-- Prerequisite: app.cron_secret GUC must be set, e.g.
--   ALTER DATABASE postgres SET app.cron_secret = '<same value as Vercel CRON_SECRET>';
-- After running ALTER DATABASE, reconnect (a new SQL session) before applying this migration.

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
    url := 'https://nivel-five.vercel.app/api/cron/session-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  );
  $$
);
