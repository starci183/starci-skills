# Concept — Elasticsearch sync (Postgres to ES)

Source: `src/modules/elasticsearch/`, `src/modules/bussiness/es-sync/`,
`src/modules/init/synchronizers/elasticsearch-synchronizer/`.

`@modules/elasticsearch` owns search and indexing, with one mapping file per entity under
`mappings/`. Re-counted 2026-08-03 those are `challenge`, `coding-problem`, `consultants`,
`contents`, `courses`, `flashcard-deck`, `foundation-category`, `headhunting-companies`,
`milestone-tasks`, `milestones`, `modules` and `user`.

## The sync path is a Kafka CDC listener, not a projection base class

`EsSyncUserListener` (`src/modules/bussiness/es-sync/es-sync-user.listener.ts`) wires Kafka itself:
Debezium streams `public.users` onto a topic, the listener takes the id, and
`EsSyncUserService.reindexOne` either upserts the live row or deletes it when the row is soft-deleted
or gone. It is idempotent, which is what makes at-least-once delivery harmless — a duplicate message
costs a reindex and nothing else.

This is deliberately outside [`cqrs-projection-and-cdc.md`](cqrs-projection-and-cdc.md): the write
target is a search index, not a Postgres read model, and that is the reason it does not extend
`AbstractProjectionListener`.

## Bulk reindex

Bootstrap and reconciliation run through
`src/modules/init/synchronizers/elasticsearch-synchronizer/`, started by `InitModule` at startup —
see [`init-v2-and-seeders.md`](init-v2-and-seeders.md).
`elasticsearch-index-reset.service.ts` resets a mapping when the schema changes.

## Sensitive fields

A sample answer or a rubric must not be indexed by the sync builder. The search index is a second way
out of the database, so it has to agree with the `@Field` exposure gate described in
[`typeorm-entities-and-relations.md`](typeorm-entities-and-relations.md) — a field withheld from
GraphQL and then indexed is still leaked.
