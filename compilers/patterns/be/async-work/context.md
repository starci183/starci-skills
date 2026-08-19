# Async-work

## LOADS

None.

## Record

This runtime context binds an accepted decision to the files that carry durable asynchronous work.
It does not decide whether a feature is asynchronous. It binds the job envelope, delivery state,
retry budget and scheduler lease.

## Law

A job is replayable, versioned data with a stable identity. Completion is acknowledged only after the
durable business consequence. Retry is finite and delayed. Scheduled work is claimed by an expiring
lease so a repeated tick cannot overlap the same job. Queue mechanics, domain consequence, event
delivery, CQRS, observability and assurance remain separate owners.

## Situation codes

| Code | Situation | Binding source shape |
|---|---|---|
| `ASYNC-1` | A later worker receives producer-owned work | Plain serializable envelope with stable `jobId`, `jobType`, `schemaVersion`, payload and correlation/causation metadata |
| `ASYNC-2` | A job succeeds or fails delivery | Commit consequence, then ack/complete; record retryable or terminal dead-letter state durably |
| `ASYNC-3` | A transient job failure is retried | Durable attempt increment, finite maximum, bounded backoff/jitter and terminal classification |
| `ASYNC-4` | A due scheduled job is selected | Atomic due-time claim with lease owner and expiry; reclaim expired leases; never hold the claim transaction over execution |

## Reading an accepted shape

Resolve identity and version before delivery, delivery ordering before retry, and claim ordering before
the worker body. Emit every matching code. A versioned job can still ack early; a leased job can still
retry forever. Those are separate defects.

## `ASYNC-1` — the job is a versioned, serializable contract

Use a plain-data envelope with stable identity and schema version; never serialize a live runtime object.

## `ASYNC-2` — delivery state is acknowledged after the consequence

Commit the durable consequence before ack, and record retryable or terminal delivery state.

## `ASYNC-3` — attempts and backoff are bounded

Count attempts durably, allowlist transient failures, and stop at a finite maximum and bounded delay.

## `ASYNC-4` — due work is leased without overlap

Atomically claim due work with an owner and expiry; do not hold the claim transaction over execution.

## Boundaries

- `EVENT-DELIVERY` distributes an already-decided fact; async-work executes durable intent. A job may
  use an event transport but is not made safe by event deduplication alone.
- `CQRS` owns command/query/event feature placement and semantics; async-work owns delayed execution
  and delivery state.
- `OBSERVABILITY` names and transports telemetry; it cannot be the ack, retry or lease store.
- `DELIVERY-ASSURANCE` proves the repository and runtime fence; it does not replace duplicate,
  restart, exhaustion or overlapping-tick evidence.
- `RESILIENCE` governs calls made by a worker. `ASYNC-3` governs attempts of the job itself; combine
  budgets under one deadline rather than multiplying them invisibly.

## Layer held

Job modules hold envelope and worker policy; infrastructure adapters hold queue, clock, claim and
lease mechanics; domain services hold consequences. All four codes are documented unless a named
backend machine proves a narrower rule.

## Inputs

| Input | Evidence |
|---|---|
| identity/payload | Stable id, type, version, decoder and serializable fields |
| delivery/retry | Ack order, terminal state, error classes, maximum and delay ceiling |
| schedule | Due-time, claim transaction, lease owner and expiry |
| proof | Duplicate, restart, exhausted retry and competing scheduler cases |

## Rules

1. Keep job data plain, versioned and identifiable.
2. Ack after durable consequence.
3. Bound attempts and delay.
4. Lease due work and keep claim separate from execution.
5. Attach telemetry and tests to job identity without making them state.

## Exceptions

Best-effort loss is allowed only when explicitly accepted and recorded. Lease renewal must have a hard
expiry. Manual replay creates a new attempt record and never edits history.

## Output

```text
job: <type/id>
worker: <file/module>
situation: <ASYNC-1 | ASYNC-2 | ASYNC-3 | ASYNC-4>
reason: <durability, delivery, retry or scheduling fact>
```
