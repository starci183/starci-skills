# Observability — Sentry and Winston/Loki

Source: `src/modules/winston/` (logging), `src/modules/sentry/` (`@sentry/nestjs`, error tracking),
`src/modules/logger/` (the Nest logger facade), `src/modules/mixin/` (cross-cutting helpers:
correlation id, request context).

## Winston to Loki

`WinstonModule.register({ serviceName, level })`, transported by `winston-loki`. The `ServiceName`
enum (`@modules/common`) is the tag log queries filter on in Loki — `Api`, `Worker`, and so on.

## The double-registration gotcha

`apps/core/src/app.module.ts` calls `WinstonModule.register(...)` **twice** — first at `Info`, then
again at `Verbose` with `isGlobal`. The second call overwrites the first. When debugging logger
behaviour, the last line is the one in effect. Do not copy this shape when adding another module;
it is a wart, not a pattern.

## Structured errors, not free-form strings

An exception thrown through the [abstract exception layer](abstract-exception-layer.md) already
carries a stable `code` and `metadata`. That is what lets Sentry group the issue correctly and lets
Winston log something structured instead of an ad-hoc string.

Wrap error logging so the stack survives: catch as `unknown`, normalise to an `Error`, then
`logger.error(msg, stack)`. A message logged without its stack is an alert nobody can act on.

## Correlation

The request context from `mixin/` is attached to every log line within a request, so one request can
be traced across several service calls.
