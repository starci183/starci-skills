create table public.resources (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index resources_owner_id_idx on public.resources (owner_id);

alter table public.resources enable row level security;

create trigger resources_set_updated_at
before update on public.resources
for each row
execute function private.set_updated_at();

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

create policy "resources_app_be_select"
on public.resources
for select
to app_be
using (owner_id is not null);

revoke all on table public.resources from public, anon;
grant select, insert, delete on table public.resources to authenticated;
grant update (updated_at) on table public.resources to authenticated;
grant select on table public.resources to app_be;
