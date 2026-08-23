# Performance

## LOADS

None.

## Record

The input is an accepted operation and data shape. This module decides the backend cost contract:
how much data a request may ask for, how relations are loaded, what query plan evidence is required,
and which latency/resource budgets are observable. It does not make “fast” a visual preference or
replace correctness, authorization or transaction law.

## Law

Every collection read is bounded and projects only the fields needed by its answer. Relation loading
is explicit and batched; no entity silently makes every caller pay for eager relations and no loop
silently creates one query per item. Indexes are justified by actual predicates/order and verified
with a plan. A budget names the percentile, workload, resource and measurement point; “optimised” is
not evidence without a reproducible workload.

`transport` owns request reachability and protocol limits; `data-access` owns managers, query shape
and transactions; `authorization` owns visibility; `maintainability` owns generic decomposition;
`testing` owns test lanes. This module connects those decisions to cost and evidence without
duplicating their rules.

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `PERF-1` | A collection or large answer is exposed | Bounded page size with a server maximum, stable cursor/order and an explicit projection |
| `PERF-2` | Relations or repeated items are loaded | Explicit joins/batching/data-loader shape; no hidden N+1 loop or entity-level eager relation |
| `PERF-3` | A query or index is introduced | Predicate/order evidence, matching index rationale and captured `EXPLAIN`/query-plan proof |
| `PERF-4` | An operation receives a performance promise | p95/p99 latency plus query, bytes, memory/concurrency or provider budgets measured on a named workload |

## Reading an accepted shape

1. Name the answer, maximum useful rows/fields, visibility filter and expected workload.
2. Set the bound and cursor/order before choosing ORM calls; then project only answer fields.
3. Trace relation access through the full loop/resolver/serializer path and batch it explicitly.
4. Read predicates and order from the real operation, derive candidate indexes, and capture a plan.
5. State budgets and measurement points, including cold/warm, tenant size and failure behavior.
6. Apply every matching code independently; a bounded query can still have N+1 or an unproven plan.

## `PERF-1` — pages and projections are bounded

**Situation.** A list, search, feed, export preview or relation can grow beyond a request's safe
memory and latency envelope.

**Source shape.** The API accepts a bounded limit, clamps/rejects values over a server maximum, uses
an opaque cursor or otherwise stable continuation key, and orders by deterministic unique tie-breakers.
The query selects only fields required by the answer; a full entity is not the default projection.

**Boundary.** Not `TRANSPORT`: protocol parses arguments, while this code sets data bounds. Not
`DATA-*`: data access implements the query handle/transaction, while this code sets the answer's
cost. Not `API-*`: pagination compatibility is API evolution; this code ensures the current contract
is bounded. Not `TESTING-*`: tests prove boundary and ordering but do not choose them.

## `PERF-2` — relation work is explicit and batched

**Situation.** A list returns parent rows and accesses children in a loop, serializer or resolver.
The first query succeeds, but one hidden query per item makes cost proportional to row count.

**Source shape.** Relations are selected at the call site, joined where cardinality and projection
make that safe, or loaded through a request-scoped batch/data-loader keyed by the parent set. Entity
relations are not eager by convenience. A query-count expectation exists for the bounded case.

**Boundary.** Not `DATA-5`: that code places relation intent at the caller; `PERF-2` proves the chosen
shape does not multiply queries. Not `MAINTAIN-*`: repeated calls are a runtime cost, not merely
duplication. Not `AUTHORIZATION`: visibility predicates remain authorization law in every batched query.

## `PERF-3` — indexes and plans have evidence

**Situation.** A new filter/order, index, join or query rewrite is proposed to improve performance.

**Source shape.** The operation's real predicates, selectivity and order are recorded; the index
supports that access path without pretending to solve unrelated queries. A representative
`EXPLAIN`/plan is captured before and after, including row estimates and whether the index is used.
Unused or speculative indexes are not accepted as proof.

**Boundary.** Not `DATA-*`: data access declares entities/migrations and transaction placement;
`PERF-3` requires workload evidence. Not `NAMING-*`: index names are a separate vocabulary decision.
Not `MAINTAIN-*`: an index may be technically tidy and still be the wrong plan.

## `PERF-4` — budgets are measurable promises

**Situation.** A handler, query, media transfer or background job has a latency/resource expectation.

**Source shape.** The budget names p95/p99 or other percentile, request shape, dataset/tenant size,
concurrency, query count, payload bytes, memory/CPU/provider time and measurement boundary. Telemetry
and a regression test or load scenario can fail when the budget is exceeded.

**Boundary.** Not `TRANSPORT`: timeout is one external control, not the whole service budget. Not
`EXCEPTION-IDENTITY`: a timeout/refusal still needs stable failure identity. Not `TESTING`: testing
chooses the lane and assertions; this code defines what cost must be measured. Not `MAINTAINABILITY`:
budget pressure can justify a split but does not itself define module ownership.

## Layer held

| Code | Tier | Held by |
|---|---|---|
| `PERF-1` | `documented` | Query/contract review and pagination tests; bound depends on answer and workload |
| `PERF-2` | `documented` | Query-count integration tests and call-graph review |
| `PERF-3` | `documented` | Migration/query review with captured plan evidence |
| `PERF-4` | `documented` | Benchmark/load/telemetry evidence on a named workload |

## Inputs

| Input | Evidence required |
|---|---|
| answer | Fields, rows, relations and visibility actually needed |
| workload | Dataset/tenant size, concurrency, hot/cold path and provider behavior |
| query | Predicates, order, joins, projection and continuation key |
| budget | Percentile, latency, query/byte/memory/CPU/provider limits and measurement point |
| proof | Query count, plan, benchmark, telemetry and regression threshold |

## Rules

1. Bound every collection and cap it server-side.
2. Use stable opaque continuation and deterministic order for pages.
3. Project fields and load relations explicitly; batch repeated access.
4. Require real predicate/order and plan evidence for indexes and query changes.
5. State measurable percentile and resource budgets on a named workload.
6. Keep transport, data access, authorization, naming, exception identity, maintainability and testing
   in their own modules.

## Exceptions

- **Internal batch/export.** A job may process more rows, but it uses bounded chunks, checkpoints and
  a declared job budget; “internal” does not justify unbounded memory.
- **Small fixed relation.** A join may be appropriate when a cardinality bound is proven; it still
  satisfies explicit projection and query-count evidence.
- **Planner variability.** A plan may vary by statistics or tenant; record the representative range,
  refresh statistics and fail the budget when the supported range regresses.

## Stops

Stop when the maximum page, continuation/order, relation strategy, plan evidence or percentile/resource
budget is unnamed. Stop when proof is a local timing claim, an index list without a plan, or a happy
path with one row.

## Proof

| Code | Minimum proof |
|---|---|
| `PERF-1` | Contract/query test rejects over-limit requests, proves stable traversal and checks projection |
| `PERF-2` | Integration test asserts bounded query count for multiple parents and no eager relation |
| `PERF-3` | Plan artifact shows predicate/order access path and acceptable estimates/usage |
| `PERF-4` | Reproducible benchmark/load or telemetry regression asserts percentile and resource budgets |

## Output

```text
answer:   <fields, rows and relations>
bound:    <limit/cursor/order>
queries:  <projection and batching shape>
plan:     <index and EXPLAIN evidence>
budget:   <percentile and resource limits>
situation: <PERF-1 | PERF-2 | PERF-3 | PERF-4>
verdict:  <holds | violates | stop>
proof:    <test, plan or workload evidence>
```
