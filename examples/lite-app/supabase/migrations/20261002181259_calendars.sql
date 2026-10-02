create table public.calendars (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.calendars enable row level security;

create policy "calendars_authenticated_select"
on public.calendars
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy "calendars_authenticated_insert"
on public.calendars
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "calendars_authenticated_update"
on public.calendars
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "calendars_authenticated_delete"
on public.calendars
for delete
to authenticated
using (owner_id = (select auth.uid()));

grant select, insert, update, delete on table public.calendars to authenticated;
