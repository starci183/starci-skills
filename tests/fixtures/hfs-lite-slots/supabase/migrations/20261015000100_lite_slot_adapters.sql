-- The local Supabase CLI stack applies these tables and pgmq consumer-group queues.
create extension if not exists pgmq;

create table public.event_bus (
    event_id uuid primary key,
    event_name text not null,
    payload jsonb not null
);
alter table public.event_bus enable row level security;
alter table public.event_bus force row level security;

select pgmq.create('order_notifications');
select pgmq.create('order_metrics');

create table public.orders (
    id uuid primary key,
    buyer_id uuid not null
);
alter table public.orders enable row level security;
alter table public.orders force row level security;

create table public.order_summary (
    buyer_id uuid primary key,
    order_count integer not null check (order_count >= 0)
);
alter table public.order_summary enable row level security;
alter table public.order_summary force row level security;
