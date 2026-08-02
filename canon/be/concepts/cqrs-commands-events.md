# Concept — CQRS event bus (in-process, decoupled side effects)

Source: `src/modules/cqrs/`.

`src/modules/cqrs/event-bus/` wraps `@nestjs/cqrs`. It is not
[`messaging-nats-kafka.md`](messaging-nats-kafka.md), which is cross-service pub/sub, and not
[`cqrs-projection-and-cdc.md`](cqrs-projection-and-cdc.md), which recomputes a read model from
Debezium and Kafka.

## One event, one folder

`<name>.event.ts` holds the class carrying the payload, `<name>.handler.ts` handles it, and
`index.ts` exports both.

A handler extends `ICQRSHandler<Event, Result>` and implements `ICommandHandler`, and it overrides
**`process()`** — not `execute()`. The wrapper puts retry around `process`, so a handler that
overrides `execute` silently loses it.

A domain or feature service publishes with `eventBus.publish(new XEvent(payload))`.

The handlers that exist, re-counted 2026-08-03: `add-github-user-to-team`, `send-mail`,
`sync-scylladb`.

## The deliberate double registration

`apps/core/src/app.module.ts` registers both `CqrsModule.forRoot()` (Nest's own) and
`CQRSModule.register({ isGlobal: true })` (the local wrapper, which adds the custom event bus). Both
are needed. Neither is a leftover to delete.

## Choosing the mechanism

An internal side effect that should be decoupled and retried goes on the CQRS event bus. Heavy work
that needs a queue goes to [`background-jobs-bullmq.md`](background-jobs-bullmq.md). Pub/sub between
services or apps goes to [`messaging-nats-kafka.md`](messaging-nats-kafka.md).
