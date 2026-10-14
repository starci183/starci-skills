do $$
begin
    if not exists (select 1 from pg_catalog.pg_roles where rolname = 'app_be') then
        create role app_be login noinherit nosuperuser nobypassrls nocreatedb nocreaterole;
    end if;
end;
$$;

alter role app_be login noinherit nosuperuser nobypassrls nocreatedb nocreaterole;

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
alter table public.profiles force row level security;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create policy profiles_app_be_select
on public.profiles
for select
to app_be
using (current_user = 'app_be');

create policy profiles_app_be_insert
on public.profiles
for insert
to app_be
with check (current_user = 'app_be');

create policy profiles_app_be_update
on public.profiles
for update
to app_be
using (current_user = 'app_be')
with check (current_user = 'app_be');

grant usage on schema public to app_be;
revoke all on table public.profiles from public, anon, authenticated;
grant select, insert on table public.profiles to app_be;
grant update (display_name) on table public.profiles to app_be;
