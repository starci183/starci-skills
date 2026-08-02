# Messaging and events

A message is the only way two components can be decoupled in time. Everything difficult about
messaging follows from that one property: the sender is gone by the time the receiver runs, so the
receiver cannot ask a question, cannot be told to stop, and cannot assume it is running for the first
time. Hohpe and Woolf's *Enterprise Integration Patterns* (2003) named the pieces; almost every rule
below is one of their patterns with the reason restated.

The concrete idiom in this file is a Nest service publishing to NATS or an in-process bus, a TypeORM
`EntityManager` holding the transaction, and Debezium streaming Postgres changes into Kafka. The
rules hold for any broker with at-least-once delivery.

## Command and event are different messages, and the difference is who may say no

A **command** names an intent, has exactly one logical handler, and the sender cares that it
succeeded. An **event** names something that already happened, has zero or more subscribers, and the
publisher must not care whether anyone listened. Hohpe and Woolf separate Command Message from Event
Message for exactly this reason: they have different failure semantics, and collapsing them produces
a system where publishing a fact can fail because a subscriber is unhappy.

The rules that fall out:

- **Name events in the past tense and commands in the imperative.** `PaymentCaptured` is a fact and
  cannot be rejected; `CapturePayment` is a request and can be. A message called `UpdateScore` on a
  publish-subscribe channel is a design error wearing a name.
- **An event carries what happened, not what to do next.** The moment a payload contains
  `shouldSendEmail: true` the publisher has taken a decision that belongs to the subscriber, and
  every new subscriber becomes a change to the publisher.
- **A publisher never awaits its subscribers' work.** If the caller needs the result, that is a
  command or a synchronous call, not an event.
- **Every message carries a correlation identifier** (Hohpe and Woolf, Correlation Identifier) so one
  user action can be traced across every hop it caused. W3C Trace Context is the portable spelling of
  the same idea when the transport can carry headers; when it cannot, the field goes in the payload
  and is propagated by hand.

## Delivery is at-least-once, so every consumer is idempotent

No broker worth using offers exactly-once end-to-end delivery, because the acknowledgement can be
lost after the work is done. Pat Helland's *Idempotence Is Not a Medical Condition* (ACM Queue, 2012)
is the clearest statement of the consequence: the receiver, not the transport, is where duplicate
tolerance lives. Hohpe and Woolf call the shape Idempotent Receiver.

Two ways to get it, in order of preference:

1. **Make the effect naturally idempotent.** An UPSERT to an absolute value, a state transition
   guarded by the current state, a full recomputation from the source of truth — replaying these
   changes nothing. Prefer this every time it is available; it needs no extra table and no extra
   failure mode.
2. **When the effect is a delta or an external side effect**, record that the message was handled in
   the same transaction as the effect. Crediting points, sending mail, charging a card and appending
   to a ledger are all deltas.

The second form is the one people get subtly wrong, so here it is complete:

```ts
// A consumer that is safe to receive the same message twice.
// The dedupe row and the effect commit in ONE transaction, so there is no window in
// which the points are credited but the message is not yet recorded as handled.
@Injectable()
export class PointsAwardedHandler {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager: EntityManager,
    ) {}

    async handle(message: InboundMessage<PointsAwardedPayload>): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            // The key is the PRODUCER's id for this message, not one minted on arrival:
            // a redelivery repeats the producer's id, a genuinely new message does not.
            const claim = await manager
                .createQueryBuilder()
                .insert()
                .into(ProcessedMessageEntity)
                .values({ messageId: message.id, consumer: PointsAwardedHandler.name })
                .orIgnore()                       // ON CONFLICT DO NOTHING
                .execute()

            if (claim.identifiers.length === 0) {
                return                            // already handled — the delta below must not run again
            }

            await manager.increment(
                ScoreEntity,
                { accountId: message.payload.accountId },
                "points",
                message.payload.amount,
            )
        })
    }
}

// Wrong: the check and the effect are two transactions, so a crash between them
// either loses the credit or applies it twice.
if (await this.processed.exists(message.id)) return
await this.scores.credit(message.payload)
await this.processed.record(message.id)
```

The unique index on `(messageId, consumer)` is what makes this work — per consumer, because two
subscribers to the same event must each handle it once. The ledger needs a retention policy; rows
older than the broker's maximum redelivery window are dead weight.

This rule is machine-checkable at the cheapest possible price: a consumer test that calls `handle`
twice with the same message and asserts the resulting row is identical. Make it a required test for
every consumer rather than a review item — nobody catches a missing idempotency guard by reading.

## Publishing and writing must be one atomic act

The classic bug is a handler that commits a database transaction and then publishes an event. If the
process dies between the two, the state changed and nobody was told, forever. Publishing first is
worse: subscribers act on a fact that was rolled back. Pat Helland's *Life Beyond Distributed
Transactions* (2007) is the reason there is no third option — across two systems you get exactly one
atomic unit, and everything else is compensation.

Chris Richardson's **Transactional Outbox** (*Microservices Patterns*, 2018; microservices.io) is the
standard answer: the message is inserted into an outbox table inside the same transaction as the
state change, and a separate publisher moves rows from the table to the broker. The publisher is
allowed to send duplicates, which is fine, because consumers are idempotent.

The publisher half comes in two forms, both named by Richardson:

- **Polling publisher** — a job reads unsent outbox rows on an interval. Simple, adds latency, adds
  load, and needs `FOR UPDATE SKIP LOCKED` or an equivalent so two instances do not send the same
  row.
- **Transaction log tailing** — a change data capture process reads the database's replication log
  and publishes from it. This is what Debezium does. It costs no application code and no polling, at
  the price of an operational component and of messages shaped like rows rather than like domain
  facts.

A codebase that already streams its Postgres write-ahead log through Debezium into Kafka **already
has the outbox guarantee** for anything derived from row changes, because the log is the commit. Do
not add an outbox table alongside it for the same data. Do add one when the message needs to be a
domain event with its own payload and name rather than a row diff — the usual move is to write the
domain event into an outbox table and let the same CDC stream carry it, which keeps one publishing
mechanism instead of two.

## Ordering is a partition-level guarantee, and asking for more is expensive

Log-based brokers guarantee order **within a partition only** (Kleppmann, *Designing Data-Intensive
Applications*, 2017, ch. 11; the Kafka documentation states the same). Subject-based brokers without
a log guarantee less than that. So:

- **Choose a partition key equal to the entity whose ordering matters** — the aggregate identifier,
  the account, the conversation. Two messages about the same entity then arrive in order; two
  messages about different entities have no relationship, which is the honest description of reality
  anyway.
- **Accept the cost that comes with it.** One slow key blocks its whole partition, and the number of
  partitions is a hard ceiling on consumer parallelism within a group. Both are why the key should be
  as fine-grained as the ordering requirement allows and no finer.
- **Where order cannot be guaranteed, carry a version and reject the stale message** rather than
  pretending. A payload with the source row's version or updated-at, compared against the target
  before writing, turns an out-of-order delivery into a no-op. This is the same mechanism as Fowler's
  Optimistic Offline Lock (*Patterns of Enterprise Application Architecture*, 2002) applied to a
  message.
- **A message that cannot be handled goes to a Dead Letter Channel** (Hohpe and Woolf), not into an
  infinite retry loop, because a poison message on an ordered partition stops every message behind
  it. See `background-jobs.md` for how the dead letter is drained.

## Schema evolution: additive forever, and readers tolerate what they do not know

A published message has consumers you did not write and cannot redeploy in step with you. The
compatibility rules that Confluent's Schema Registry enforces for Avro (backward, forward, full) are
worth knowing even when no registry is in play, because they name what you are promising:

- **Adding an optional field is safe. Removing a field, renaming one, or narrowing its type is a
  breaking change.** Repurposing an existing field is the worst of the three because nothing fails
  loudly.
- **Consumers must ignore fields they do not recognise** — the tolerant reader — so that producers
  can add without a coordinated release.
- **A genuinely incompatible change gets a new message type**, published alongside the old one until
  every consumer has moved, then the old one is retired. This is Fowler and Ambler's expand-contract
  (*Refactoring Databases*, 2006) applied to a wire format rather than a table.
- **Store the payload in a schemaless column** — `jsonb` rather than a wide set of typed columns —
  when the message is persisted on the way through. A new field then costs no migration, and the
  strong typing that matters lives in the TypeScript type the consumer parses into.

## Choreography until the flow stops being readable, then orchestration

A multi-step business flow that spans several components is a saga (Garcia-Molina and Salem, *Sagas*,
1987; Richardson, *Microservices Patterns*, 2018), and it comes in two shapes.

**Choreography** — each participant reacts to the previous one's event. Nothing coordinates, coupling
is lowest, and each step can be deployed alone. Its failure mode is that the flow exists nowhere: to
answer "what happens after a payment is captured" you grep for subscribers, and no file describes the
sequence.

**Orchestration** — one component owns the sequence as an explicit state machine and issues commands
to participants. The flow is readable in one file and its state is queryable. Its failure mode is
that the orchestrator accumulates business logic that belongs to the participants, and becomes a
component nobody can change safely.

The portable rule is a threshold, and it is judgement rather than a check: **choreograph two or three
steps; orchestrate once the flow has four or more participants, needs a visible state, or needs
compensation.** The moment somebody has to draw the sequence on a whiteboard to explain it, the
sequence should have been a state machine.

Both shapes need compensating actions rather than rollbacks, because the earlier steps have already
committed. A compensation is a new business fact — a refund, a release of a reservation — not an
undo, and it must be designed with the same care as the forward step.

## The registration hazard

A subscription that must be declared in two places will eventually be declared in one. The common
spelling is an enum of subject names plus a module registration listing the subjects to subscribe to:
adding to the enum and forgetting the registration produces a publish that succeeds, a handler that
never runs, and no error anywhere. It is the single most expensive silent failure in this style of
messaging, because the symptom appears in a different component from the mistake.

This one is machine-checkable and should be checked rather than remembered: assert at boot that every
member of the subject enum appears in the subscribed set, and fail startup if it does not. A test
that imports both and compares them is enough. Prefer eliminating the second declaration entirely —
derive the subscription list from the enum — since a rule that no longer has two places to disagree
needs no gate.

## Sources

- Gregor Hohpe and Bobby Woolf, *Enterprise Integration Patterns* (2003) — Command Message, Event
  Message, Idempotent Receiver, Dead Letter Channel, Correlation Identifier.
- Pat Helland, *Life Beyond Distributed Transactions* (2007) and *Idempotence Is Not a Medical
  Condition* (ACM Queue, 2012).
- Chris Richardson, *Microservices Patterns* (2018) and microservices.io — Transactional Outbox,
  Polling Publisher, Transaction Log Tailing, Saga.
- Hector Garcia-Molina and Kenneth Salem, *Sagas* (1987).
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017), ch. 11.
- Martin Fowler and Scott Ambler, *Refactoring Databases* (2006) — expand and contract.
- Confluent Schema Registry compatibility types (backward, forward, full).
- W3C Trace Context, for correlation across services.

Related: `background-jobs.md` (retries, dead-letter drainage and the worker side of a consumer) and
`cqrs-and-projections.md` (what a CDC stream is consumed *for*).
