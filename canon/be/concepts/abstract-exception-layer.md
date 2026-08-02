# Concept — Abstract exception layer

Source: `src/modules/exceptions/errors/<domain>/`.

Every value thrown under `src/` and `apps/` extends `AbstractException` and carries a stable `code`
plus structured `metadata`. That is the whole point of the layer: Sentry and the logs can group by
`code`, and a caller can `instanceof`-match one specific failure instead of reading a message string.

## Two things are banned

`throw new Error("...")`, and the framework built-ins — `BadRequestException`, `ForbiddenException`,
`NotFoundException`, `UnauthorizedException`, `ConflictException`, `HttpException` and the rest.
Neither carries a stable `code`, so neither groups in the log or in Sentry, and the GraphQL transform
interceptor has nothing to map onto cleanly.

## One error situation, one exception class

Write `ActivitySelfReactionException`, not a generic `ForbiddenException`. Adding one takes three
parts: an `interface XMetadata extends AbstractExceptionMetadata`, a `class extends
AbstractException` that passes a stable `code` into `super()`, and the export line in
`errors/<domain>/index.ts`.

Domains are one folder deep under `src/modules/exceptions/errors/` — 47 of them, re-counted
2026-08-03: `ai/ ai-lab/ api/ backup/ bento4/ cache/ cli/ coding/ community/ courses/ crypto/ cv/
daily-quest/ discussion/ elasticsearch/ execa/ flashcard/ github/ guards/ init/ job/ job-postings/
kafka/ keycloak/ kpi-reward/ league/ membership/ mixin/ notification/ pagination/ payment/
personal-project/ profile/ rag-playground/ rewards/ s3/ scylladb/ session/ socketio/ stdlib/ streak/
stream/ submission-review/ transaction/ users/ video-encoder/ vouchers/ weekly-challenge/`.

## The one legitimate raw `Error`

A normalise helper — the one that turns an `unknown` caught value into an `Error` — may construct
one. Normalise **once**, at the catch site. Repeating the same guard in every consumer downstream is
the failure mode this exception exists to avoid.

## Known debt

Several older handlers still throw framework built-ins: purchase-ai, course-enroll,
sandbox-repo-url, github-oauth, keycloak-auth, nowpayments. New code does not follow them; migrate
one when you are already editing it, not as a sweep.

How these reach the client is [`envelope-response-shape.md`](envelope-response-shape.md); how they
reach the log is [`observability-sentry-winston.md`](observability-sentry-winston.md).
