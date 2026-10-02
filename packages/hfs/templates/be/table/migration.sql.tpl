create table public.{{table}} (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.{{table}} enable row level security;

create policy "{{table}}_authenticated_select"
on public.{{table}}
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy "{{table}}_authenticated_insert"
on public.{{table}}
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "{{table}}_authenticated_update"
on public.{{table}}
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "{{table}}_authenticated_delete"
on public.{{table}}
for delete
to authenticated
using (owner_id = (select auth.uid()));

grant select, insert, update, delete on table public.{{table}} to authenticated;
