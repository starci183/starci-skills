create table public.bookings (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

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

grant select, insert, update, delete on table public.bookings to authenticated;
