# Concept — CQRS projection and CDC (Debezium to Kafka to recompute)

Source: `src/modules/projection/`, `src/modules/bussiness/projections/`, `src/modules/kafka/`.

This is the read-model layer: a write lands in Postgres, Debezium picks it up as CDC, the row arrives
on a Kafka topic, an `AbstractProjectionListener` derives which targets are affected, and each target
is recomputed with an idempotent UPSERT. It is not
[`cqrs-commands-events.md`](cqrs-commands-events.md), which is an in-process side effect and has no
read model behind it.

## What a subclass has to declare

`AbstractProjectionListener<TTarget>` lives at `src/modules/projection/abstract-projection.listener.ts`
and does the rest. A subclass declares only:

- `groupId` — a stable Kafka consumer group, so a restart resumes from the committed offset instead
  of replaying from the beginning;
- `topics` — the CDC topics it watches;
- `deriveTargets(message)` — mapping one CDC row to the target or targets to recompute;
- `recomputeTarget(target)` — the idempotent UPSERT.

Connect and shutdown are `KafkaService`'s job, not the subclass's.

## Boot is best-effort, and messages are swallowed

Kafka is down in some environments, so a failed connect is logged in Error style and swallowed: the
app still starts. A message that fails is likewise logged and not rethrown. That is safe here
precisely because delivery is at-least-once — a later message heals the target.

The Debezium envelope is read as `envelope.payload ?? envelope`, because the row arrives either
nested or at the top level.

## The listeners

Sixteen, re-counted 2026-08-03. Fifteen are folders under `src/modules/bussiness/projections/` —
`content-engagement`, `contribution`, `course-stats`, `league-cohort-points`, `progress`,
`trending-contents`, `user-capstone`, `user-coding`, `user-flashcard-course-stats`,
`user-flashcard-stats`, `user-mock-interview-course-stats`, `user-pinned-projects`,
`user-solved-challenges`, `user-stats`, `user-xp` — and `achievements.projection.listener.ts` sits
beside them rather than in a folder of its own.

## Why the Elasticsearch listener is not one of these

`EsSyncUserListener` does **not** extend `AbstractProjectionListener`. It writes into the search
index, not into a Postgres read model, so it manages its own Kafka wiring. See
[`elasticsearch-sync.md`](elasticsearch-sync.md).
