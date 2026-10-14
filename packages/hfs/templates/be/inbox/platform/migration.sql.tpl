-- Both the claim and receipt event use the intake transaction; after-commit processing reads the outbox separately.
create table public.inbox (
    source text not null check (source <> ''),
    event_id text not null check (event_id <> ''),
    claimed_at timestamptz not null default now(),
    primary key (source, event_id)
);

alter table public.inbox enable row level security;
alter table public.inbox force row level security;

create policy "inbox_app_be_select"
on public.inbox for select to app_be
using (source <> '');

create policy "inbox_app_be_insert"
on public.inbox for insert to app_be
with check (source <> '');

revoke all on table public.inbox from public, anon, authenticated;
grant select, insert on table public.inbox to app_be;

create table public.event_bus (
    event_id text primary key check (event_id <> ''),
    event_name text not null check (event_name <> ''),
    payload jsonb not null,
    recorded_at timestamptz not null default now(),
    delivered_at timestamptz
);

alter table public.event_bus enable row level security;
alter table public.event_bus force row level security;

create policy "event_bus_app_be_select"
on public.event_bus for select to app_be
using (event_name <> '');

create policy "event_bus_app_be_insert"
on public.event_bus for insert to app_be
with check (event_name <> '');

create policy "event_bus_app_be_update"
on public.event_bus for update to app_be
using (event_name <> '')
with check (event_name <> '');

revoke all on table public.event_bus from public, anon, authenticated;
grant select, insert, update on table public.event_bus to app_be;
