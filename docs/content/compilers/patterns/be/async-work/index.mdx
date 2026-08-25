---
title: Async-work
---

# Async-work

## LOADS

None.

## Record

This pattern receives an accepted decision that work may continue outside the request or event that
started it. It returns the source architecture for the job contract, queue boundary, scheduler and
worker test. It does not decide whether work should be asynchronous; that decision is already closed.

## Law

Asynchronous work is a durable contract between a producer and a later worker. A job has a stable
identity, a versioned payload, explicit delivery state and a bounded execution policy. A worker may
run a job more than once, may be restarted, and may meet a scheduler race; the job must still have one
auditable outcome. A queue is delivery infrastructure, not business policy.

The deciding question is: can a different worker, after a restart and a duplicate delivery, identify
the same intent, safely decide whether it is due, and finish without an unbounded retry loop?

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `ASYNC-1` | A producer hands work to a later process | A serializable, versioned job envelope with stable `jobId`, `jobType`, `schemaVersion`, payload and correlation/causation ids. No live class instance, request object, closure or implicit schema |
| `ASYNC-2` | A worker receives, succeeds or cannot finish a job | An explicit ack only after the business consequence commits; retry and terminal dead-letter transitions are durable and observable. No ack-before-work or silent discard |
| `ASYNC-3` | A transient failure can be retried | Attempts are counted durably, with a finite maximum and bounded backoff/jitter. Permanent failures bypass retry. No infinite loop or immediate hot spin |
| `ASYNC-4` | A scheduled job becomes due | A due-time query and lease/claim with owner and expiry prevent overlapping execution. Scheduler ticks are safe to repeat and do not hold a transaction over the job body |

## Reading an accepted shape

1. Identify the already-decided business work and its producer, worker and expected outcome.
2. Do not invent transport, payload fields or retry numbers that the shape does not establish; these
   are the pattern's architecture inputs.
3. Resolve the durable job identity and version before choosing delivery or retry mechanics. Resolve
   ack/lease ordering before the worker body, because a business call cannot repair a lost claim.
4. Ask: can the payload be reconstructed from bytes (`-1`); is success acknowledged only after the
   consequence is durable (`-2`); can attempts and delay end (`-3`); can two scheduler ticks claim the
   same due row (`-4`)?
5. Multiple codes are additive. A versioned envelope still breaks `-2` if it is acked early; a lease
   still breaks `-3` if every error retries forever.

## `ASYNC-1` — the job is a versioned, serializable contract

The producer writes plain data that a later process can decode without importing the producer's
runtime object graph. `schemaVersion` selects an explicit decoder or migration path; `jobId` remains
stable across redelivery. Correlation and causation are metadata, not a substitute for identity.

Boundary: not `CQRS`: a job may carry the command's consequence to a later worker, but this code does
not decide command/query ownership. Not `EVENT-DELIVERY`: a job is work to execute, while an event is
a decided fact to distribute. The job may use event delivery, but it still needs this envelope.

## `ASYNC-2` — delivery state is acknowledged after the consequence

The worker claims or receives a job, runs the business operation, commits its durable result, then
acks or marks complete. A retryable failure returns the job to the queue with its attempt recorded;
an exhausted or permanent failure enters a dead-letter state with the reason and original identity.

Boundary: not `OBSERVABILITY`: logs and metrics explain ack/retry decisions but never represent the
durable state transition. Not `ASSURANCE`: a test proving one ack path does not replace operational
ownership of queue retention, replay and dead-letter inspection.

## `ASYNC-3` — attempts and backoff are bounded

The retry policy classifies errors, increments an attempt atomically, applies a finite maximum and
computes bounded delay with jitter. Permanent errors and invalid payloads are terminal. The worker
does not sleep in a hot loop or requeue without changing state.

Boundary: not `RESILIENCE-2`: resilience governs transient calls inside a job; this code governs the
job's own delivery attempts. Both may apply, and their budgets must not multiply without an explicit
overall deadline. Not `ASYNC-2`: `-2` says where the state transition happens; `-3` says how many
times it may happen.

## `ASYNC-4` — due work is leased without overlap

A scheduler selects rows whose `dueAt` is reached, atomically claims them with a lease owner and
expiry, and enqueues or executes only the claimed rows. An expired lease is reclaimable. The scheduler
does not keep a database transaction open while the job body runs, and a repeated tick is harmless.

Boundary: not `EVENT-DELIVERY`: a scheduler creates or releases work; it does not publish a business
fact. Not `DATA-ACCESS`: the repository owns the claim transaction, while this pattern defines the
lease invariant. Not `OBSERVABILITY`: a claim metric cannot prevent overlap.

## Layer held

The application/job module owns the job type, decoder and worker policy. Queue and scheduler adapters
own broker/clock/database mechanics. The domain service owns the business consequence. Event delivery,
CQRS, observability and delivery assurance remain separate boundaries: async work can call each, but
none is allowed to become an implicit job state machine.

All four situations are documented unless a repository's published backend machine provides a named
rule. A lint rule can check envelope presence or forbidden request imports; it cannot prove commit-before
ack, retry classification or non-overlap without runtime evidence.

## Inputs

| Input | Evidence required |
|---|---|
| job identity | Stable type, id and schema version |
| payload | Serializable fields and decoder/migration owner |
| delivery | Queue/worker ack semantics and terminal state |
| retry | Error classes, maximum attempts and delay ceiling |
| schedule | Due-time source, lease owner, expiry and clock |
| proof | Restart, duplicate, exhaustion and overlapping-tick cases |

## Rules

1. A job is plain, versioned data with a stable identity.
2. Acknowledge only after the durable business consequence.
3. Every retry has a counted attempt, finite ceiling and bounded delay.
4. Permanent or malformed work goes to a durable terminal state.
5. Due work is claimed with an expiring lease; repeated ticks do not overlap execution.
6. Correlation, logs and tests attach to the job id but do not replace its state.

## Exceptions

- **At-most-once work.** A deliberately lossy best-effort job may ack before execution only when the
  accepted contract explicitly permits loss; it still records the drop and is not presented as a
  durable job (`ASYNC-2`).
- **Long work.** A long-running job may renew a lease, but renewal has an owner, interval and hard
  expiry; it is not an unbounded lease (`ASYNC-4`).
- **Manual replay.** An operator may replay a dead-letter job by creating a new attempt record that
  points to the original `jobId`; editing history or resetting the counter is forbidden (`ASYNC-2,-3`).

## Output

```text
job: <job type and stable id>
producer: <source file/module>
worker: <worker file/module>
delivery: <ack, retry and terminal state>
schedule: <due-time and lease, or n/a>
situation: <ASYNC-1 | ASYNC-2 | ASYNC-3 | ASYNC-4>
reason: <fact that selects the code and excludes its boundary>
```
