create table public.{{tableSql}} (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index {{table}}_owner_id_idx on public.{{tableSql}} (owner_id);

alter table public.{{tableSql}} enable row level security;
alter table public.{{tableSql}} force row level security;

create trigger {{table}}_set_updated_at
before update on public.{{tableSql}}
for each row
execute function private.set_updated_at();

create policy "{{table}}_app_be_select"
on public.{{tableSql}}
for select
to app_be
using (owner_id is not null);

create policy "{{table}}_app_be_insert"
on public.{{tableSql}}
for insert
to app_be
with check (owner_id is not null);

create policy "{{table}}_app_be_update"
on public.{{tableSql}}
for update
to app_be
using (owner_id is not null)
with check (owner_id is not null);

create policy "{{table}}_app_be_delete"
on public.{{tableSql}}
for delete
to app_be
using (owner_id is not null);

revoke all on table public.{{tableSql}} from public, anon, authenticated;
grant select, insert, update, delete on table public.{{tableSql}} to app_be;
