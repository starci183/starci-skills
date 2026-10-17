-- Both the claim and receipt event use the intake transaction; after-commit processing reads the outbox separately.
create table public.inbox (
    source text not null check (source <> ''),
    event_id text not null check (event_id <> ''),
    claimed_at timestamptz not null default now(),
    primary key (source, event_id)
);

alter table public.inbox enable row level security;
alter table public.inbox force row level security;

create policy "inbox_app_be_select"
on public.inbox for select to app_be
using (source <> '');

create policy "inbox_app_be_insert"
on public.inbox for insert to app_be
with check (source <> '');

revoke all on table public.inbox from public, anon, authenticated;
grant select, insert on table public.inbox to app_be;
