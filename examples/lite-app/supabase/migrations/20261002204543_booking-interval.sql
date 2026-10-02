create extension if not exists btree_gist;

alter table public.bookings
add column resource_id uuid not null references public.resources (id) on delete cascade,
add column starts_at timestamptz not null,
add column ends_at timestamptz not null,
add constraint bookings_valid_interval check (starts_at < ends_at);

create index bookings_resource_id_idx on public.bookings (resource_id);

alter table public.bookings
add constraint bookings_resource_interval_excl
exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
);

alter table public.bookings enable row level security;

revoke all on table public.bookings from public, anon;
grant select, insert, delete on table public.bookings to authenticated;
grant update (resource_id, starts_at, ends_at, updated_at) on table public.bookings to authenticated;
grant select on table public.bookings to app_be;
