# Data access — the repository boundary, transactions, N+1, migrations, and the pool

This file decides how business code reaches the database and what it is not allowed to know about it.
The concrete idiom is TypeORM on PostgreSQL under Nest; the rules are stated so any mapper and any
engine can obey them.

The industry ground is Martin Fowler's *Patterns of Enterprise Application Architecture* (2002) for
Repository, Unit of Work and Data Mapper, Eric Evans' *Domain-Driven Design* (2003) for the aggregate
as the transactional boundary, Pat Helland's *Life Beyond Distributed Transactions* (2007) for what
happens past that boundary, Fowler and Ambler's *Refactoring Databases* (2006) for expand/contract,
Chris Richardson's *Microservices Patterns* (2018) for the transactional outbox, and Nygard's
*Release It!* for the pool.

## One persistence handle, and it must be passable

**Choose one way for business code to reach the database and hold it everywhere.** A house that
mixes per-entity repositories, a shared entity manager and active-record entities has three
transaction stories, and the third one is always the one that runs outside the transaction someone
carefully opened.

The property that decides which style survives is not elegance, it is **composability**: any
persistence call must be able to enrol in a transaction its caller already opened. A repository that
captures its own connection at construction cannot do this, and the symptom is a helper that quietly
commits on its own while the caller believes it is inside a rollback. So: **every persistence
function takes the current unit of work as an argument** — an `EntityManager`, a transaction handle,
a session — with the ambient one as a default only for genuine single-statement reads.

```ts
// Wrong: the helper reaches for its own connection, so it cannot be rolled back with the caller
async creditXp(userId: string, amount: number) { await this.repository.increment(...) }

// Right: the caller decides the boundary, the helper joins it
async creditXp(manager: EntityManager, userId: string, amount: number) { … }
```

**The domain talks to a named boundary, not to a query builder scattered through services.** Whether
that boundary is a repository interface (Fowler's Repository, the strict form) or a set of named
query methods on one service, the test is the same: *can you list every query that touches this
table by reading one folder?* If a `createQueryBuilder` chain against the same table appears in nine
services, no one can change the table's shape, because nobody can enumerate what reads it.

**Exposure is a separate decision from persistence.** A column that exists is not a field that ships.
Keep the persistence mapping and the API mapping as two annotations on the same property so that
dropping the API one is how a secret stays out of a response, rather than relying on a hand-written
`delete row.passwordHash` in a service. That is a rule a reviewer can check by reading one class
instead of every path a row can travel.

## The transaction boundary belongs to the use case

**One use case, one transaction, opened at the top and threaded down** (Fowler's Unit of Work).
Neither the repository nor the entity chooses it, because neither can see whether it is the whole
operation or a step in a longer one.

**One aggregate per transaction** (Evans). Reaching a second consistency boundary in the same commit
buys atomicity you cannot keep once either side moves out of the process; the portable form is to
change one aggregate and emit an event for the rest, and to accept a compensating action rather than
a distributed commit (Helland; Garcia-Molina and Salem's *Sagas*, 1987).

**No remote I/O inside a transaction.** A third-party call between `BEGIN` and `COMMIT` holds a
pooled connection and an open snapshot for the duration of somebody else's outage; a handful of them
exhaust the pool and the whole service stops, including the endpoints that never touch that vendor.
Do the remote work first, then open the transaction with the result in hand.

**Publish after commit, and make the publish itself transactional.** Publishing inside the
transaction announces work that may still roll back; publishing after the commit is lost if the
process dies in the gap. The durable answer is Richardson's transactional outbox: a row written in
the same transaction as the state change, drained by a relay.

```ts
// One aggregate, one transaction, one row that will become a message.
async completePurchase(input: CompletePurchaseInput): Promise<void> {
    // The gateway call happens BEFORE the transaction opens: see the rule above.
    const receipt = await this.paymentGateway.capture(input.paymentIntentId)

    await this.entityManager.transaction(async (manager) => {
        const enrollment = await manager.findOneOrFail(EnrollmentEntity, {
            where: { id: input.enrollmentId },
            // Two webhooks for the same purchase arrive concurrently in production more
            // often than anyone expects; the lock is what makes the second one wait.
            lock: { mode: "pessimistic_write" },
        })
        if (enrollment.status === EnrollmentStatus.Active) return   // idempotent by state

        enrollment.status = EnrollmentStatus.Active
        await manager.save(enrollment)

        // Not published here. A publish inside the transaction announces work that may still
        // roll back; a publish after COMMIT is lost if the process dies in between. This row
        // commits atomically with the state change, and a relay turns it into a message.
        await manager.insert(OutboxMessageEntity, {
            subject: EventName.EnrollmentActivated,
            correlationId: input.correlationId,   // EIP Correlation Identifier, carried end to end
            payload: { enrollmentId: enrollment.id, receiptId: receipt.id },
        })
    })
}
```

The early return on `status === Active` is the second idempotency mechanism and it is worth having
alongside the first: **an operation that is idempotent by its own state does not depend on the
caller remembering to send a key.** Consumers must be idempotent regardless, because every broker
worth using delivers at least once (Hohpe and Woolf, Idempotent Receiver).

## N+1 is found by counting queries, not by reading code

The shape is always the same: one query loads N rows, and something — a lazy relation, a per-item
resolver, a loop calling a service — issues one more query per row. A graph makes it worse than a
REST endpoint does, because a nested field is evaluated once per parent, so a page of 50 items with
three nested relations is 150 round trips that no single file shows.

Three fixes, in order of preference:

1. **Fetch what you need in the query that already runs** — an explicit join or relation load. Best
   when the fan-out is bounded and small.
2. **Batch per level.** A per-request loader (the DataLoader pattern) collapses the N calls of one
   field into one keyed `IN` query. This is the only fix that scales for a graph, because the graph
   layer cannot know in advance which fields a caller selects.
3. **Denormalise or project** when the join is genuinely too wide — see read models below.

**Do not rely on review to catch this.** Reviewers see one file; N+1 lives in the relationship
between two. It is machine-checkable, and cheaply: count statements per request with a driver-level
counter or the ORM's logger, assert the count in a test for the handlers that matter, and alert on
statements-per-request in production. A test that says "listing 50 items issues at most 4 queries"
fails the day someone adds a relation walk, which is the day it is cheap to fix.

The related bound is Nygard's again: **cap fan-out**. A batched loader that turns one request into a
single `IN` clause of ten thousand ids has moved the problem rather than solved it.

## Migrations are forward-only, and the schema is never inferred

**Never let the mapper synchronise a schema against a database that holds data.** Auto-synchronisation
is a development convenience whose production failure mode is a dropped column or a dropped type,
decided by a diffing algorithm at boot with no review and no backup. The specific trap worth naming:
adding a value to a database-native enum used by more than one column can force the tool into a
drop-and-recreate of the type, which fails or cascades depending on the engine and the moment.

Two consequences follow, and the second is the portable one.

- Production schema change is an explicit, reviewed, versioned migration file. Rolling back is
  rolling *forward*: write the next migration. A `down` path is rehearsal-only, because by the time
  you need it the new code has already written data the old schema cannot hold.
- **Prefer a widenable representation over one whose set of legal values is baked into the schema.**
  A constrained string or a lookup table takes a new value with an insert; a native enum takes one
  with a type alteration. Choose the enum only where the value set is genuinely closed. The same
  instinct justifies a JSON column for a payload whose shape will evolve — with the limit that JSON
  is for data nobody filters, sorts or constrains on. The moment you query it, it becomes a column.

**Structural change is expand then contract** (Fowler and Ambler), in three deploys and never one:
add the new column nullable and write both; backfill the old rows in a batch job; switch reads, then
drop the old column in a later release. The reason it cannot be one deploy is that old and new code
run simultaneously during any rolling deployment, so the schema must be legal for both.

## Read models are derived, disposable, and optional

**Default to one model.** CQRS (Greg Young, Udi Dahan) applies where the read and write shapes
genuinely diverge — a search index, a leaderboard, a report over data owned by several aggregates —
not as a starting posture. Split too early and you have two models to keep true with no query that
was hard enough to justify it.

Where a read model exists:

- **It is derived and rebuildable.** Nothing writes to it except the projection that owns it, and
  deleting it entirely must be recoverable by replaying from the write side. A projection that
  accumulates state nobody else has is a second source of truth wearing a cache's clothes.
- **Its staleness is part of the contract.** A write followed immediately by a read of the projection
  will not see the write. The fix is not to make the projection synchronous, it is to **return the
  write's own result** to the caller who just performed it, and to reserve the projection for the
  queries that can tolerate lag.
- **The feed is events or change data capture, not a second write path.** A handler that writes the
  table and then also writes the index has two failure points and no way to reconcile them.

## The pool is sized for the database, not for the application

**Total connections is a property of the deployment, not of one process**: replicas times pool size,
plus every worker, plus every one-off task, must sit under the server's limit with headroom for an
administrator to log in during the incident. Doubling replicas to handle load and thereby exhausting
the database's connection limit is a self-inflicted outage that looks like a database problem.

- **Acquire has a timeout, and exhaustion fails fast** (Nygard, Fail Fast). A request that waits
  indefinitely for a connection converts a slow query into a total outage, because every arriving
  request joins the queue.
- **Separate pools for separate work** (Nygard, Bulkhead). Request-serving traffic, background
  workers and long analytical jobs share a database but must not share a pool, or one report starves
  the API.
- **Never hold a connection across an await on something else.** This is the transaction rule again
  from the pool's side, and it is the single most common cause of a pool that looks too small.
- **Every query has a statement timeout.** An unbounded query holds its connection until the client
  gives up, and the client that gave up an hour ago may still be holding it.

Pool sizing beyond these constraints is judgement and load-dependent; the constraints are not, and
the total-connections arithmetic should be written down where the deployment is described rather
than rediscovered during an incident.

## Related

[`api-design.md`](api-design.md) (paging bounds and the idempotency gate this transaction hosts) ·
[`module-layering.md`](module-layering.md) (why one module owns a table and others reach it through
its public entry).
