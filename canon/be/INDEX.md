# Back end — how a line of code is written here

Not architecture, not design. These files record **how the backend already spells things**, so that a
module written today reads like the module next to it. Every rule in them names the real `src/` file
it was read from; if a rule and the source disagree, the source wins and the rule is stale — fix it
the way [`HOW-TO-WRITE.md`](../HOW-TO-WRITE.md) describes.

The set is split into four shelves by the question each one answers.

## `concepts/` — what the pieces of this backend are

One file per subsystem, each naming the `src/` folder it was read from: the exception layer, the
resolver leaf, the projection listener, the queue processor, the seeders, the five payment gateways,
and the rest. The other three shelves say how a line is spelled; this one says what the thing being
spelled is, which is why it is usually the cheaper file to open first.

The whole table is [`concepts/INDEX.md`](concepts/INDEX.md) — twenty-five concepts, too many to
restate here without the two copies drifting apart.

## `modules/` — how a module is put together

| File | Decides |
|---|---|
| [`modules/modules-and-di.md`](modules/modules-and-di.md) | folder anatomy of a Nest module, `ConfigurableModuleClass`, the resolver → service → CQRS-handler flow, constructor DI with `private readonly`, factory providers, leaf-versus-aggregator boundaries, the `index.ts` barrel, and file-suffix naming |
| [`modules/database-and-entities.md`](modules/database-and-entities.md) | TypeORM entities under a `synchronize` schema — the abstract base, `@Column` name and type, enum versus `varchar` union, foreign keys with `@JoinColumn` and `@RelationId`, jsonb interfaces, which columns deliberately have no `@Field`, and how a query is written (injected `EntityManager`, nested `relations`, one `In(...)` instead of N+1, transactions, raw aggregates, named constraints) |

## `contracts/` — what the code promises to callers and to other processes

| File | Decides |
|---|---|
| [`contracts/api-surface.md`](contracts/api-surface.md) | the shape of a GraphQL leaf folder and its resolver decorator stack, `request.ts` and `response.ts` under `graphql-types/`, the rarer REST controller with `httpConfig()` paths and Swagger DTOs, and what is banned at the boundary — including the api → bussiness dependency direction |
| [`contracts/validation.md`](contracts/validation.md) | that every input dies at the DTO: the globally registered `ValidationPipe`, decorator order at the field, bounds as named constants mirroring the column, optional-but-still-format-checked, `@IsEnum` against the TypeScript enum, `@ValidateNested` with a size ceiling, cross-field invariants pushed to the handler, and the deliberate all-optional webhook exception |
| [`contracts/exceptions.md`](contracts/exceptions.md) | that every thrown error is a class extending `AbstractException` — never a bare `Error`, never a framework built-in — its four required parts, where the file lives, when the fourth `HttpStatus` argument applies, and why the serialisable `code` and `metadata` are what let an error cross a process boundary |
| [`contracts/async-and-messaging.md`](contracts/async-and-messaging.md) | background work: BullMQ queue names from `bullData`, the enqueue shape (tracked row first, unawaited `add`, failure fallback), SuperJSON payloads, `WorkerHost` with a rethrow so retries fire, the step `Map` pipeline, events through `EventEmitterService`, `@Cron` and `@Interval` that log and swallow, the Redis `SET NX` coalescer, and promise discipline |

## `conventions/` — how the text of a file is spelled

| File | Decides |
|---|---|
| [`conventions/comments.md`](conventions/comments.md) | when a comment is worth writing — WHY and never WHAT, no commented-out code, JSDoc on constants and fields carrying an implicit meaning, the `TODO(tag)` shape, and the rule that a changed line with a stale comment above it is an unfinished diff |
| [`conventions/imports-and-format.md`](conventions/imports-and-format.md) | what eslint enforces inside `src/**`: four-space indent, double quotes, no semicolons, a named import always broken across lines, `import type`, the `@modules/*` and `@features/*` barrel aliases instead of a relative climb, alias-and-external-first import order, and the `export *` barrel |
| [`conventions/type-safety.md`](conventions/type-safety.md) | what may not be typed loosely although the machine allows it — no new `any`, `unknown` narrowed step by step, enums with per-member JSDoc, explicit return types living in `types/`, `??` and `?.` over a loose `!`, `satisfies` and type guards over `as`, and `as unknown as` banned outside specs |
| [`conventions/config-and-env.md`](conventions/config-and-env.md) | that `process.env` is touched only in `parse-env.ts` (with three named boundary exceptions), that consumers read `envConfig().x.y` through the `@modules/env` barrel, that every leaf is one `parseEnv*` call with a default, that shaping happens at the leaf, and that a secret is a mounted file rather than an env var |

## Reading order

Open the one file the task touches. These are not a curriculum, and a rule read out of context is a
rule applied where it does not belong. A new feature typically crosses all four shelves —
`concepts/` for what it is being built out of, `modules/` for the folder it lives in, `contracts/`
for the surface it exposes, `conventions/` for how the resulting lines are typed — so reach for the
shelf, not the whole set.
