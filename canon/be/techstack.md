# BE tech stack — the one place a concrete name is said out loud

`canon/be/explore/system-design/` is written portable on purpose: "the message broker," "the read
model," "a durable queue," so that a rule survives an infrastructure swap and can be judged against
a system nobody has stood up yet. This file is the one exception. It says, once, what this backend
actually runs those portable words on, so a reader can turn "the broker" into `NATS` without
guessing, and so that if one of these is ever replaced, this is the one file to edit and the table
below is the list of what else needs a re-read.

| Layer | Technology | What it is for | Grounds |
|---|---|---|---|
| Framework | NestJS | the module system, DI container, and composition root every capability folder is written against | [`explore/system-design/module-layering.md`](explore/system-design/module-layering.md) |
| Language | TypeScript | the type system `enforce/authoring/type-safety.md` holds every enum, DTO, and thrown exception to | [`enforce/authoring/type-safety.md`](enforce/authoring/type-safety.md) |
| Data store | PostgreSQL, via TypeORM | the repository boundary, transactions, and the `synchronize` schema every entity is written against | [`explore/system-design/data-access.md`](explore/system-design/data-access.md) |
| API — sync | GraphQL, code-first, with a REST minority for webhooks and admin | the wire contract a resolver or controller promises a caller | [`explore/system-design/api-design.md`](explore/system-design/api-design.md) |
| Messaging | NATS | the in-process/inter-service message bus a decoupled call publishes to | [`explore/system-design/messaging-and-events.md`](explore/system-design/messaging-and-events.md) |
| CDC | Debezium, streaming into Kafka | how a Postgres row change becomes an event a projection can consume without polling | [`explore/system-design/messaging-and-events.md`](explore/system-design/messaging-and-events.md), [`explore/system-design/cqrs-and-projections.md`](explore/system-design/cqrs-and-projections.md) |
| Jobs | BullMQ, on Redis | the durable queue behind every handler that enqueues instead of blocking a request | [`explore/system-design/background-jobs.md`](explore/system-design/background-jobs.md) |
| Auth | Keycloak | the OIDC provider that answers who is calling, ahead of every per-object authorization check | [`explore/system-design/auth-and-authz.md`](explore/system-design/auth-and-authz.md) |
| Media | MinIO | the object store behind an upload or an encode pipeline, reached the same way a database is: through a boundary, never a raw client scattered through business code | [`explore/system-design/background-jobs.md`](explore/system-design/background-jobs.md), [`explore/system-design/data-access.md`](explore/system-design/data-access.md) |
| Search | Elasticsearch | a disposable, recomputable read model fed by change data capture rather than queried live against Postgres | [`explore/system-design/cqrs-and-projections.md`](explore/system-design/cqrs-and-projections.md) |

## Reading this table

Each row names a convention, not a preference. "Debezium and Kafka ground
`messaging-and-events.md`" means the rule that a projection is *fed*, never polled, is not an
abstract preference for event-driven design — it is what this backend's CDC pipeline already does,
and the file states the discipline that keeps a consumer honest about it. Swap the broker and the
discipline holds; the concrete class names in the file's examples would not.

Two rows — media and search — ground files that were written before those systems had a page of
their own; the mapping says where the reasoning already applies, not that a dedicated file exists
yet. That gap is itself worth knowing before writing a new rule for either.

Nothing here is a tutorial for any of these systems — their own documentation is that. This is the
map from the portable word to the concrete name, and back.
