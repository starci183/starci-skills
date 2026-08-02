# CQRS and projections

Command Query Responsibility Segregation says one thing only: the model you write through and the
model you read through may be different objects. Greg Young, who named it (*CQRS Documents*, 2010),
and Udi Dahan (*Clarified CQRS*, 2009) both spent the following decade telling people it is not a
top-level architecture. Martin Fowler's bliki entry (2011) is the sentence worth memorising: CQRS
adds significant complexity, and for most systems it is a *liability*, useful only in the parts of a
system where the read and write sides genuinely diverge.

So this file is mostly about the cost, and then about how to pay it properly when it is earned.

## When the separation earns its cost

Three tests. A project needs to pass at least one, in a bounded part of the system rather than
everywhere:

1. **The read shape is not the write shape, and the translation is expensive per request.** A screen
   needs a count over a million rows, a rank within a cohort, a streak computed from a sequence of
   events, or a join across five tables that exists only for display. The write model is normalised
   because invariants live there; the read model wants that data pre-joined and pre-aggregated.
2. **Reads and writes need to scale independently.** Two or three orders of magnitude between read
   and write volume is the usual trigger, and the read side can then be replicated, cached or moved
   to a different store without touching the write path.
3. **The read answer is derived from many writers.** A leaderboard, a trending list, an engagement
   statistic — nobody writes those; they are functions of everyone else's writes, and there is no
   single aggregate that owns them.

And the counter-tests, which are more useful. Do not separate when:

- **The read is a filtered or paged version of the write model.** A repository query is the answer.
  Fowler's point again: the complexity is real and the benefit here is zero.
- **The only motivation is that "we use CQRS".** An in-process command bus is not CQRS; see below.
- **Nobody can state what staleness is acceptable.** Separation buys performance with eventual
  consistency, and if the product cannot say how stale the number may be, the trade has not been
  made, it has been hidden.

The decision is judgement, and it is per capability rather than per system. A codebase can have one
heavily projected surface and thirty capabilities that read straight from the write model, and that
is the healthy shape rather than an inconsistency to clean up.

## An in-process command bus is not CQRS, and the vocabulary matters

Handing a `SomethingHappenedEvent` to an in-process bus so that a side effect runs decoupled from its
cause is a good pattern and has nothing to do with CQRS: there is no second model, no separate store,
no read side. It is a Mediator with an event channel.

Keep the words apart, because a codebase in which a folder called `cqrs` holds only in-process
handlers teaches every new reader the wrong meaning, and they will then look for a read model that
does not exist. Names in use, with what each actually denotes:

- **command bus / event bus** — in-process dispatch, one write model, no projection.
- **projection** — a stored read model, derived from the write model, recomputable.
- **CQRS** — the pair: writes go to one model, reads to the other.
- **event sourcing** — the write model itself is a log of events. Independent of CQRS in principle,
  usually seen with it, and a much larger commitment. Do not adopt it because CQRS was adopted.

## The write model owns invariants; the projection owns none

This is the rule that keeps the separation from becoming two sources of truth.

- **Every rule that can reject a write lives on the write side**, inside the transaction that changes
  the aggregate. Evans' rule from *Domain-Driven Design* (2003) — one aggregate is the transactional
  consistency boundary — is unchanged by CQRS.
- **A projection never validates and never rejects.** Its only job is to be a function of the write
  model's current state. A projection that decides something is a second write model with no
  transaction around it.
- **Never read a projection to make a write decision.** The projection is stale by construction, so a
  balance check, a quota check or a uniqueness check against it is a race with a known winner. Read
  the write model, inside the transaction, with the lock the invariant needs.
- **A projection table is disposable.** If dropping it and rebuilding costs anything but time, it was
  holding state nobody else had, and that state should not have been there.

## Recomputable from scratch is the test of a projection

A projection you cannot rebuild is a cache you have to believe. Make the rebuild routine and the rest
of the design follows, because the only way a projection can be rebuilt is if every update is a full
idempotent recomputation of one target rather than an increment.

- **Recompute a target; do not increment it.** `UPSERT (target, computed value)` replays safely, and
  a delivery you receive twice, out of order or after a gap converges anyway. `points = points + 5`
  does none of that, and it is the reason projections drift.
- **The key is the target of the recomputation**, so the whole update is one statement with an
  `ON CONFLICT DO UPDATE`. A read-modify-write across two statements needs a lock you do not want.
- **A rebuild is the same code path as a live update**, iterated over the source. If the rebuild has
  its own SQL, the two will diverge and the rebuild will be the one nobody tested.

This one is machine-checkable and worth checking, because the failure is silent and slow: a test that
feeds the same change twice and asserts the projected row is byte-identical after the second pass.
Every projection gets it.

## Feeding projections from change data capture

The transport question is how a projection hears about a write. Polling the write tables is simple
and adds load and latency. Publishing a domain event from the write path is precise and reintroduces
the dual-write problem (`messaging-and-events.md`). Change data capture avoids both: a connector such
as Debezium tails the database's replication log and publishes every insert, update and delete to a
topic, so the publication is the commit itself. Martin Kleppmann's *Turning the Database Inside Out*
(2015) is the argument for treating that log as the primary integration point.

What CDC costs you is that the messages are row diffs, not domain facts. A consumer therefore has to
translate, and that translation is the projection's `deriveTargets`: given a changed row, which
read-model rows are now wrong.

The whole shape, as one abstract class the concrete listeners fill in:

```ts
export abstract class AbstractProjectionListener<TTarget> implements OnModuleInit {
    /** Stable across deploys: a restart resumes at the committed offset instead of replaying all history. */
    protected abstract readonly groupId: string
    protected abstract readonly topics: Array<string>

    /** One changed row to the read-model rows it invalidates. Pure — no I/O, no decisions. */
    protected abstract deriveTargets(row: ChangeRow): Array<TTarget>

    /** Full recomputation of one target from the write model, written as an idempotent UPSERT. */
    protected abstract recomputeTarget(target: TTarget): Promise<void>

    async onModuleInit(): Promise<void> {
        try {
            await this.kafka.ensureTopics(this.topics)       // a topic that does not exist yet must not break boot
            await this.kafka.subscribe({
                groupId: this.groupId,
                topics: this.topics,
                handler: (message) => this.onMessage(message),
            })
        } catch (error) {
            // The write path is useful without the read model. Log loudly, start anyway.
            this.logger.error(`projection ${this.groupId} failed to subscribe`, asError(error).stack)
        }
    }

    private async onMessage(message: ChangeMessage): Promise<void> {
        // Debezium nests the row under `payload` in some connector configurations and not others.
        const row = message.value?.payload ?? message.value
        for (const target of this.deriveTargets(row)) {
            try {
                await this.recomputeTarget(target)
            } catch (error) {
                // Safe to swallow ONLY because recompute is a full recomputation: any later
                // change to the same target heals it. See the caveat below.
                this.logger.error(`recompute failed for ${String(target)}`, asError(error).stack)
            }
        }
    }
}
```

Two decisions in that file deserve to be argued with rather than copied:

**Best-effort boot.** Starting without the stream means serving a read model that is silently frozen.
That is the right trade when the API is genuinely useful without fresh projections and when the
failure is alerted on — and the wrong one when a stale leaderboard is worse than an error. Decide it
per deployment, and make the log line loud enough that "Kafka has been down for two days" is
discoverable without asking.

**Swallowed message errors.** This is only defensible because recompute is idempotent and a later
change to the same target repairs it. If a target can go quiet forever — an entity that stops
changing — then swallowing means permanently stale, and the projection needs the two things a queue
already has: a dead-letter destination for failed targets, and a periodic full sweep that recomputes
everything regardless of traffic. A nightly sweep is cheap insurance and it doubles as the rebuild
path from the previous section.

**Consumer group identity is load-bearing.** It is what makes restarts resume rather than replay, and
what makes two replicas share partitions rather than duplicate work. Changing it in a deploy silently
replays history; deriving it from something unstable, such as a hostname, does the same on every
restart.

## Eventual consistency is a product decision, so surface it

The gap between the write and the read is not an implementation detail the interface can hide. Two
rules, both about what the caller sees:

- **Read your own writes from the write model.** After a command succeeds, return the value the
  command produced rather than re-querying the projection, which has not caught up. This single rule
  removes most of the confusion users report about eventual consistency, because the case people
  notice is their own action failing to appear.
- **Where the number is genuinely derived and cannot be returned by the command** — a rank, a
  trending position — the interface says when it was computed, or the product accepts that it lags.
  Neither is a bug; pretending it is live is.

Pat Helland's *Life Beyond Distributed Transactions* (2007) is the underlying claim: past a certain
scale you get one atomic unit, and everything else is a version of the truth with a timestamp on it.
CQRS is that trade made deliberately, and the deliberateness is the whole value.

## Sources

- Greg Young, *CQRS Documents* (2010); Udi Dahan, *Clarified CQRS* (2009).
- Martin Fowler, *CQRS* (bliki, 2011) — the caution about complexity and scope.
- Eric Evans, *Domain-Driven Design* (2003) — the aggregate as the transactional consistency
  boundary.
- Martin Kleppmann, *Turning the Database Inside Out* (2015) and *Designing Data-Intensive
  Applications* (2017), ch. 11 — change data capture and derived data.
- Chris Richardson, *Microservices Patterns* (2018) and microservices.io — CQRS, Database per
  Service, Transaction Log Tailing.
- Pat Helland, *Life Beyond Distributed Transactions* (2007).
- Debezium documentation — change event envelope, connector semantics.

Related: `messaging-and-events.md` (why the CDC stream is at-least-once and what that forces on a
consumer) and `background-jobs.md` (the rebuild and the periodic sweep are background jobs, with
every bound that implies).
