-- Local diagnostics remove only selected deliveries through the extension API.
create or replace function private.queue_delete(queue_name text, message_id bigint)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
    perform private.require_app_queue(queue_name);
    return pgmq.delete(queue_name, message_id);
end;
$$;
revoke all on function private.queue_delete(text, bigint) from public, anon, authenticated, app_be;
