-- A migration clean to every SQL rule (L03-L07): every exposed table gets its enable and its policies in the
-- same file, the one definer function lives in private with a pinned search_path, the bucket is declared.
create schema if not exists private;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null
);
alter table public.profiles enable row level security;

create policy profiles_member_select on public.profiles
  for select to authenticated
  using (id = auth.uid());
create policy profiles_member_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
create policy profiles_member_update on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, update on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from anon;

-- A deliberate world-readable lookup: the name declares it, for select only.
create table public.countries (
  code text primary key,
  name text not null
);
alter table public.countries enable row level security;
create policy countries_public_read on public.countries
  for select to anon, authenticated
  using (true);
grant select on public.countries to anon;

-- Tables outside the exposed schemas carry no RLS obligation here.
create table private.secrets_audit (
  id bigint generated always as identity primary key,
  actor uuid
);

create or replace function private.is_member(workspace uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$ select exists (select 1 from public.profiles where id = workspace) $$;
revoke execute on function private.is_member(uuid) from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, '{image/png,image/jpeg}');
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand_public', 'brand_public', true, 2097152, '{image/svg+xml}');

create policy objects_member_select on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy objects_member_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');
create policy objects_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'brand_public');

-- Dynamic SQL that is not DDL is legal.
do $$
begin
  execute format('delete from %I where stale', 'private.secrets_audit');
end $$;
