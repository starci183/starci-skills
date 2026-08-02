# `modules/` — how a module is put together

Two files, both about the inside of a Nest module rather than the API it exposes.
[`modules-and-di.md`](modules-and-di.md) is the anatomy: every module declared through
`ConfigurableModuleBuilder`, a leaf operation as a folder holding its resolver, service, handler and
command, the runtime flow from a thin resolver through the CommandBus into the handler where the
business logic actually lives, constructor injection with `private readonly`, factory providers in a
`*.providers.ts`, how a leaf is registered in its aggregator, the `index.ts` barrel, and the
file-suffix naming table. [`database-and-entities.md`](database-and-entities.md) picks up where a
handler reaches the database: writing a TypeORM entity under a `synchronize` schema — the abstract
base, explicit column names and types, when a status must be a `varchar` union instead of a Postgres
enum, foreign keys with their hand-written constraint names and companion `@RelationId`, jsonb shapes,
and the columns that deliberately carry no `@Field` — and then writing the query, from the injected
`EntityManager` to nested `relations`, the one-`In(...)`-plus-`Map` cure for N+1, transactions,
`getRawOne` aggregates, and named unique constraints.
