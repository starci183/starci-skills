---
title: Observability
runtime: true
source: en.md
sourceHash: 99f1c798a03c845d9d0c3e1fc7838434ec68d27d75ae1e4345fc966784c154cb
contextVersion: 1
---

# Observability

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is a shape already accepted: a handler, worker, cron, decision branch, `catch` block, standalone entry point, signal path or telemetry process that somebody has agreed should exist. This module does not re-open that decision. Its output is source architecture — which service the line leaves through, which closed set the name comes from, which typed object rides beside it, which layer owns the transport and the correlation id, and which file the sanctioned exit is declared in.

## Law

A log is a **structured event with a stable name**, not a sentence. It leaves through one service, its first argument is an enum member, and everything variable rides beside that name as data.

The reason is what happens after the log leaves the process. A line reading `handling order 4f2a for user 91` is legible to a person and opaque to everything else: it cannot be counted, grouped, alerted on, or filtered by user without a regular expression that breaks the first time somebody rewords the sentence. The same event as `ORDER_HANDLED` plus `{ orderId, userId }` can be counted the moment it exists.

The question that settles it: **would you want to know how many times this happened?** If yes — and for anything worth logging the answer is yes — it needs a name that survives being reworded.

**This is binding, not advisory.** Every line that leaves the process carries a situation code below, and so does every telemetry process that would carry those lines. There is no size at which a service is too small to have one: a three-line cron logs through the house service for the same reason an HTTP handler does. "It is only a debug line" is not an exemption — it is the most common place the rule gets skipped.

## Situation codes

Every situation this module governs carries a code, `OBSERVABILITY-<n>`. The code names the SITUATION; the columns state what the situation requires and what it refuses. Codes `1`–`6` govern a single log line. Codes `7`–`8` govern the pipeline that line travels through, because a perfect event name is worth nothing if it arrives nowhere, and a telemetry stack nobody owns is a second outage waiting for the first one.

| Code | Situation | What the source must look like |
|---|---|---|
| `OBSERVABILITY-1` | Something that just happened must be recorded, inside a process serving a request or a job | Logs leave through the house logging service, injected. Never: the framework's own `Logger`, a locally constructed logger, `console.*` |
| `OBSERVABILITY-2` | The thing that just happened is being named | The first argument is a member of the closed log-name enum. Never: a template literal, a concatenation, or a bare string as the event name |
| `OBSERVABILITY-3` | There are ids, counts, durations or an outcome to record alongside | Ids, counts, durations and outcome travel as a typed object beside the name. Never: folding the variable part into the name, or dropping it entirely |
| `OBSERVABILITY-4` | Choosing where inside a function the line goes | The event records a DECISION and the evidence it was made on. Never: "Entered method X", "leaving handler", arrival and exit tracing |
| `OBSERVABILITY-5` | The line sits inside a `catch` | A failure logs its exception's code and metadata. Never: logging a rendered or stringified exception message as the grouping key |
| `OBSERVABILITY-6` | A program runs outside the request lifecycle (CLI, agent, script) | A standalone program may use a plain logger, declared once by path. Never: taking the exit per line, or claiming it for anything a request reaches |
| `OBSERVABILITY-7` | A signal path is being built or widened | Phase 1 Minimal ships the smallest complete signal path; Phase 2 Full needs measured evidence. Never: treating Full as work Minimal owes, or as justified by tool availability |
| `OBSERVABILITY-8` | A collector, exporter, store or dashboard is about to join the runtime | A new local telemetry process declares its full lifecycle before it runs. Never: adding a collector, exporter, store or dashboard on the strength of its feature |

`OBSERVABILITY-6` IS AN EXIT, NOT A DEGREE OF STRICTNESS. It does not say the rule is softer for small programs; it says a program with no request to correlate has nothing the house service could attach. The distinction is the request, not the size. Everything served over HTTP or a queue has one, and everything with one uses the house service.

`OBSERVABILITY-7` and `OBSERVABILITY-8` are not about how a line is written and are still part of this module, because the same failure produces both: something is added to the runtime because it was available, and nobody can say afterwards what signal it carries or who turns it off.

## Reading an accepted shape

1. **Read what the shape states.** It states that a handler, worker, cron, branch, `catch`, entry point, signal path or telemetry process exists and has been agreed to. That is the decision; it is closed.
2. **Name what the shape does not state, and stop resolving there.** An accepted shape almost never states the receiver, the enum member, the typed fields beside the name, the evidence behind a decision, or the owner and removal condition of a process. Whatever it does not state, this module does not silently invent — it is recorded as unresolved until the Inputs table below carries its evidence.
3. **Resolve outermost first.** Decide the pipeline before the line: `OBSERVABILITY-7` (is this Minimal, or a Phase 2 addition with measured evidence?) then `OBSERVABILITY-8` (does a new process join the runtime, and has its full lifecycle been declared?). Only then descend to a single call site.
4. **At the call site, ask each code's question in order.** Is there a request or job for this line to be correlated to — if not, this is the `OBSERVABILITY-6` exit and nothing below applies. If there is: which receiver (`-1`), which enum member (`-2`), which typed object beside it (`-3`), does the line record a decision and its evidence (`-4`), and if it sits in a `catch`, is the grouping key the exception's identity (`-5`)?
5. **When two codes both match, both are emitted.** They are different defects and are not merged. A call on the house service that passes a template literal is `-1` satisfied and `-2` broken. A template literal usually breaks `-2` and `-3` at once: one makes the name ungroupable, the other makes the data unqueryable. A perfect enum member naming "entered the method" satisfies `-2` and still breaks `-4`. `-5` is the narrower and stricter case of `-3`, so a failure line resolves under `-5`, not `-3`.

## `OBSERVABILITY-1` — the log leaves through the house service, and only there

**Situation.** A service, handler, worker or cron needs to record something that just happened, and the process is serving a request or a job.

**What it emits in source.** The house logging service is injected into the class and the call is made on it. Nothing is constructed locally. The correlation id, the transport configuration and the redaction stay inside that one service and are not repeated at the call site.

**Boundary.** Not `OBSERVABILITY-2`: `-1` asks **where it goes out**; `-2` asks **what it is called**. Calling the right service while passing a template literal is still broken, and broken under `-2`. Not `OBSERVABILITY-6`: if that code runs **outside** the request lifecycle there is no request left to attach, and that is the `-6` exit, not a violation of `-1`. This is not a formatting concern — the framework's logger writes the right shape to stdout and still loses the request it belongs to, because the correlation id lives in the service it went around.

## `OBSERVABILITY-2` — the event name is an enum member

**Situation.** The first argument of a log call is being written. That argument **names what happened**, and it must come from a closed set.

**What it emits in source.** A member of the closed log-name enum in the first position. If the event does not exist yet, a new member is added to that enum with its own JSDoc line — the name is created in the set, never at the call site.

**Boundary.** Not `OBSERVABILITY-3`: `-2` forbids pushing data **into** the name; `-3` says data travels **beside** it. One template literal often breaks both at once, but they are two different defects — one makes the name ungroupable, the other makes the data unqueryable. Not `OBSERVABILITY-4`: `-2` does not ask whether the event deserves to be logged. An enum name given to "entered the function" still violates `-4` while satisfying `-2`. A bare hard-coded string is forbidden too, not only an interpolated one: a fixed string is exactly **one** rewording away from being a different event, and nobody treats rewording as a behaviour change.

## `OBSERVABILITY-3` — the variable part travels beside the name

**Situation.** The event already has a name, and there are ids, counts, durations and an outcome still to record with it.

**What it emits in source.** A second argument: a typed object whose interface belongs to that event, so a new field is added in one place and every mis-typed call site goes red at build time instead of staying silent until somebody queries it.

**Boundary.** Not `OBSERVABILITY-2`: see above. Not `OBSERVABILITY-5`: `-3` covers the data of an ordinary event; `-5` covers specifically the data of a **failure**, where the required field is the exception's identity.

## `OBSERVABILITY-4` — log the decision, not the passing through

**Situation.** Choosing where in a function the log line goes. Two places are tempting: the top of the function, and the point where the code has just **chosen** a branch.

**What it emits in source.** A line at the branch, naming what was chosen and carrying the evidence it was chosen on. Nothing at the entry or the exit of the function.

**Boundary.** Not `OBSERVABILITY-3`: a line that records the right decision but omits its evidence is still broken, but broken under `-3` — missing data, not the wrong placement. Not `OBSERVABILITY-2`: `-2` only judges the shape of the name. A perfect enum member for a meaningless event still violates `-4`. Pipeline steps are the blurriest boundary: a "step finished" event earns its existence only when the step is an **outcome** that could have gone otherwise — succeeded, skipped, failed — not when it merely marks how far the cursor got.

## `OBSERVABILITY-5` — a failure records identity, not wording

**Situation.** The log line sits in a `catch`, and it is what alerts will group by.

**What it emits in source.** The exception's `code` and its metadata in the data object, as the grouping key. The human-readable message may exist beside them as a secondary field.

**Boundary.** Not `OBSERVABILITY-3`: `-5` is the narrower and **stricter** case of `-3` — here the required data is the exception's `code` and metadata. Not `OBSERVABILITY-4`: `-5` does not say whether the line deserves to be logged, only that once it is logged the grouping key must be identity. The wording is still allowed to exist, as long as it is not the grouping key: it is a secondary field for a human reader, not the thing a dashboard counts.

## `OBSERVABILITY-6` — a standalone program is the only exit

**Situation.** A CLI, an agent, a script running outside the request lifecycle. There is no request to correlate to and no transport configured for it.

**What it emits in source.** A plain logger in the program's own entry point, and one line in the lint configuration scoping the exit to that program's path. Nothing else changes.

**Boundary.** Not `OBSERVABILITY-1`: the exit turns on **whether a request exists**, not on "this program is small". A queue worker has a job to attach to, so it stays under `-1`. Declared once, by path: the exit is a line in the lint config pointing at those programs' directories, not a rule-disabling comment on each line. Declaring one exception in two places is how one of the two quietly grows without anybody seeing it.

## `OBSERVABILITY-7` — Minimal first, Full on evidence

**Situation.** Building or widening the path a signal travels: logs, metrics, traces, alerts.

**What it emits in source.** The smallest complete path: the named core signals collected, stored or forwarded through an approved backend, health visible, critical alerts firing. Anything past that is a Phase 2 item and is not written now.

**Boundary.** Not `OBSERVABILITY-8`: `-7` asks **whether the signal scope should widen**; `-8` asks **who pays the lifecycle** for the process that would carry it. A legitimate Phase 2 still has to pass `-8`. Phase 2 is not Phase 1's debt: Minimal done is done. Full reopens at a later Review, on a measured SLO or debugging gap, a scale or cardinality limit, a compliance or data-residency constraint, a reliability requirement, or a demonstrated cost.

## `OBSERVABILITY-8` — every telemetry process pays its own lifecycle

**Situation.** An agent, collector, exporter, store or dashboard service is about to become part of the runtime.

**What it emits in source.** Either nothing new — the signal goes through the process or approved backend that already exists — or a declared process whose owner, resources, ports, credentials, persistence, health check, backup and removal condition are all written down before it runs.

**Boundary.** Not `OBSERVABILITY-7`: see above. Not `OBSERVABILITY-1`: `-1` is about where **one line** goes out; `-8` is about **a whole process** being added to the runtime. Managed does not delete the obligation: a managed backend reduces local operation, but PII, cardinality, egress, retention and spend must still be controlled **before** telemetry crosses the boundary. And "cloud-first" does not mean "cloud-only": security, data residency, reliability or cost can each make managed the wrong choice — and then the reason is recorded, not skipped.

## Layer held

Which tier actually holds each code today. `unrepresentable` means a closed union or branded type makes the wrong value impossible to write; `enforced` means a rule in `@canon-be` reports it, named below; `documented` means nothing mechanical holds it and only a reader does.

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

Two of eight are enforced. That is the honest count, and the six `documented` rows are the point of this table: they name exactly where the law survives on reading alone, which is where it will be broken first.

The layer that owns the concern is the platform logging module: the correlation id, the transport configuration and the redaction live there and nowhere else. Every other layer — handlers, workers, crons, domain services — stays ignorant of transports, of correlation and of formatting, and knows only the injected service, the enum member and its typed object.

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

## Rules

1. One service owns logging. The correlation id, the transport configuration and the redaction live there and nowhere else.
2. The event name comes from a closed set and never from the call site.
3. The name says WHAT happened; the data says which one, how many, how long, and how it ended.
4. Adding a field is not a rewording. An event name outlives every field beside it.
5. A failure groups by identity, so improving the English never splits an alert in two.
6. The sanctioned exit is declared once, by path, in the lint configuration.
7. Phase 2 begins from a measurement, never from an integration being convenient.
8. A telemetry process that nobody has agreed to own is not part of the runtime.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Standalone program** (`OBSERVABILITY-6`). A program that runs outside the request lifecycle may use a plain logger. It is declared once, by path, in the lint config — never as a suppression on the line, because per-line exits accumulate until nobody can see how wide the exception has grown.
- **Phase 2 addition** (`OBSERVABILITY-7`). An exact addition beyond Minimal is admitted when a measured SLO or debugging gap, a scale or cardinality limit, a compliance or data-residency constraint, a reliability requirement or a demonstrated cost justifies it. Availability is not such evidence.
- **Managed backend** (`OBSERVABILITY-8`). A managed backend reduces local runtime ownership; it does not remove control of PII, cardinality, egress, retention and spend before telemetry crosses the boundary. Local ownership stays possible when security, residency, reliability or cost require it — recorded as a constraint, not chosen as a default.
- **Error wording** (`OBSERVABILITY-5`). It may live in the data as a secondary field for a human reader. It may not be the thing an alert groups by.

## Output

One block per call site or per process the accepted shape produces.

```text
call site: <file · method>
situation: <OBSERVABILITY-1 … OBSERVABILITY-8>
event: <enum member | n/a>
data: <typed fields beside the name>
tier: <unrepresentable | enforced | documented>
reason: <business fact that excludes the adjacent code>
```
