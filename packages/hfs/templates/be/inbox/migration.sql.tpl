create table public.@@table@@ (
    id uuid primary key default gen_random_uuid(),
    provider text not null check (provider = '@@provider@@'),
    delivery_id text not null,
    received_at timestamptz not null default now(),
    payload jsonb not null,
    processed_at timestamptz,
    constraint @@table@@_provider_delivery_id_key unique (provider, delivery_id)
);

alter table public.@@table@@ enable row level security;

-- The dedicated app_be PostgreSQL role is the only application path. With no anon or authenticated policy,
-- RLS denies those PostgREST roles by default; the service-role JWT is deliberately not granted here.
create policy "@@table@@_app_be_select"
on public.@@table@@ for select to app_be
using (provider = '@@provider@@');

create policy "@@table@@_app_be_insert"
on public.@@table@@ for insert to app_be
with check (provider = '@@provider@@');

create policy "@@table@@_app_be_update"
on public.@@table@@ for update to app_be
using (provider = '@@provider@@')
with check (provider = '@@provider@@');

grant select, insert, update on table public.@@table@@ to app_be;
