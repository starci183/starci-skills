-- starci:baseline 20261002204543
-- Squashed baseline of the lite example. The six retired migrations under
-- supabase/migrations/_archive end at stamp 20261002204543; this file reaches the same
-- schema in one pass, so a fresh project replays this file instead of the history.

create extension if not exists pgmq;
create extension if not exists pg_cron;
create extension if not exists btree_gist;

-- The one role the back end authenticates as: it can log in with credentials the
-- pooler holds and carries no escalation grant, so row level security binds it like
-- any unprivileged role.
do $$
begin
    if not exists (select from pg_roles where rolname = 'app_be') then
        create role app_be login nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
    end if;
end
$$;

grant usage on schema public to app_be;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to app_be;

-- Trigger helper that stamps updated_at; an empty search path keeps every name it
-- resolves inside the caller's transaction explicit.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null check (char_length(display_name) between 1 and 120),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create policy profiles_app_be_select
on public.profiles for select to app_be
using (id is not null);

create policy profiles_app_be_insert
on public.profiles for insert to app_be
with check (id is not null);

create policy profiles_app_be_update
on public.profiles for update to app_be
using (id is not null)
with check (id is not null);

revoke all on table public.profiles from public, anon, authenticated;
grant select, insert on table public.profiles to app_be;
grant update (display_name) on table public.profiles to app_be;

create table public.resources (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index resources_owner_id_idx on public.resources (owner_id);

alter table public.resources enable row level security;
alter table public.resources force row level security;

create trigger resources_set_updated_at
before update on public.resources
for each row
execute function private.set_updated_at();

create policy resources_app_be_insert
on public.resources for insert to app_be
with check (owner_id is not null);

create policy resources_app_be_select
on public.resources for select to app_be
using (owner_id is not null);

revoke all on table public.resources from public, anon, authenticated;
grant select on table public.resources to app_be;
grant insert (owner_id) on table public.resources to app_be;

create table public.calendars (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index calendars_owner_id_idx on public.calendars (owner_id);

alter table public.calendars enable row level security;
alter table public.calendars force row level security;

create trigger calendars_set_updated_at
before update on public.calendars
for each row
execute function private.set_updated_at();

create policy calendars_app_be_insert
on public.calendars for insert to app_be
with check (owner_id is not null);

create policy calendars_app_be_select
on public.calendars for select to app_be
using (owner_id is not null);

revoke all on table public.calendars from public, anon, authenticated;
grant select on table public.calendars to app_be;
grant insert (owner_id) on table public.calendars to app_be;

create table public.bookings (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    resource_id uuid not null references public.resources (id) on delete cascade,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint bookings_valid_interval check (starts_at < ends_at),
    constraint bookings_status_check check (status in ('pending', 'confirmed')),
    constraint bookings_resource_interval_excl exclude using gist (
        resource_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
    )
);

create index bookings_owner_id_idx on public.bookings (owner_id);
create index bookings_resource_id_idx on public.bookings (resource_id);

alter table public.bookings enable row level security;
alter table public.bookings force row level security;

create trigger bookings_set_updated_at
before update on public.bookings
for each row
execute function private.set_updated_at();

create policy bookings_app_be_insert
on public.bookings for insert to app_be
with check (owner_id is not null);

create policy bookings_app_be_select
on public.bookings for select to app_be
using (owner_id is not null);

create policy bookings_app_be_update
on public.bookings for update to app_be
using (owner_id is not null)
with check (owner_id is not null);

revoke all on table public.bookings from public, anon, authenticated;
grant select on table public.bookings to app_be;
grant insert (owner_id, resource_id, starts_at, ends_at) on table public.bookings to app_be;
grant update (status) on table public.bookings to app_be;

-- The outbox of the queues: a producer's business transaction writes one row here and
-- the pgmq message together, so the job exists exactly when the change commits.
create table public.queue (
    id uuid primary key default gen_random_uuid(),
    queue varchar(200) not null,
    payload jsonb not null,
    created_at timestamptz not null,
    sent_at timestamptz
);

create index queue_unsent_idx on public.queue (created_at, id) where sent_at is null;

alter table public.queue enable row level security;
alter table public.queue force row level security;

create policy queue_app_be_select
on public.queue for select to app_be
using (queue is not null);

create policy queue_app_be_insert
on public.queue for insert to app_be
with check (queue is not null);

create policy queue_app_be_update
on public.queue for update to app_be
using (queue is not null)
with check (queue is not null);

revoke all on table public.queue from public, anon, authenticated;
grant select, insert, update on table public.queue to app_be;

-- The fenced jobs: one row per delivery key. A claim bumps the fencing token and every
-- other write of a worker carries the token it holds, so a worker that lost its claim
-- changes nothing. Only the app_be connection reaches it.
create table public.jobs (
    id uuid primary key default gen_random_uuid(),
    kind varchar(200) not null,
    job_key varchar(200) not null,
    status varchar(16) not null,
    current_step varchar(200),
    fencing_token bigint not null,
    claimed_by varchar(200),
    lease_expires_at timestamptz,
    payload jsonb not null,
    error text,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint jobs_job_key_key unique (job_key),
    constraint jobs_status_check check (status in ('running', 'failed', 'done')),
    constraint jobs_fencing_token_check check (fencing_token >= 1)
);

alter table public.jobs enable row level security;
alter table public.jobs force row level security;

create trigger jobs_set_updated_at
before update on public.jobs
for each row
execute function private.set_updated_at();

create policy jobs_app_be_select
on public.jobs for select to app_be
using (kind is not null);

create policy jobs_app_be_insert
on public.jobs for insert to app_be
with check (kind is not null);

create policy jobs_app_be_update
on public.jobs for update to app_be
using (kind is not null)
with check (kind is not null);

revoke all on table public.jobs from public, anon, authenticated;
grant select, insert, update on table public.jobs to app_be;

-- Deliveries of the signed calendar webhook land here before the back end resolves
-- them; only the app_be connection reaches them, the service-role JWT is not granted.
create table public.calendar_inbox (
    id uuid primary key default gen_random_uuid(),
    provider text not null check (provider = 'calendar'),
    delivery_id text not null,
    received_at timestamptz not null default now(),
    payload jsonb not null,
    processed_at timestamptz,
    constraint calendar_inbox_provider_delivery_id_key unique (provider, delivery_id)
);

alter table public.calendar_inbox enable row level security;
alter table public.calendar_inbox force row level security;

create policy calendar_inbox_app_be_select
on public.calendar_inbox for select to app_be
using (provider = 'calendar');

create policy calendar_inbox_app_be_insert
on public.calendar_inbox for insert to app_be
with check (provider = 'calendar');

create policy calendar_inbox_app_be_update
on public.calendar_inbox for update to app_be
using (provider = 'calendar')
with check (provider = 'calendar');

revoke all on table public.calendar_inbox from public, anon, authenticated;
grant select, insert, update on table public.calendar_inbox to app_be;

-- The booking-confirmation queue of the example: app_be sends, reads, retries and
-- archives its messages and nothing else.
select pgmq.create('booking_confirmation');

grant select, insert, update, delete on table pgmq.q_booking_confirmation to app_be;
grant select, insert on table pgmq.a_booking_confirmation to app_be;
