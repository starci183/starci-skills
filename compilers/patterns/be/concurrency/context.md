# Concurrency

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is an accepted shape that has one mutable fact and two or more actors able to read or
change it at the same time: a balance, token, membership, quota, status transition, or unique
claim. This pattern does not choose the business outcome. It decides where the contested-state
boundary lives, which database primitive proves it, and how the race is demonstrated.

## Law

Concurrency is a correctness property, not a performance detail. A read followed by a decision and
a write is one logical operation only when competing actors cannot interleave it into an invalid
state. The source must name one owner for the contested state: a transaction with a lock or serial
isolation, or a versioned compare-and-set (CAS) that makes a loser observable.

The deciding question is: **what makes two actors unable to both win?** A mutex in one process is not
an answer when two replicas can run the code. A retry loop is not an answer when the operation has
already produced an external effect. A unique constraint may be the final guard for identity, but
it does not automatically serialize a read-modify-write invariant.

**This is binding, not advisory.** Every operation that can race carries the applicable situations
below. The codes are fixed identities; they are not a severity scale. A correct choice normally
uses more than one: `CONCURRENCY-1` names the contested state, `CONCURRENCY-2` names a CAS when
appropriate, `CONCURRENCY-3` names the lock/isolation contract, and `CONCURRENCY-4` proves the
decision under actual overlap.

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `CONCURRENCY-1` | Two actors can change one invariant-bearing state | One transaction/lock owner or one atomic state transition encloses read, decision and write. Forbidden: check-then-act across separate autocommit statements, process-local mutexes as the only guard, or a caller-controlled state update |
| `CONCURRENCY-2` | A stale reader may attempt a write | A version/updated-at token is read and included in a conditional update; zero affected rows becomes a named conflict, never a silent success or unconditional retry |
| `CONCURRENCY-3` | The implementation chooses pessimistic locking or isolation | The lock mode, isolation level, lock key, transaction lifetime and deadlock/timeout outcome are explicit. Forbidden: a lock held after the transaction, a table-wide lock for a row invariant, or a lock with no bounded failure policy |
| `CONCURRENCY-4` | The race needs proof | A test starts competing actors from a barrier, uses real persistence/transactions, asserts the invariant and loser outcome, and contains no timing sleep or direct handler shortcut |

Four codes, and it ends at four. A new situation is a recorded rule change, not a fifth code added
because a nearby concern feels similar.

## Reading an accepted shape

1. Read the settled business invariant: what may happen once, what total must not exceed, or which
   state transitions are legal.
2. Read what the shape leaves open: the contention key, transaction owner, version field, lock
   primitive and conflict contract are inputs, not guesses.
3. Resolve outermost first. Name the contested state (`CONCURRENCY-1`), choose CAS or a lock
   (`CONCURRENCY-2`/`CONCURRENCY-3`), then write the race proof (`CONCURRENCY-4`).
4. Ask: if two requests read the same old value, can both commit? If one loses, can the caller tell
   whether it should refresh, report conflict, or safely retry? If a lock waits, what releases it?
5. Codes compose. A CAS may satisfy `CONCURRENCY-1` and `-2` but still need `-4`; a correct lock
   without a bounded timeout satisfies `-1` but violates `-3`. Do not collapse these into one block.

## `CONCURRENCY-1` — one owner encloses the contested decision

**Situation.** Two actors can observe the same state before either writes it.

**What it emits in source.** A transaction callback or one atomic SQL statement owns the read,
decision and write. A row/advisory lock, serializable unit, or conditional update is visible at that
boundary. The domain service receives the authoritative state or manager; it does not accept a
caller-supplied post-state.

**Recognition signs.** `findOne()` followed by a later `save()` without a transaction; an in-memory
`Mutex` in a multi-replica service; `if (remaining > 0) remaining--` in application memory; a
comment saying "requests are normally sequential".

**Boundary.** Not `DATA-4`: `DATA-4` asks whether writes that must live or die together use the
transactional manager; this code asks whether competing actors can invalidate the decision. A
transaction can be correctly threaded and still permit a lost update. Not `IDEMP-2`: idempotency
stops a repeated command with one key; it does not arbitrate two different valid commands racing.
Not `DELIVERY-4` or `CDC-4`: broker/message duplicate claims are transport concerns, not row
invariants. Not async retry: retry policy decides whether to try again after failure; it cannot make
the first read-modify-write atomic.

## `CONCURRENCY-2` — a stale writer must lose visibly

**Situation.** An actor computed a result from version `v`, but another actor committed version
`v+1` before its write.

**What it emits in source.** `UPDATE ... WHERE id = ? AND version = ?`, an equivalent repository
condition, or a database-native CAS; the affected-row count is checked. A zero-row result maps to a
typed conflict/refresh result, not to success and not to an unbounded blind retry.

**Recognition signs.** A `version` column is selected but omitted from the update predicate; the
code overwrites a newer value; the catch block retries the same stale object forever; callers cannot
distinguish conflict from not-found.

**Boundary.** Not `CONCURRENCY-3`: CAS is an optimistic policy; a lock/isolation policy is a
pessimistic or transaction-wide choice. Not `DATA-4`: passing the manager does not create a version
predicate. Not async retries: a retry may re-read and deliberately recompute, but only after the
conflict is represented and bounded.

## `CONCURRENCY-3` — locking and isolation are a bounded contract

**Situation.** The operation uses a lock or isolation level to protect a contested row or key.

**What it emits in source.** The exact lock (`FOR UPDATE`, advisory key, serializable transaction),
scope, timeout/deadlock mapping, and release point are stated. The lock key is stable and narrow
enough for the invariant. Work that does not need the lock occurs outside it; external network calls
never happen while a database lock is held.

**Recognition signs.** A lock is acquired with no transaction; a process-local lock is used across
replicas; a table lock protects a single account; a provider call sits inside the lock; lock timeout
is swallowed or retried forever.

**Boundary.** Not `CONCURRENCY-1`: `-1` says an owner exists; `-3` says exactly how it behaves and
fails. Not `DATA-4`: the transactional manager must be passed, but this code selects the lock and
its duration. Not `IDEMP-2`: a durable idempotency claim is a separate key/record and should not be
called a lock. Not `DELIVERY-4`/`CDC-4`: their claim/deduplication happens at message delivery or
projection boundaries.

## `CONCURRENCY-4` — the test creates overlap, not a story about overlap

**Situation.** A race is the defect being guarded and must be made repeatable.

**What it emits in source.** A concurrency or e2e spec creates two real actors, releases them from
the same barrier, awaits both outcomes, and reads the authoritative row afterwards. It asserts the
invariant, exactly one winner where required, and the typed conflict/loser result. It uses a bounded
poll/deadline only for real async settlement; `sleep(10)` is not synchronization.

**Recognition signs.** The spec calls a handler directly; mocks the repository transaction; runs
requests sequentially; asserts only call counts; or passes because a fixed delay happened to space
the actors apart.

**Boundary.** Not `TESTING-5` or `TESTING-6`: unit branch coverage and returned-value assertions
are useful, but they do not establish overlap. Not `TESTING-3`/`E2E-11`: a production-transport
flow may be the outer lane, while this code specifically requires competing actors and persisted
state. Not `IDEMP-5`: an idempotency proof duplicates the same logical key/effect; this proof uses
contending state transitions, often with different commands. Not async retry: retry can hide a race
unless the first concurrent outcomes are asserted before any recovery.

## Layer held

| Code | Tier | What holds it |
|---|---|---|
| `CONCURRENCY-1` | `documented` | the operation/service and its transaction or atomic SQL boundary |
| `CONCURRENCY-2` | `documented` | the conditional repository/query write and conflict mapping |
| `CONCURRENCY-3` | `documented` | database lock/advisory-lock helper and transaction owner |
| `CONCURRENCY-4` | `documented` | the concurrency/e2e spec; no lint can infer interleaving intent |

All four are documented because the deciding facts cross call graphs, database plans and test
orchestration. A filename or AST rule cannot tell whether a transaction protects the right invariant.
That is an honest gap, not permission to omit the proof.

## Inputs

| Input | Evidence required |
|---|---|
| invariant | The value, quota, transition or uniqueness rule that must survive overlap |
| contenders | The two or more operations/actors that may run concurrently |
| owner | Transaction, lock, isolation or CAS primitive and its exact key |
| conflict | The typed outcome for a stale or losing actor |
| proof | A barrier-driven test and the authoritative state it reads back |

## Rules

1. Every contested read-modify-write has one database-visible owner.
2. Optimistic writes carry the version they actually read and inspect the affected-row count.
3. A lock names its key, mode, scope, timeout and release point.
4. External effects do not run while a database lock is held unless the accepted shape explicitly
   makes that effect part of the lock contract.
5. A race proof overlaps real actors and asserts persisted state, not timing or collaborator calls.
6. Idempotency, delivery/CDC dedupe and async retries remain separate boundaries.

## Exceptions

- **Single writer by architecture.** `CONCURRENCY-1` may be satisfied by a durable single-writer
  queue only when the queue ownership and restart/replay semantics are themselves named; a local
  event loop is not a durable single writer.
- **Naturally atomic database operation.** A single `INSERT ... ON CONFLICT`, guarded `UPDATE`, or
  unique constraint may satisfy the contested invariant without a separate lock. It still needs
  `CONCURRENCY-4` when the outcome matters.
- **Deliberate conflict retry.** `CONCURRENCY-2` permits one bounded retry only after a fresh read and
  only when the business operation is safe to recompute. It must not turn a conflict into silence.
- **Focused integration world.** `CONCURRENCY-4` may boot a reduced module graph, but persistence,
  transaction boundaries and the competing actors remain real.

## Output

```text
operation: <mutation | query | job | webhook | scheduler>
invariant: <state or rule that must survive overlap>
situation: <CONCURRENCY-1 … CONCURRENCY-4>
owner: <transaction | row lock | advisory lock | isolation | CAS>
conflict: <typed loser outcome, or not applicable>
proof: <barrier-driven test and authoritative read-back>
reason: <the fact that excludes the adjacent code>
```
