-- Schedules a cron job to ping the session-reminders endpoint every 15 minutes.
-- Prerequisites: set both GUCs before applying, then reconnect:
--   ALTER DATABASE postgres SET app.cron_secret = '<same value as Vercel CRON_SECRET>';
--   ALTER DATABASE postgres SET app.nivel_url   = 'https://nivel-five.vercel.app';
-- Reconnect (new SQL session) so cron.schedule reads the fresh GUCs.

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
    url := current_setting('app.nivel_url') || '/api/cron/session-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  );
  $$
);
