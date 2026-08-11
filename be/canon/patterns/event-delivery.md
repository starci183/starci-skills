# event delivery

## Definition

Event delivery carries an already-decided fact from one application instance to every instance that
must react locally. The envelope identifies the producer and the delivery; the event payload carries
the fact. NATS is transport, while the local event emitter remains the in-process fan-out boundary.

The deciding question is: **can the same envelope return to its producer or arrive twice without
causing the local consequence twice?** A cross-instance event is safe only when both answers are yes.

What holds the central bridge invariants is
[`sources/be/event-delivery.mjs`](../../../sources/be/event-delivery.mjs).

## Rules

**DELIVERY-1 · Every transport envelope carries producer identity and digest.**

Producer identity prevents a pod from replaying its own locally emitted fact; digest gives every pod
a stable idempotency key. Subject names route event kinds and must never be used as producer ids.

**DELIVERY-2 · Local and NATS publication are explicit per event.**

Every event in `configMap` declares `useLocal` and `useNats`. A fact needed by sockets connected to
other pods uses both; a process-private event uses local only. Transport is a declared part of the
event contract, not inferred at the call site.

**DELIVERY-3 · The bridge drops self-origin before local emit.**

The bridge compares the parsed envelope id with `InstanceService.getId()`. Comparing the NATS
subject to an instance id is invalid: a subject names the event and can never identify its producer.

**DELIVERY-4 · The bridge claims the digest before local emit.**

Duplicate delivery is checked and recorded before `EventEmitter2.emit`. Recording afterward leaves
a race where two copies both cross the business boundary.

**DELIVERY-5 · A consumer asserts recipient and content, not listener count.**

Realtime correctness is which actor received which fact. Listener count is deployment plumbing and
changes when pods or sockets change.

**DELIVERY-6 · Cross-instance behaviour is proved with two real application instances.**

The E2E opens clients on separate instances, publishes once, and proves remote receipt without
self-echo. Mocking NATS or calling the local emitter cannot establish this contract.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Comparing a NATS subject to an instance id | Subject identifies event kind, not producer | Compare the parsed envelope producer id |
| Deduplicating after local emit | Concurrent copies can both produce the consequence | Claim/check the digest before emit |
| Omitting `useLocal` or `useNats` from event config | Deployment behaviour becomes an implicit call-site choice | Declare both flags for every event |
| Asserting message count | Pod and listener topology becomes part of business correctness | Assert recipient and payload |
| A single-instance test for cross-instance fan-out | It cannot detect self-echo or remote delivery failure | Boot two instances against real NATS |

## Examples

### Reject self-origin

```ts
if (parsed.id === this.instanceService.getId()) continue
this.eventEmitter.emit(getEventName(subject), parsed.data)
```

```ts
// Wrong: subject is an event name, so this comparison never filters the producer.
if (subject === this.instanceService.getId()) continue
```

They differ in whether producer identity comes from the envelope.

### Claim before emit

```ts
if (await this.cacheService.get({ key, args: [parsed.digest] })) continue
await this.cacheService.set({ key, args: [parsed.digest], cacheResult: true })
this.eventEmitter.emit(eventName, parsed.data)
```

```ts
// Wrong: both redeliveries can emit before either records the digest.
this.eventEmitter.emit(eventName, parsed.data)
await this.cacheService.set({ key, args: [parsed.digest], cacheResult: true })
```

They differ in whether deduplication guards the consequence.

### Prove the topology

```ts
await podA.publish(message)
expect(await podBClient.nextMessage()).toMatchObject(message.data)
await expectNoMessage(podAClient, message.event)
```

```ts
// Wrong: this proves only the local emitter.
podA.eventEmitter.emit(message.event, message.data)
```

They differ in whether NATS and instance identity participate.
