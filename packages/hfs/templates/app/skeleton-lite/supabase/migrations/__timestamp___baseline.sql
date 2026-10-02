create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null check (char_length(display_name) between 1 and 120),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

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
revoke all on table public.profiles from public, anon;
grant select, insert on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
