-- Scheduler diagnostics are available only to the local migration owner, not API roles.
create or replace function private.booking_reminder_schedule()
returns table (jobid bigint, schedule text, command text)
language sql
set search_path = ''
as $$
    select jobid, schedule, command from cron.job where jobname = 'booking_reminder_tick';
$$;
revoke all on function private.booking_reminder_schedule() from public, anon, authenticated, app_be;

create or replace function private.register_booking_reminder_schedule()
returns bigint
language sql
set search_path = ''
as $$
    select cron.schedule('booking_reminder_tick', '*/15 * * * *', 'select private.booking_reminder_tick()');
$$;
revoke all on function private.register_booking_reminder_schedule() from public, anon, authenticated, app_be;
