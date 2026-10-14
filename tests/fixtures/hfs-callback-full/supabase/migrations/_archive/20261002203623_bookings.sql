create table public.bookings (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index bookings_owner_id_idx on public.bookings (owner_id);

alter table public.bookings enable row level security;

create trigger bookings_set_updated_at
before update on public.bookings
for each row
execute function private.set_updated_at();

create policy "bookings_authenticated_select"
on public.bookings
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy "bookings_authenticated_insert"
on public.bookings
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "bookings_authenticated_update"
on public.bookings
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "bookings_authenticated_delete"
on public.bookings
for delete
to authenticated
using (owner_id = (select auth.uid()));

create policy "bookings_app_be_select"
on public.bookings
for select
to app_be
using (owner_id is not null);

revoke all on table public.bookings from public, anon;
grant select, insert, delete on table public.bookings to authenticated;
grant update (updated_at) on table public.bookings to authenticated;
grant select on table public.bookings to app_be;
