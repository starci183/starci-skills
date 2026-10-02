-- One violation per SQL rule (L03-L07), in declaration order.

-- L03: an exposed table with no enable row level security in this migration.
create table public.no_rls (id bigint primary key);

-- L04: the nivo-lite pattern - a loop hiding alter table statements from the parser.
do $$
declare
  t record;
begin
  for t in select tablename from pg_catalog.pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t.tablename);
  end loop;
end $$;

-- L05: a write policy that admits every row, an anonymous write, an unscoped read name,
-- a grant to service_role, and a grant to anon with no _public_read policy.
create table public.orders (id bigint primary key, amount numeric);
alter table public.orders enable row level security;
create policy orders_member_all on public.orders
  for all to authenticated
  using (true) with check (true);
create policy orders_anon_insert on public.orders
  for insert to anon
  with check (amount > 0);
create policy loose_read on public.orders
  for select to authenticated
  using (true);
grant select on public.orders to service_role;
grant delete on public.orders to anon;

-- L06: definer functions that miss every safety clause.
create or replace function public.dangerous()
returns void
language plpgsql
security definer
as $$
begin
  execute 'vacuum';
end $$;

create or replace function private.loose_delete(what text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  execute 'delete from ' || what;
end $$;

create or replace function private.raw_format(what text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  execute format('delete from audit_%s', what);
end $$;

-- L07: a public bucket that does not say so by name, no bounds, no policy.
insert into storage.buckets (id, name) values ('avatars', 'avatars');
