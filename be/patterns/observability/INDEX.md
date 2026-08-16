---
id: be-patterns-observability-index
title: INDEX.md
slug: /be/patterns/observability
sidebar_label: observability
sidebar_position: 0
description: Binding rules for emitting a log as a named, structured, correlated event on the back end.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `observability`

## Law

A log is a **structured event with a stable name**, not a sentence. It leaves through one service,
its first argument is an enum member, and everything variable rides beside that name as data.

The reason is what happens after the log leaves the process. A line reading
`handling order 4f2a for user 91` is legible to a person and opaque to everything else: it cannot be
counted, grouped, alerted on, or filtered by user without a regular expression that breaks the first
time somebody rewords the sentence. The same event as `ORDER_HANDLED` plus `{ orderId, userId }` can
be counted the moment it exists.

The question that settles it: **would you want to know how many times this happened?** If yes — and
for anything worth logging the answer is yes — it needs a name that survives being reworded.

**This is binding, not advisory.** Every line that leaves the process carries a situation code below,
and so does every telemetry process that would carry those lines. There is no size at which a service
is too small to have one: a three-line cron logs through the house service for the same reason an
HTTP handler does. "It is only a debug line" is not an exemption — it is the most common place the
rule gets skipped.

## Situation Codes

Every situation this module governs carries a code, `OBSERVABILITY-<n>`. The code names the
SITUATION; the columns state what the situation requires and what it refuses. Codes `1`–`6` govern a
single log line. Codes `7`–`8` govern the pipeline that line travels through, because a perfect event
name is worth nothing if it arrives nowhere, and a telemetry stack nobody owns is a second outage
waiting for the first one.

| Code | Requires | Forbids |
|---|---|---|
| `OBSERVABILITY-1` | Logs leave through the house logging service, injected | The framework's own `Logger`, a locally constructed logger, `console.*` |
| `OBSERVABILITY-2` | The first argument is a member of the closed log-name enum | A template literal, a concatenation, or a bare string as the event name |
| `OBSERVABILITY-3` | Ids, counts, durations and outcome travel as a typed object beside the name | Folding the variable part into the name, or dropping it entirely |
| `OBSERVABILITY-4` | The event records a DECISION and the evidence it was made on | "Entered method X", "leaving handler", arrival and exit tracing |
| `OBSERVABILITY-5` | A failure logs its exception's code and metadata | Logging a rendered or stringified exception message as the grouping key |
| `OBSERVABILITY-6` | A standalone program may use a plain logger, declared once by path | Taking the exit per line, or claiming it for anything a request reaches |
| `OBSERVABILITY-7` | Phase 1 Minimal ships the smallest complete signal path; Phase 2 Full needs measured evidence | Treating Full as work Minimal owes, or as justified by tool availability |
| `OBSERVABILITY-8` | A new local telemetry process declares its full lifecycle before it runs | Adding a collector, exporter, store or dashboard on the strength of its feature |

`OBSERVABILITY-6` IS AN EXIT, NOT A DEGREE OF STRICTNESS. It does not say the rule is softer for
small programs; it says a program with no request to correlate has nothing the house service could
attach. The distinction is the request, not the size. Everything served over HTTP or a queue has one,
and everything with one uses the house service.

`OBSERVABILITY-7` and `OBSERVABILITY-8` are not about how a line is written and are still part of
this module, because the same failure produces both: something is added to the runtime because it was
available, and nobody can say afterwards what signal it carries or who turns it off.

## Tầng giữ

Which tier actually holds each code today. `unrepresentable` means a closed union or branded type
makes the wrong value impossible to write; `enforced` means a rule in
[`sources/be/observability.mjs`](../../../sources/be/observability.mjs) reports it, named below;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `OBSERVABILITY-1` | `enforced` | `<plugin>/no-framework-logger` reports the `Logger` import and `new Logger(...)`; `no-console` (the standard rule, carried in `recommended`) closes the third exit |
| `OBSERVABILITY-2` | `enforced` | `<plugin>/no-interpolated-log-message` reports a template literal, a `+` concatenation or a bare string in the first argument. At the anchor the service signature narrows the same argument to `TName extends WinstonLog`, so the type layer refuses it too |
| `OBSERVABILITY-3` | `documented` | Nothing checks that a data object was passed, or that a field was added instead of the name being reworded. The typed `messageType` at the anchor shapes the object once one is passed; it cannot require one |
| `OBSERVABILITY-4` | `documented` | Whether a line records a decision or an arrival needs to know what the code is FOR. No parser knows that |
| `OBSERVABILITY-5` | `documented` | A parser sees a string-valued field. It cannot tell `error.code` from `error.message` once either has been assigned to a field named `error` |
| `OBSERVABILITY-6` | `documented` | The exit is config, not code: `standaloneProgramGlobs` is exported so one list scopes the rule. Nothing reports the exit being taken per line instead |
| `OBSERVABILITY-7` | `documented` | Phase boundaries live in a Review record, not in source. No rule can read a deferral |
| `OBSERVABILITY-8` | `documented` | The lifecycle fields are a brief, and the process being added is usually not TypeScript at all |

Two of eight are enforced. That is the honest count, and the six `documented` rows are the point of
this table: they name exactly where the law survives on reading alone, which is where it will be
broken first.

## Anchor

Real code each code can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `OBSERVABILITY-1` | `src/modules/platform/winston/winston.service.ts` | One `@Injectable()` class holding the three transports; call sites inject it and construct nothing. `eslint.config.mjs` turns `no-console` on for `src/**` and `apps/**` |
| `OBSERVABILITY-2` | `src/modules/platform/winston/enums/winston-log.ts` and the `log<TName extends WinstonLog>(name: TName, …)` signature in `winston.service.ts` | A closed enum of ~128 members, each with a JSDoc line; the signature that only accepts a member of it |
| `OBSERVABILITY-3` | `src/modules/platform/winston/types/messages/*.ts` with `configMap` in `src/modules/platform/winston/config.ts` | Every event maps to a named interface (`jobId`, `queueName`, `durationMs`, `success`) reached as `(typeof configMap)[TName]["messageType"]` |
| `OBSERVABILITY-4` | `src/modules/platform/winston/enums/winston-log.ts` | Members whose JSDoc states a decision — `EnrollmentAlreadyExists` "skipped create to stay idempotent", `CdnSynchronizerCourseAlreadySynced` "hash matched, upload skipped". Also look at the `*StepExecuted` family beside them, which records arrival; see Findings in `audit.md` |
| `OBSERVABILITY-5` | `src/features/api/processors/ai/generate-cv/generate-cv.worker.ts` (the `JobExecutedFailed` call in the `catch`) and `JobExecutedMessage.error?: string` in `types/messages/worker.ts` | The field is filled with `error.message`. This anchor shows the law being missed, which is what an anchor is for |
| `OBSERVABILITY-6` | `apps/cli/src/main.ts` and `apps/playground-*-agent/src/main.ts` (the `new Logger()` bootstrap) against `standaloneProgramGlobs` in `sources/be/observability.mjs` | Four standalone entry points, and the per-line `eslint-disable` comments they currently carry instead of one scoped glob |
| `OBSERVABILITY-7` | `src/modules/platform/winston/winston.providers.ts` with the per-event `loki` flag in `config.ts` | Three providers — console only, forwarding backend only, both — and one flag per event deciding which lines cross. That IS the Minimal path: no collector, no tracer, no metrics pipeline beside it |
| `OBSERVABILITY-8` | `src/modules/platform/env/config.ts` under `loki` | Host, auth toggle and credentials declared as typed config for a managed backend. The lifecycle fields the code demands — owner, port, persistence, health, backup, removal condition — have no anchor, because no local telemetry process exists to carry them: `chưa neo được` for that half |

## Inputs

| Input | Evidence required |
|---|---|
| receiver | What the call is made on: the injected house service, or something else |
| event | The enum member naming what happened, and whether it already exists |
| data | The typed fields beside the name: ids, counts, durations, outcome |
| decision | What the code chose, and the evidence it chose on |
| failure identity | The exception's code and metadata, where the line is in a `catch` |
| lifecycle | Whether a request or job exists for the line to be correlated to |
| phase | Whether the change is Phase 1 Minimal, or a Phase 2 addition with measured evidence |
| process budget | For any new telemetry process: owner, resources, ports, credentials, persistence, health, backup, removal condition |

## Invariants

- One service owns logging. The correlation id, the transport configuration and the redaction live
  there and nowhere else.
- The event name comes from a closed set and never from the call site.
- The name says WHAT happened; the data says which one, how many, how long, and how it ended.
- Adding a field is not a rewording. An event name outlives every field beside it.
- A failure groups by identity, so improving the English never splits an alert in two.
- The sanctioned exit is declared once, by path, in the lint configuration.
- Phase 2 begins from a measurement, never from an integration being convenient.
- A telemetry process that nobody has agreed to own is not part of the runtime.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Standalone program** (`OBSERVABILITY-6`). A program that runs outside the request lifecycle may
  use a plain logger. It is declared once, by path, in the lint config — never as a suppression on
  the line, because per-line exits accumulate until nobody can see how wide the exception has grown.
- **Phase 2 addition** (`OBSERVABILITY-7`). An exact addition beyond Minimal is admitted when a
  measured SLO or debugging gap, a scale or cardinality limit, a compliance or data-residency
  constraint, a reliability requirement or a demonstrated cost justifies it. Availability is not such
  evidence.
- **Managed backend** (`OBSERVABILITY-8`). A managed backend reduces local runtime ownership; it does
  not remove control of PII, cardinality, egress, retention and spend before telemetry crosses the
  boundary. Local ownership stays possible when security, residency, reliability or cost require it —
  recorded as a constraint, not chosen as a default.

## Output

```text
call site: <file · method>
situation: <OBSERVABILITY-1 … OBSERVABILITY-8>
event: <enum member | n/a>
data: <typed fields beside the name>
tier: <unrepresentable | enforced | documented>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any back end that logs. It names no product, no repository and no
private module. Every example is ordinary TypeScript in an ordinary NestJS shape; the anchors are
paths, and a repository that stores its house service elsewhere reads them as a description of what
to look for, not as an import path.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
