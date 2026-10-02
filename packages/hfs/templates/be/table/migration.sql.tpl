create table public.{{tableSql}} (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.{{tableSql}} enable row level security;

create policy "{{table}}_authenticated_select"
on public.{{tableSql}}
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy "{{table}}_authenticated_insert"
on public.{{tableSql}}
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "{{table}}_authenticated_update"
on public.{{tableSql}}
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "{{table}}_authenticated_delete"
on public.{{tableSql}}
for delete
to authenticated
using (owner_id = (select auth.uid()));

grant select, insert, update, delete on table public.{{tableSql}} to authenticated;
