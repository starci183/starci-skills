-- The public surface of the example: the one public-read table the lite data API may
-- expose, the storage bucket of booking attachments, the booking-reminder queue with
-- its pg_cron tick, and the aggregate read the readiness probe uses.

-- job_stats reports the queue and job ledgers as one aggregate so the readiness probe
-- answers in one call. It reads tables whose row level security refuses the probe
-- role, so it runs as its owner: a safe security definer keeps an empty search path,
-- and every role but the back end is revoked below.
create or replace function public.job_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'checkedAt', now(),
        'queued', (select count(*) from public.queue where sent_at is null),
        'running', (select count(*) from public.jobs where status = 'running'),
        'failed', (select count(*) from public.jobs where status = 'failed')
    )
$$;

revoke all on function public.job_stats() from public, anon, authenticated;
grant execute on function public.job_stats() to app_be;

-- The only table the browser may read without the back end: its name and its one
-- policy carry the _public_read marker that owns the exception.
create table public.announcements_public_read (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    published_at timestamptz not null default now()
);

alter table public.announcements_public_read enable row level security;
alter table public.announcements_public_read force row level security;

create policy announcements_public_read_public_read
on public.announcements_public_read for select to public
using (true);

create policy announcements_public_read_app_be_insert
on public.announcements_public_read for insert to app_be
with check (title is not null);

create policy announcements_public_read_app_be_update
on public.announcements_public_read for update to app_be
using (title is not null)
with check (title is not null);

create policy announcements_public_read_app_be_delete
on public.announcements_public_read for delete to app_be
using (title is not null);

revoke all on table public.announcements_public_read from public, anon, authenticated;
grant select on table public.announcements_public_read to anon;
grant select, insert, update, delete on table public.announcements_public_read to app_be;

-- The bucket of booking attachments: private, size- and type-bounded, and reachable
-- only by the back end through the storage.objects policies named after it. The
-- caller's verified principal owns the first path segment of every attachment.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking_attachments', 'booking_attachments', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']);

create policy objects_app_be_select
on storage.objects for select to app_be
using (bucket_id = 'booking_attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy objects_app_be_insert
on storage.objects for insert to app_be
with check (bucket_id = 'booking_attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy objects_app_be_update
on storage.objects for update to app_be
using (bucket_id = 'booking_attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'booking_attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy objects_app_be_delete
on storage.objects for delete to app_be
using (bucket_id = 'booking_attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

grant usage on schema storage to app_be;
grant select, insert, update, delete on table storage.objects to app_be;

-- The booking-reminder job marks the reminder it sent on the booking row.
alter table public.bookings
add column reminder_sent_at timestamptz;

grant update (reminder_sent_at) on table public.bookings to app_be;

-- The second queue of the example: the same outbox shape as booking_confirmation, fed
-- both by the create-booking transaction and by the recurring tick below.
select pgmq.create('booking_reminder');

grant select, insert, update, delete on table pgmq.q_booking_reminder to app_be;
grant select, insert on table pgmq.a_booking_reminder to app_be;

-- The recurring job of the example: every fifteen minutes pg_cron asks for one tick on
-- the booking-reminder queue. By rule a tick only enqueues; the scan for due bookings
-- belongs to the send-reminder job the delivery claims.
create or replace function private.booking_reminder_tick()
returns void
language plpgsql
set search_path = ''
as $$
begin
    perform pgmq.send('booking_reminder', jsonb_build_object('payload', jsonb_build_object('tick', true)));
end;
$$;

revoke all on function private.booking_reminder_tick() from public, anon, authenticated;

select cron.schedule(
    'booking_reminder_tick',
    '*/15 * * * *',
    $$select private.booking_reminder_tick()$$
);
