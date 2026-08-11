# cdc

## Definition

CDC turns committed source rows into recomputed read projections. A projection listener does not
replay business commands and does not apply a second write delta; it translates one database change
into the stable identity of a projection, then rebuilds that projection from source truth.

The deciding question is: **would processing the same row change twice produce the same projection?**
If the answer is no, the code is not a CDC projection.

What holds the machine-checkable listener shape is
[`sources/be/cdc.mjs`](../../../sources/be/cdc.mjs).

## Rules

**CDC-1 · The shared listener owns Kafka lifecycle.**

Every concrete `*projection.listener.ts` extends `AbstractProjectionListener`. Connection,
subscription, Debezium envelope parsing and failure isolation stay in that base, because one
listener with private consumer plumbing will eventually disagree about offsets or tombstones.

**CDC-2 · A listener declares a stable group and explicit topics.**

`groupId` is the durable identity of the projection consumer, and `topics` is the complete source
set that can invalidate it. Neither is generated per process. A random group replays history on
every boot; an implicit topic silently leaves a projection stale.

**CDC-3 · The listener maps a change to targets; the service recomputes them.**

`deriveTargets` reads the changed row and returns projection identities. `recomputeTarget` delegates
to the projection service. The listener owns routing, not SQL policy, so replay and direct repair use
the same recomputation path.

**CDC-4 · Recompute is idempotent and source-derived.**

A projection is rebuilt with an UPSERT from authoritative rows. It is never updated by adding the
delta carried by the event, because duplicate delivery would then double the result and a missed
event could never self-heal.

**CDC-5 · Tombstones do not invent current state.**

A Debezium payload with no `after` image has no current row to map. The shared listener skips it;
projections that need delete repair derive that target from another retained source or use a
purpose-built deletion stream.

**CDC-6 · One malformed message does not stop the consumer.**

Parsing or recompute failure is logged with topic and consumer group and is isolated to that
message. Recompute being idempotent is what lets a later source change repair the same target.

**CDC-7 · Delivery semantics are proved against a real broker.**

An operational E2E publishes through Redpanda/Kafka and waits for the database projection. Calling
`deriveTargets`, `recomputeTarget` or a listener method directly proves mapping code but not CDC.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A projection listener with its own `onModuleInit` consumer | It forks subscription, parsing and failure semantics | Extend `AbstractProjectionListener` |
| A random or instance-scoped consumer group | Every restart becomes a new consumer and replays history | Declare a stable projection-specific `groupId` |
| Incrementing a projection from an event delta | Duplicate delivery double-counts and missed delivery cannot heal | Recompute from source rows and UPSERT |
| Business commands inside `deriveTargets` | CDC replay would repeat business side effects | Return projection identities only |
| Treating a tombstone as an empty entity | It fabricates a current row that does not exist | Skip it or consume a deletion-specific source |
| A direct listener call in E2E | It removes broker serialization and consumer-group behaviour | Publish through the real broker and poll the projection |

## Examples

### Recompute from source truth

```ts
protected async recomputeTarget(target: UserCourseTarget): Promise<void> {
    await this.projectionService.recompute(target)
}
```

```ts
// Wrong: a duplicate CDC delivery adds the same points twice.
protected async recomputeTarget(target: UserCourseTarget): Promise<void> {
    await this.projectionService.increment(target.userId, target.pointsDelta)
}
```

They differ in whether replay changes the answer.

### Keep lifecycle in the base

```ts
export class UserXpProjectionListener extends AbstractProjectionListener<UserTarget> {
    protected readonly groupId = "projection-user-xp"
    protected readonly topics = ["primary.public.activities"]
}
```

```ts
// Wrong: this projection now owns a private Kafka lifecycle.
export class UserXpProjectionListener implements OnModuleInit {
    async onModuleInit(): Promise<void> { await this.consumer.run({ eachMessage: this.handle }) }
}
```

They differ in whether every projection shares one delivery contract.

### Prove broker delivery

```ts
await world.cdc.publish(activityRow)
await until(() => world.db.userXp(userId).then((xp) => xp === expectedXp))
```

```ts
// Wrong: no serialization, group, offset or broker delivery is exercised.
await listener.recomputeTarget({ userId })
```

They differ in whether CDC itself is under test.
