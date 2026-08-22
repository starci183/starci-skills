# Resilience

## LOADS

None.

## Record

This pattern governs an accepted call or operation whose failure, latency or concurrency could damage
the service. It places time budgets, transient retry, isolation and fallback around a dependency while
keeping the feature contract honest.

## Law

Resilience is a budget, not optimism. Every external or potentially blocking call has a deadline that
can be propagated, a finite transient retry policy, a concurrency boundary and a contract-preserving
outcome when the dependency cannot answer. Cancellation is part of correctness: work that no longer
has a caller or deadline must stop where the dependency permits.

The deciding question is: under delay, failure, overload and cancellation, does the system stop
spending unbounded resources and still return only a result the feature contract permits?

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `RESILIENCE-1` | A call can wait on another process/resource | An explicit deadline/timeout derived from the operation budget, with timeout classified distinctly from provider failure |
| `RESILIENCE-2` | A transient failure may succeed later | Finite retry for an allowlisted transient class, bounded backoff/jitter, and one overall deadline; no retry of validation/auth/permanent errors |
| `RESILIENCE-3` | A dependency is failing or saturated | A named circuit breaker, bulkhead or load-shed boundary with bounded queue/concurrency and an explicit open/reject outcome |
| `RESILIENCE-4` | A dependency cannot provide the primary result | A fallback that preserves the feature's declared contract, freshness and authorization semantics; no fabricated success or silent stale data |
| `RESILIENCE-5` | Caller, request or job deadline ends | Cancellation/deadline signal is propagated through nested calls, timers and streams; late work cannot mutate the abandoned operation |

## Reading an accepted shape

1. Identify the dependency and feature contract, including whether stale/empty/degraded output is legal.
2. Set one total deadline before selecting retry or concurrency controls; inner controls cannot extend it.
3. Select retry only for transient, idempotent work; select breaker/bulkhead/load shedding at the
   shared dependency boundary.
4. Resolve fallback and cancellation after the contract is known. Ask: where does time end (`-1`);
   which errors may repeat (`-2`); how is overload refused (`-3`); what truthful result remains (`-4`);
   how does abort reach every child (`-5`)?
5. Codes compose. A breaker without a deadline still leaks work; a fallback without cancellation can
   finish after the caller has gone.

## `RESILIENCE-1` — deadline and timeout are explicit

The caller supplies or the operation creates one deadline. Every provider/client call receives the
remaining budget, not a fresh timeout that can exceed it. Timeout is a typed outcome distinguishable
from provider rejection, validation failure and cancellation.

Boundary: not `CONFIGURATION`: config may provide a default ceiling, but the operation owns the live
deadline. Not `ASYNC-3`: a job attempt may retry, while each nested call still consumes the same budget.

## `RESILIENCE-2` — transient retry is bounded

Only allowlisted transient failures on safe/idempotent operations retry. Attempts, delay and jitter are
bounded by the total deadline; auth, validation, cancellation and permanent business errors do not
retry. A retry policy is not a second queue.

Boundary: not `ASYNC-3`: this is the dependency call inside an operation; `ASYNC-3` is job delivery.
Not `OBSERVABILITY`: retry decisions must be observable, but telemetry cannot perform the retry.

## `RESILIENCE-3` — breaker, bulkhead and load shedding protect capacity

The dependency boundary names the protection selected: a breaker opens after measured failures and
recovers by probe; a bulkhead caps concurrent work and queue; load shedding rejects excess work with a
typed degraded outcome. The limits are finite and visible.

Boundary: not `RESILIENCE-1`: timeout bounds one call, while this code protects shared capacity. Not
`DELIVERY-ASSURANCE`: a passing health check does not prove runtime saturation behaviour.

## `RESILIENCE-4` — fallback preserves the contract

Fallback returns only a value the feature contract explicitly permits: cached data with declared
freshness, an empty optional result, a queued acknowledgement or a stable unavailable failure. It
preserves authorization, tenant scope and result shape. It never invents a successful mutation or
silently serves unauthorized/stale data.

Boundary: not `INTEGRATION-3`: translation maps provider result/error; fallback chooses a truthful
feature outcome after failure. Not `CQRS`: fallback does not turn a query into a command or alter the
operation's semantic ownership.

## `RESILIENCE-5` — cancellation and deadlines propagate

The signal reaches nested clients, database calls, retry waits, streams and child tasks. A cancellation
or expired deadline stops scheduling more work and prevents late completion from mutating the abandoned
request/job. Cleanup is idempotent.

Boundary: not `ASYNC-2`: cancellation of a request does not erase a separately accepted durable job;
the job's own contract decides that. Not `OBSERVABILITY`: cancellation telemetry records the outcome,
but cannot be the cancellation mechanism.

## Layer held

The operation/application layer owns total budgets and contract-allowed fallback. Shared client/policy
modules own retry, breaker, bulkhead and signal propagation. Provider adapters translate provider errors;
event delivery owns fan-out; CQRS owns operation semantics; observability records decisions; assurance
proves the gates and runtime evidence.

## Inputs

| Input | Evidence required |
|---|---|
| dependency | Call type, idempotency and failure classes |
| budget | Total deadline, per-attempt ceiling and cancellation source |
| capacity | Concurrency/queue limits, breaker thresholds and reject result |
| contract | Legal fallback, freshness, authorization and result shape |
| proof | Delay, transient failure, overload, stale cache and cancellation cases |

## Rules

1. One deadline bounds the whole operation.
2. Retry only allowlisted transient, safe work and stop at the deadline.
3. Protect shared dependencies with finite capacity controls.
4. Fallback is explicit, truthful and contract-preserving.
5. Propagate cancellation to every child and prevent late mutation.
6. Log/measure decisions without making telemetry the control plane.

## Exceptions

- **Non-idempotent retry.** A provider may expose an idempotency key; retry is allowed only when the key
  and provider guarantee make duplicate execution safe (`RESILIENCE-2`).
- **Background work.** A detached job may outlive the request only after it is durably accepted as a
  job; it receives the job deadline, not the vanished request signal (`RESILIENCE-5`).
- **Fail-fast operation.** An operation may refuse fallback when the contract requires authoritative
  data; return a typed unavailable outcome rather than fabricate one (`RESILIENCE-4`).

## Output

```text
operation: <feature operation>
dependency: <client/provider/resource>
budget: <deadline and cancellation>
protection: <retry, breaker, bulkhead/load-shed>
fallback: <contract-preserving result or unavailable>
situation: <RESILIENCE-1 | RESILIENCE-2 | RESILIENCE-3 | RESILIENCE-4 | RESILIENCE-5>
reason: <failure/capacity/contract fact>
```
