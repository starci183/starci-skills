-- app_be receives only the queue operations the transport uses, restricted to the
-- three migration-owned queues. The pgmq schema and its sequences stay private.
create or replace function private.require_app_queue(queue_name text)
returns void
language plpgsql
set search_path = ''
as $$
begin
    if queue_name is null or queue_name not in ('booking_confirmation', 'booking_reminder', 'calendar_delivery') then
        raise exception 'queue is not owned by the application' using errcode = '22023';
    end if;
end;
$$;

revoke all on function private.require_app_queue(text) from public, anon, authenticated, app_be;

create or replace function private.queue_send(queue_name text, message jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform private.require_app_queue(queue_name);
    return pgmq.send(queue_name, message);
end;
$$;

revoke all on function private.queue_send(text, jsonb) from public, anon, authenticated;
grant execute on function private.queue_send(text, jsonb) to app_be;

create or replace function private.queue_read(queue_name text, visibility_seconds integer, batch_size integer)
returns table (msg_id bigint, read_ct integer, message jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform private.require_app_queue(queue_name);
    return query
        select delivered.msg_id, delivered.read_ct, delivered.message
        from pgmq.read(queue_name, visibility_seconds, batch_size) as delivered;
end;
$$;

revoke all on function private.queue_read(text, integer, integer) from public, anon, authenticated;
grant execute on function private.queue_read(text, integer, integer) to app_be;

create or replace function private.queue_archive(queue_name text, message_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform private.require_app_queue(queue_name);
    return pgmq.archive(queue_name, message_id);
end;
$$;

revoke all on function private.queue_archive(text, bigint) from public, anon, authenticated;
grant execute on function private.queue_archive(text, bigint) to app_be;

create or replace function private.queue_set_vt(queue_name text, message_id bigint, visibility_seconds integer)
returns table (msg_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform private.require_app_queue(queue_name);
    return query
        select delivered.msg_id
        from pgmq.set_vt(queue_name, message_id, visibility_seconds) as delivered;
end;
$$;

revoke all on function private.queue_set_vt(text, bigint, integer) from public, anon, authenticated;
grant execute on function private.queue_set_vt(text, bigint, integer) to app_be;
