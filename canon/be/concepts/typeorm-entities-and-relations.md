# TypeORM entities and relations (PostgreSQL primary)

Source: `src/modules/databases/postgresql/primary/entities/` — roughly 70+ entities. This is schema
only; business rules live in `bussiness/`, see [feature-layer](feature-layer.md).

## Query through `EntityManager`, never `Repository` (strict)

Inject `@InjectPrimaryPostgreSQLEntityManager()` for **every** database call. One injection point per
service makes joins and multi-entity transactions straightforward, and the module never needs a
`forFeature([...])` registration at all.

```ts
// Wrong: a per-entity repository injection
@InjectRepository(Entity, POSTGRESQL_PRIMARY)
// Wrong: registering entities module-by-module
NestTypeOrmModule.forFeature([...])
// Wrong: active record — TypeORM 0.3 is repository/manager based
await entity.save()
```

## i18n

A translated table is split: `<x>.entity.ts` plus `<x>-translation.entity.ts`. An enum used both as a
database column and in GraphQL is defined once, with a companion `createEnumType`.

## Exposure is `@Field`, and nothing is stripped on read (security, strict)

A sensitive field — a model answer, a rubric, a secret — keeps its `@Column` but **has no `@Field`**,
with a JSDoc line saying it is not a GraphQL field.

Do not leave the `@Field` on and `delete obj.x` in the service. Stripping on read is fragile: miss one
read path — an Elasticsearch `_source`, a REST route, another query — and the data leaks. Absence
from the schema holds regardless of which path does the reading.

## Secondary stores

- Qdrant — vectors, `databases/qdrant/`, see [rag-langchain](rag-langchain.md).
- Elasticsearch — `@modules/elasticsearch`, see [elasticsearch-sync](elasticsearch-sync.md).
- Redis — **two different modules**: `native/redis` (node-redis v5) and `native/ioredis` (ioredis).
  Their interfaces differ, so injecting the wrong one compiles and then fails at the call.
