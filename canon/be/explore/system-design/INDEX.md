# `system-design/` — the decisions taken before a line is spelled

Ten files about the shape of a backend rather than the text of its files. They answer the questions
that are settled once and then constrain everything after: where a module boundary is cut, what
crosses it, what the API promises, what happens when a dependency stops answering, and what you can
still find out at three in the morning.

This is the **explore** lane, so nothing here is gated. A rule on this shelf is a judgement with its
reasoning attached — it names the trade-off it is making and the failure it is avoiding, so that a
case its author never saw can still be decided by someone reading it. The sibling `enforce/` shelf
holds the half a machine can settle.

Anchors here are **public sources, not files in this tree**: Nygard, Fowler, Evans, Hohpe and Woolf,
the Google SRE book, the AWS Builders' Library, OWASP, the RFCs. There is nothing in these files to
re-count, and no path in them to go stale. Where a concrete example is written against a
Nest-shaped TypeScript service it is because that is the shape the rule was drawn from; the rule
above the example is the part that travels.

Four of the files — resilience, observability, caching, auth — follow a fixed shape: **The test**, a
single sentence you can hold a design against; **The rules**; **One worked example**; and **What a
machine can check, and what it cannot**. The other six are organised by their own decisions, one
heading each.

| File | Decides |
|---|---|
| [`module-layering.md`](module-layering.md) | that a top-level folder is a capability rather than a technical layer, that dependency arrows point inward only, that a module has exactly one public entry, how ports and adapters keep a driver out of the domain, and why the composition root is the proof a module exists |
| [`api-design.md`](api-design.md) | resources as nouns over a closed verb set, a version for every breaking change instead of a silent redefinition, a server-owned bound on every list, an idempotency key on every unsafe write, a machine-readable error code before a sentence, and one envelope applied by the framework rather than hand-built at each site |
| [`data-access.md`](data-access.md) | one passable persistence handle, a transaction boundary owned by the use case rather than by a repository, N+1 found by counting queries rather than by reading code, forward-only migrations with a schema that is never inferred, read models as derived and disposable, and a pool sized for the database instead of the application |
| [`auth-and-authz.md`](auth-and-authz.md) | that identity is verified once at the edge and permission is decided again per object in the use case — two guards in sequence, default deny enforced by the framework, tokens verified rather than decoded, and revocation treated as the choice between a session and a token |
| [`caching.md`](caching.md) | that every cached value has a stated maximum staleness, an owner that invalidates it and a finite TTL that would fix it anyway — cache-aside as the default, delete on write rather than update, layered TTLs that add up, and what may never be cached at all |
| [`messaging-and-events.md`](messaging-and-events.md) | that a command and an event differ by who may say no, that at-least-once delivery makes every consumer idempotent, that publishing and writing are one atomic act, that ordering is a partition-level guarantee, additive-forever schema evolution, and choreography until the flow stops being readable |
| [`background-jobs.md`](background-jobs.md) | that the handler enqueues and the worker executes, that the job row is the unit of work while the broker's object is only a delivery receipt, bounded and jittered retries configured once, a dead-letter queue as a destination rather than a log line, checkpointing for long work, and bounded queues everywhere |
| [`cqrs-and-projections.md`](cqrs-and-projections.md) | when separating read from write earns its cost, why an in-process command bus is not CQRS, that the write model owns the invariants and the projection owns none, recomputability from scratch as the test of a projection, feeding projections from change data capture, and eventual consistency as a product decision to be surfaced |
| [`resilience.md`](resilience.md) | that every call leaving the process has a finite timeout taken from the caller's budget, a bounded queue, a defined behaviour when the dependency is down, and — if retried — an operation safe to run twice, with backoff, jitter and a retry budget above the attempts |
| [`observability.md`](observability.md) | that one wide structured event per unit of work goes to stdout, that a correlation id generated at the edge is propagated into queues and jobs as well as over HTTP, and that a request id from a complaint is enough to reconstruct the path without a secret or a name appearing on it |

## Reading order

There is none, but there is a dependency worth knowing: `module-layering.md` decides where everything
else lives, so a disagreement about which file a rule belongs in is usually a disagreement about the
boundary, and that is the file to open. A new subsystem typically crosses three or four of these.

Two of them are cheap individually and worthless individually. Resilience is a set — a timeout with
no bounded retry makes a load amplifier, a retry with no idempotency makes a double charge — and
caching is the same: a TTL without an owner is a guess. Read those two whole rather than by section.
