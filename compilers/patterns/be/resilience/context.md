# Resilience

## LOADS

None.

## Record

Bind accepted calls to explicit deadlines, bounded transient retries, capacity protection, truthful
fallback and cancellation propagation. Keep the feature contract authoritative.

## Law

One total deadline governs nested work. Retry is finite and allowlisted. Breakers, bulkheads or load
shedding protect shared capacity. Fallback preserves result shape, freshness and authorization.
Cancellation reaches children and prevents late mutation.

## Situation codes

| Code | Situation | Binding source shape |
|---|---|---|
| `RESILIENCE-1` | Potentially blocking dependency call | Remaining operation deadline/timeout, typed timeout outcome |
| `RESILIENCE-2` | Retryable transient failure | Allowlisted transient class, finite attempts, bounded backoff/jitter under total deadline |
| `RESILIENCE-3` | Failure or saturation threatens capacity | Named breaker/bulkhead/load-shed with finite limits and typed reject/open outcome |
| `RESILIENCE-4` | Primary dependency result unavailable | Explicit contract-preserving fallback or typed unavailable; preserve freshness/authorization |
| `RESILIENCE-5` | Caller/job cancellation or deadline | Propagated signal through clients, timers, streams and child tasks; no late mutation |

## Reading an accepted shape

Set the total budget first, then retry and capacity controls, then fallback and cancellation. Emit every
matching code. Inner retries cannot extend the outer deadline.

## `RESILIENCE-1` — deadline and timeout are explicit

Pass the remaining operation deadline to every potentially blocking call and classify timeout distinctly.

## `RESILIENCE-2` — transient retry is bounded

Retry only allowlisted transient safe work with finite attempts and bounded backoff under the total deadline.

## `RESILIENCE-3` — breaker, bulkhead and load shedding protect capacity

Use named finite capacity protection and a typed open/reject result at the shared dependency boundary.

## `RESILIENCE-4` — fallback preserves the contract

Return only an explicit, truthful fallback that preserves result shape, freshness and authorization.

## `RESILIENCE-5` — cancellation and deadlines propagate

Propagate cancellation through clients, timers, streams and children, preventing late mutation.

## Boundaries

- `EVENT-DELIVERY` distributes facts; resilience limits provider calls and does not deduplicate events.
- `CQRS` owns command/query semantics; fallback cannot change an operation's semantic kind.
- `OBSERVABILITY` records decisions and outcomes; it is not the control mechanism.
- `DELIVERY-ASSURANCE` proves gates and runtime evidence; health checks do not prove overload behavior.
- `ASYNC-WORK` bounds job delivery attempts; resilience bounds calls made inside a job.
- `INTEGRATION` translates provider failures; resilience classifies and contains their operational effect.

## Layer held

Application owns operation budget and legal fallback. Shared policies own retry/circuit/bulkhead/signal
mechanics. Adapters own provider translation. All five codes are documented unless a named machine
enforces a narrow syntactic part.

## Inputs

| Input | Evidence |
|---|---|
| dependency/budget | Failure classes, idempotency, deadline and cancellation |
| capacity | Limits, thresholds and reject/open result |
| contract | Legal fallback, freshness, authorization and result shape |
| proof | Delay, transient, overload, fallback and cancellation cases |

## Rules

1. Bound the complete operation with one deadline.
2. Retry only transient safe work within that budget.
3. Protect shared capacity with finite controls.
4. Return only truthful contract-preserving fallback.
5. Propagate cancellation and block late mutation.

## Exceptions

Idempotency keys may make non-idempotent retry safe. Detached work must be a durable job with its own
deadline. Authoritative operations may fail fast with typed unavailable.

## Output

```text
operation: <operation>
dependency: <dependency>
situation: <RESILIENCE-1 | RESILIENCE-2 | RESILIENCE-3 | RESILIENCE-4 | RESILIENCE-5>
reason: <budget, failure, capacity, contract or cancellation fact>
```
