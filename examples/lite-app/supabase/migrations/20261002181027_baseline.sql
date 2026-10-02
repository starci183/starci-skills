create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null check (char_length(display_name) between 1 and 120),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_authenticated_select
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_authenticated_insert
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy profiles_authenticated_update
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
