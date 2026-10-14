-- Calendar webhooks record the receipt and a queue outbox message in one transaction.
-- The existing app-owned fenced job runner processes the committed receipt.
select pgmq.create('calendar_delivery');

grant select, insert, update, delete on table pgmq.q_calendar_delivery to app_be;
grant select, insert on table pgmq.a_calendar_delivery to app_be;
