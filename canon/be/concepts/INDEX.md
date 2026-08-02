# Back end — the concepts shelf

The three sibling shelves say how a line is spelled. This one says **what the piece is** — the layers
this backend is actually built out of, one file per concept, each naming the `src/` folder it was read
from. Open the concept before opening the convention: knowing that a resolver leaf is five files and
that every thrown value extends `AbstractException` is what makes the spelling rules mean anything.

A concept file is a map of a real subsystem, not a design proposal. If the folder it names has moved,
the file is stale and the source wins.

| File | Decides |
|---|---|
| [`abstract-exception-layer.md`](abstract-exception-layer.md) | that every thrown value extends `AbstractException` with a stable `code` and structured `metadata`, and that bare `Error` and the Nest built-ins are banned because neither groups in the log or in Sentry |
| [`ai-catalog-balancer-entitlement.md`](ai-catalog-balancer-entitlement.md) | the three layers under `ai/` — the model catalog and its balancer with key rotation, quota and entitlement over one credit pool, and the routers that pick a model per task by `ModelTier` |
| [`auth-keycloak-session.md`](auth-keycloak-session.md) | which of the three easily confused auth modules owns what: Keycloak for OIDC, login and RBAC, `session/` for the device session, `membership/` for the package |
| [`background-jobs-bullmq.md`](background-jobs-bullmq.md) | where a business processor lives and the shape of one processor folder — `@Processor` over `WorkerHost`, the service beside it, the typed payload DTO |
| [`config-and-env.md`](config-and-env.md) | which of the three configuration sources a value belongs to — env read as `envConfig().X.Y`, app YAML, or a mounted key — and that `process.env` is touched in one file only |
| [`cqrs-commands-events.md`](cqrs-commands-events.md) | the in-process event bus over `@nestjs/cqrs`: one event per folder, event class beside handler, and how it differs from cross-service messaging and from projection |
| [`cqrs-projection-and-cdc.md`](cqrs-projection-and-cdc.md) | the read-model path — write to Postgres, Debezium to Kafka, `AbstractProjectionListener` deriving affected targets, each recomputed with an idempotent UPSERT — and what a subclass has to declare |
| [`elasticsearch-sync.md`](elasticsearch-sync.md) | that search lives in `@modules/elasticsearch` with one mapping file per entity, and that the sync path is a Kafka CDC listener rather than a projection base class |
| [`envelope-response-shape.md`](envelope-response-shape.md) | that every GraphQL operation returns `AbstractGraphQLResponse`, that the transform interceptor is what wraps it, and where the real entity sits in the double nesting the front end receives |
| [`feature-layer.md`](feature-layer.md) | what `src/features/` is for — wiring the application and exposing an endpoint or consumer — and why a module is reusable on its own while a feature is not |
| [`graphql-resolver-pattern.md`](graphql-resolver-pattern.md) | the five-file leaf module behind every query and mutation, the strict three-piece naming, and why the parent must import the leaf module rather than the resolver |
| [`init-v2-and-seeders.md`](init-v2-and-seeders.md) | startup seeding and synchronizers, and what V2 means: content pulled from git as a tarball plus a diff overlay instead of a full reseed from a local `.mount/` |
| [`judge0-coding-execution.md`](judge0-coding-execution.md) | how the coding-practice surface is graded — submit, poll, then map the verdict — and that a raw Judge0 status never reaches GraphQL |
| [`media-dash-ffmpeg.md`](media-dash-ffmpeg.md) | the lesson-video pipeline end to end: S3 upload, a queued job, FFmpeg transcode to several bitrates, Bento4 segmenting into HLS and DASH |
| [`messaging-nats-kafka.md`](messaging-nats-kafka.md) | the two cross-service pub/sub systems and their different jobs, including the two places a NATS subject must be declared before anything subscribes |
| [`module-layer-structure.md`](module-layer-structure.md) | what makes something a module — a reusable `DynamicModule` that exposes no endpoint of its own — and the fixed three-file shape it always has |
| [`mount-content-parsing.md`](mount-content-parsing.md) | the two-function parser that turns markdown course content under `.mount/data` into an entity graph, and the separator token wrapping every leaf value |
| [`observability-sentry-winston.md`](observability-sentry-winston.md) | Winston into Loki tagged by `ServiceName`, Sentry for error tracking, and the double-registration behaviour in the app module |
| [`payment-gateways-and-webhooks.md`](payment-gateways-and-webhooks.md) | the five gateways, which market each serves, and that every one of them carries its own webhook controller |
| [`rag-langchain.md`](rag-langchain.md) | the LangChain model and embedding wrappers, the Qdrant vector store, and that RAG is the business layer on top of the balancer rather than a parallel route to the providers |
| [`realtime-socketio.md`](realtime-socketio.md) | the Socket.IO gateway core with its Redis adapters and per-namespace decorators, filters and interceptors, plus the concrete namespaces that exist |
| [`rest-controller-pattern.md`](rest-controller-pattern.md) | the rarer REST half — controllers grouped by area, no types declared inline, and an `@ApiProperty` on every DTO field because Swagger and Scalar are generated from them |
| [`transactional-email.md`](transactional-email.md) | that `transactional-email/` decides the content of a mail while `@modules/mailer` sends it, that locale is picked per user, and that nothing is sent in the request path |
| [`typeorm-entities-and-relations.md`](typeorm-entities-and-relations.md) | the primary Postgres schema, and the strict rule that every database call goes through an injected `EntityManager` rather than a per-entity `Repository` |

## Reading order

There is none. Open the concept the task touches, then the convention shelf for how the resulting
lines are typed. A new feature usually crosses two or three concepts, so reach for the file, not the
set.
