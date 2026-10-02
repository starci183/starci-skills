create table public.resources (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.resources enable row level security;

create policy "resources_authenticated_select"
on public.resources
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy "resources_authenticated_insert"
on public.resources
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "resources_authenticated_update"
on public.resources
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "resources_authenticated_delete"
on public.resources
for delete
to authenticated
using (owner_id = (select auth.uid()));

grant select, insert, update, delete on table public.resources to authenticated;
