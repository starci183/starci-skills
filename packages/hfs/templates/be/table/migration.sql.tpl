create table public.{{tableSql}} (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index {{table}}_owner_id_idx on public.{{tableSql}} (owner_id);

alter table public.{{tableSql}} enable row level security;

create trigger {{table}}_set_updated_at
before update on public.{{tableSql}}
for each row
execute function private.set_updated_at();

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

create policy "{{table}}_app_be_select"
on public.{{tableSql}}
for select
to app_be
using (owner_id is not null);

revoke all on table public.{{tableSql}} from public, anon;
grant select, insert, delete on table public.{{tableSql}} to authenticated;
grant update (updated_at) on table public.{{tableSql}} to authenticated;
grant select on table public.{{tableSql}} to app_be;
