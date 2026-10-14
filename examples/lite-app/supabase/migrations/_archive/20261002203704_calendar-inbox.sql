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

-- The dedicated app_be PostgreSQL role is the only application path. With no anon or authenticated policy,
-- RLS denies those PostgREST roles by default; the service-role JWT is deliberately not granted here.
create policy "calendar_inbox_app_be_select"
on public.calendar_inbox for select to app_be
using (provider = 'calendar');

create policy "calendar_inbox_app_be_insert"
on public.calendar_inbox for insert to app_be
with check (provider = 'calendar');

create policy "calendar_inbox_app_be_update"
on public.calendar_inbox for update to app_be
using (provider = 'calendar')
with check (provider = 'calendar');

revoke all on table public.calendar_inbox from public, anon, authenticated;
grant select, insert, update on table public.calendar_inbox to app_be;
