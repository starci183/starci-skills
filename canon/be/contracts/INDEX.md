# `contracts/` — what the code promises to callers and to other processes

Four files, ordered from the request inward. [`api-surface.md`](api-surface.md) gives the shape of
the boundary itself: one operation per folder, the resolver's complete decorator stack, the
`request.ts` and `response.ts` pair under `graphql-types/`, the rarer REST controller with its
`httpConfig()` paths and Swagger DTOs, and the imports that must never run backwards from
`bussiness` into `features/api`. [`validation.md`](validation.md) covers what happens to the payload
on arrival — the globally registered `ValidationPipe`, decorator order at each field, bounds kept as
named constants mirroring their column, optional fields that still validate their format, nested
objects and arrays with a size ceiling, cross-field invariants pushed into the handler, and the
deliberate all-optional shape reserved for external webhooks. [`exceptions.md`](exceptions.md) is the
iron rule for the way out: every failure is a class extending `AbstractException`, never a bare
`Error` and never a framework built-in, with its four required parts and the one case that sets an
`HttpStatus`. [`async-and-messaging.md`](async-and-messaging.md) leaves the request entirely — BullMQ
queues and workers, SuperJSON payloads, multi-step pipelines, events through `EventEmitterService`,
`@Cron` and `@Interval` schedules, the Redis coalescing lock, and promise discipline in background
code.
