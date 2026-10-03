create table public.calendars (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index calendars_owner_id_idx on public.calendars (owner_id);

alter table public.calendars enable row level security;

create trigger calendars_set_updated_at
before update on public.calendars
for each row
execute function private.set_updated_at();

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

create policy "calendars_app_be_select"
on public.calendars
for select
to app_be
using (owner_id is not null);

revoke all on table public.calendars from public, anon;
grant select, insert, delete on table public.calendars to authenticated;
grant update (updated_at) on table public.calendars to authenticated;
grant select on table public.calendars to app_be;
