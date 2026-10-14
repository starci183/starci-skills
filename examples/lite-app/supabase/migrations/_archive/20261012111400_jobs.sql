-- The fenced jobs: one row per delivery key. A claim bumps the fencing token in this table, and every other write of a worker
-- carries the token it holds, so a worker that lost its claim changes nothing. Only the app_be connection reaches it.
create table public.jobs (
    id uuid primary key default gen_random_uuid(),
    kind varchar(200) not null,
    job_key varchar(200) not null,
    status varchar(16) not null,
    current_step varchar(200),
    fencing_token bigint not null,
    claimed_by varchar(200),
    lease_expires_at timestamptz,
    payload jsonb not null,
    error text,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint jobs_job_key_key unique (job_key),
    constraint jobs_status_check check (status in ('running', 'failed', 'done')),
    constraint jobs_fencing_token_check check (fencing_token >= 1)
);

alter table public.jobs enable row level security;

-- With no anon or authenticated policy, RLS denies the PostgREST roles by default.
create policy "jobs_app_be_select"
on public.jobs for select to app_be
using (kind is not null);

create policy "jobs_app_be_insert"
on public.jobs for insert to app_be
with check (kind is not null);

create policy "jobs_app_be_update"
on public.jobs for update to app_be
using (kind is not null)
with check (kind is not null);

revoke all on table public.jobs from public, anon, authenticated;
grant select, insert, update on table public.jobs to app_be;
