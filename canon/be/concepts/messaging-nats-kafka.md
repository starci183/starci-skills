# Messaging — NATS and Kafka

Source: `src/modules/event/nats/` and `src/modules/kafka/`. Two cross-service pub/sub systems with
different jobs; neither is the in-process bus described in
[cqrs-commands-events](cqrs-commands-events.md).

## NATS — cross-service pub/sub by subject

Subjects are declared in the `EventName` enum (`src/modules/event/enums/`).

**Adding a subject means editing two places:** add it to `EventName`, *and* declare it in
`EventModule.register({ nats: { subjects: [...] } })` in `apps/core/src/app.module.ts`. Miss the
second and nothing subscribes — the publish succeeds, the handler never fires, and there is no error
to read. This is the single most common way a new NATS event silently does nothing.

## Kafka — the CDC channel

`src/modules/kafka/` (`KafkaService`, built on `kafkajs`) carries change data capture: Debezium
streams every Postgres insert, update and delete into a topic. The two main consumer groups are
[cqrs-projection-and-cdc](cqrs-projection-and-cdc.md) and
[elasticsearch-sync](elasticsearch-sync.md).

Call `ensureTopics()` before subscribing, so that a topic that does not yet exist does not break boot.

Kafka consumer boot is deliberately **best-effort**: if Kafka is down the failure is logged and
swallowed and the app still starts. Kafka is not treated as a hard bootstrap dependency, because the
HTTP and GraphQL surface is useful without it.

## Choosing between the three

- An internal side effect that should be decoupled from the caller — the CQRS event bus.
- Fan-out between services or apps, addressed by subject — NATS.
- A stream of Postgres data changes — Kafka.
