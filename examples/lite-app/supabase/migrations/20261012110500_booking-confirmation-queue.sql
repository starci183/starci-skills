-- Supabase Queues (pgmq) carry the jobs of the back end. A job is written by the producer's business transaction: one row of
-- public.queue (the outbox of the queues) and one pgmq message, both through the app_be connection, so the job exists
-- exactly when the change commits.
create extension if not exists pgmq;

select pgmq.create('booking_confirmation');

-- A booking waits for its confirmation job; the processor moves it to confirmed once.
alter table public.bookings
add column status text not null default 'pending',
add constraint bookings_status_check check (status in ('pending', 'confirmed'));

create table public.queue (
    id uuid primary key default gen_random_uuid(),
    queue varchar(200) not null,
    payload jsonb not null,
    created_at timestamptz not null,
    sent_at timestamptz
);

create index queue_unsent_idx on public.queue (created_at, id) where sent_at is null;

alter table public.queue enable row level security;

-- The dedicated app_be PostgreSQL role is the only application path. With no anon or authenticated policy, RLS denies the
-- PostgREST roles by default.
create policy "queue_app_be_select"
on public.queue for select to app_be
using (queue is not null);

create policy "queue_app_be_insert"
on public.queue for insert to app_be
with check (queue is not null);

create policy "queue_app_be_update"
on public.queue for update to app_be
using (queue is not null)
with check (queue is not null);

revoke all on table public.queue from public, anon, authenticated;
grant select, insert, update on table public.queue to app_be;

-- The back end creates bookings and confirms them; the browser keeps its own owner-scoped policies.
create policy "bookings_app_be_insert"
on public.bookings for insert to app_be
with check (owner_id is not null);

create policy "bookings_app_be_update"
on public.bookings for update to app_be
using (owner_id is not null)
with check (owner_id is not null);

grant insert (owner_id, resource_id, starts_at, ends_at) on table public.bookings to app_be;
grant update (status) on table public.bookings to app_be;
grant select on table public.resources to app_be;

-- The queue of the example: app_be sends, reads, retries and archives its messages and nothing else.
grant usage on schema pgmq to app_be;
grant execute on all functions in schema pgmq to app_be;
grant select on table pgmq.meta to app_be;
grant select, insert, update, delete on table pgmq.q_booking_confirmation to app_be;
grant select, insert on table pgmq.a_booking_confirmation to app_be;
grant usage, select on all sequences in schema pgmq to app_be;
