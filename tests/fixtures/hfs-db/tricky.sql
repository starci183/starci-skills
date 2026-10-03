-- TRICKY non-matches: every construct below looks suspicious to a regex but is clean to the AST rules.
-- create table public.fake (id int);           <- a comment, never a statement
-- alter table public.fake enable row level security;   <- commented out, does not count as an enable

select 'create table public.words (id int)';   -- a string literal, not a statement

create table if not exists public."quoted table" (id int);  -- a quoted identifier is a real table
alter table public."quoted table" enable row level security;
create policy "quoted table_member_select" on public."quoted table"
  for select to authenticated using (true = true);

-- if not exists is still a real create: it needs its enable too.
create table if not exists public.sessions (id uuid primary key);
alter table public.sessions enable row level security;
create policy sessions_member_all on public.sessions
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- A partitioned parent needs RLS; the partitions inherit it and are exempt.
create table public.events (id bigint, at timestamptz) partition by range (at);
alter table public.events enable row level security;
create table public.events_2026 partition of public.events
  for values from ('2026-01-01') to ('2027-01-01');

-- security invoker is exempt from the definer rules.
create or replace function public.visible_count()
returns bigint
language sql
security invoker
as $$ select count(*) from public.sessions $$;

-- search_path pinned by a later alter function instead of the create option.
create or replace function private.touch()
returns void
language plpgsql
security definer
as $$ begin perform 1; end $$;
alter function private.touch() set search_path = '';

-- A DO block whose dynamic SQL only touches data is legal.
do $$
declare
  t text;
begin
  for t in select tablename from pg_catalog.pg_tables where schemaname = 'private' loop
    execute format('analyze %I', t);
  end loop;
end $$;

-- A policy granted in a later statement of the same file satisfies the grant.
create table public.standards (code text primary key);
alter table public.standards enable row level security;
grant select on public.standards to anon;
create policy standards_public_read on public.standards for select using (true);
