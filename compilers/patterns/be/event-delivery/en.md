---
title: Event-delivery
---

# Event-delivery

The input to this pattern is an accepted shape: a decision already taken, expressed as a fact that
some code somewhere must react to. The design question — whether the fact matters, who cares about
it, what it means — is closed before this pattern is read. The output is source architecture: which
file builds the envelope, which file declares the transport, which file drops the self-origin copy
and claims the digest, which test file proves it, and in what order the statements inside those files
must stand.

## Law

Event delivery carries an **already-decided fact** from one application instance to every instance
that must react locally. The envelope identifies the producer and the delivery; the payload carries
the fact. A broker is transport; the in-process emitter remains the fan-out boundary where the fact
becomes a local consequence.

The question that settles every case is not which transport was used but what happens on the second
arrival: **can the same envelope return to its producer, or arrive twice, without causing the local
consequence twice?** A cross-instance event is safe only when both answers are yes. One "no" is not
a slow event or a noisy log — it is the consequence running twice, and a consequence that runs twice
is a second charge, a second notification, a second write.

**This is binding, not advisory.** Every event that leaves the process resolves to exactly one code
below, and so does every event that deliberately does not leave it. There is no event small enough
to be exempt: a heartbeat declares its transport for the same reason a payment fact does, because
the declaration is what a reader checks against, and a fact with no declaration is a fact nobody can
be shown to have got wrong.

Only two of the six codes have a rule behind them, and both of those live at one file boundary. The
Layer held table below says exactly which is which, because a law that implies uniform enforcement it
does not have teaches a reader to trust a gate that was never watching.

## Situation codes

Every situation this module governs carries a code, `DELIVERY-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | Situation | What the source must look like |
|---|---|---|
| `DELIVERY-1` | An envelope leaves the process and the receiver must know who published it and whether it is a copy | The transport envelope carries producer identity and a content digest alongside the payload. It never derives producer identity from the subject, the connection or the receipt order, and never publishes a payload with no stable idempotency key |
| `DELIVERY-2` | An event must reach either this process only, or every process holding a connection | Every event declares `useLocal` and `useNats` in the central event config. Transport is never inferred at the call site, and neither flag is ever left off an event for the reader to guess |
| `DELIVERY-3` | The envelope returns to the very instance that published it | The bridge compares the parsed envelope's producer id with this instance's id and drops the match before local emit. It never compares the subject to an instance id, never filters self-origin after emit, and never skips the check because "the producer will not receive its own message" |
| `DELIVERY-4` | The broker redelivers the same envelope a second time | The digest is checked and recorded before the local emit. The digest is never recorded after emit, deduplication never lives in the listener, and "at most once in practice" is never treated as a guarantee |
| `DELIVERY-5` | Realtime correctness has to be proved | A consumer test asserts which actor received which fact, and that an uninvolved actor received nothing. It never asserts a listener count, a message count, or a number of connected sockets |
| `DELIVERY-6` | Cross-instance fan-out has to be proved | Cross-instance behaviour is proved by two real instances on a real broker, publishing once. The broker is never mocked, the local emitter is never called directly, and fan-out is never proved from one booted instance |

Six codes, and it ends at six. A situation that genuinely has no code is a recorded rule change, not
a seventh number added in passing.

## Reading an accepted shape

1. Read what the shape states: the fact already decided, and the payload that expresses it with no
   further branching to do.
2. Read what the shape does **not** state, and accept that it therefore resolves nothing there. An
   accepted shape does not state the transport pair, where producer identity comes from, where the
   digest is claimed relative to emit, or how many instances the proof runs on. Those are this
   pattern's output, not the shape's.
3. Resolve outermost first: transport before envelope, envelope before bridge order, bridge order
   before proof. What the event declares in config decides whether there is an envelope at all;
   without an envelope there is nothing for the bridge to compare or claim.
4. Ask each code's question in turn. `DELIVERY-1`: if this same envelope arrived twice by two
   different routes, what would let me recognise them as one? `DELIVERY-2`: who must react to this
   fact — only the process that decided it, or every process holding a user connection?
   `DELIVERY-3`: does producer identity in this code come from the envelope, or from the event name?
   `DELIVERY-4`: between reading the digest and writing it, is there any call that causes a business
   consequence? `DELIVERY-5`: if infrastructure adds one more subscriber tomorrow without changing
   the business, does this assertion go red? `DELIVERY-6`: if I delete the self-origin guard, does
   this test go red?
5. When two codes both match, they are not competing — they are two files. `DELIVERY-1` produces the
   digest and `DELIVERY-4` decides where it is claimed; `DELIVERY-2` decides whether the event goes
   and `DELIVERY-1` decides what it carries when it does; `DELIVERY-5` says what to assert and
   `DELIVERY-6` says how many instances to assert it on. Emit an output block per code, each naming
   the fact that excludes the adjacent one. Only when both codes would put the same statement in the
   same file does the outermost of the two win.

## `DELIVERY-1` — the envelope declares its producer and its copy

**Situation.** A fact already decided is about to leave the process. At the far end the receiver must
answer two questions the payload cannot answer: *who published this?* and *have I already handled
this exact content?* Those two questions are the envelope's job.

**What it emits in source.** An envelope factory that builds the message with `id` taken from the
instance service and `digest` hashed from the payload, never from the subject; and an envelope type
declaring that obligation, where `digest` being optional is visible in the interface itself.

**Recognition signs.** Code wants to infer the producer from the **subject**, from the connection, or
from receipt order. The payload has no stable field to serve as a duplicate key. Somebody says "the
broker guarantees exactly once" without pointing at the configuration that says so.

**Boundary.** Not `DELIVERY-3`: this code is about the envelope *having* producer identity, while
`DELIVERY-3` is about *using* that identity at the right moment — without the first, the second
cannot be correct. Not `DELIVERY-4`: this code produces the digest, while `DELIVERY-4` decides where
in the flow the digest is claimed.

**Common business situations.** A new message in a conversation · a background job changing state ·
progress on a submission · a health snapshot of an external provider · a notification for one
recipient · a heartbeat keeping a connection alive, which is the only case allowed to omit the
digest.

## `DELIVERY-2` — transport is part of the event contract

**Situation.** One kind of fact needs only code in **this same process** to react; another needs to
reach sockets plugged into **another pod**. That decision belongs to the definition of the event, not
to the place that calls it.

**What it emits in source.** One central event config in which every entry declares both `useLocal`
and `useNats`, several carrying a comment naming why one is still `false`; and an emitter that reads
exactly those two flags to choose its branches, so the config is the contract and not a hint.

**Recognition signs.** A call site passes a transport option so that "this time it goes over the
broker". A config entry is missing one of the two flags and the reader has to guess. A realtime event
only behaves correctly while the system runs exactly one instance, and nothing records that.

**Boundary.** Not `DELIVERY-1`: this code decides **whether it goes**, while `DELIVERY-1` decides
**what it carries when it does**. Not `DELIVERY-6`: declaring `useNats: true` is a promise, while
`DELIVERY-6` is where that promise is made to prove itself.

**Common business situations.** Multi-pod chat, both flags · job status for workers, broker only ·
internal heartbeat, local only · reactions and comments still single-instance, local with a note
recording the condition that flips the flag · a health snapshot each pod re-emits to its own clients.

## `DELIVERY-3` — drop your own envelope before emitting

**Situation.** Pod A publishes an event that is both local and broker-carried. The broker redelivers
to **every** subscriber, A included. If A does not recognise the envelope as its own, A emits locally
a second time and the consequence happens twice on the very pod that created it.

**What it emits in source.** A guard in the bridge, above the ping branch, comparing the parsed
envelope's `parsed.id` with the instance id and returning on a match — placed before the emit call,
and carrying the comment recording the bug the subject comparison caused. The rule checks that the
comparison exists *and* precedes the emit; order is the whole content of the code.

**Recognition signs.** The bug appears only for users plugged into **the pod that just wrote the
data**. There is a comparison between `subject` and an instance id — a comparison that **never**
matches, so it stays silent and looks like it is working. The guard exists but sits **after** the
emit call.

**Boundary.** Not `DELIVERY-4`: this code blocks the **producer's own echo**, while `DELIVERY-4`
blocks the **broker's redelivery**; dropping either leaves a distinct hole open. Not `DELIVERY-2`: if
the event is local only there is no envelope to drop, so this code speaks only about the broker
branch.

**Common business situations.** A message showing twice for the person who just sent it · a doubled
push notification for whoever is plugged into the writing pod · a progress bar jumping two steps on
the very pod running the worker.

## `DELIVERY-4` — claim the digest before emitting

**Situation.** The broker redelivers. The network blinks, the consumer reconnects, the same envelope
arrives a second time. If the digest is written only **after** the emit, two copies running in
parallel both read "not seen" and **both** cross the business boundary.

**What it emits in source.** A digest get/set pair in the bridge: read the digest, record the digest,
then emit — three statements whose order is the invariant, and the order the rule's second message is
aimed at.

**Recognition signs.** The order in the code is emit first, `set` digest after. Deduplication lives
in the listener instead of the bridge. Somebody offers "in practice it does not redeliver" in place
of a configuration proving it.

**Boundary.** Not `DELIVERY-3`: see above. Not `DELIVERY-1`: if the envelope carries no digest there
is nothing here to claim — the fault is then `DELIVERY-1`, and fixing it here is fixing the wrong
place.

**Common business situations.** A consumer reconnecting after a dropped link · several consumers in
one queue group · redelivery caused by a late ack · an event republished when a worker restarts
mid-flight.

## `DELIVERY-5` — assert recipient and content, do not count listeners

**Situation.** Something realtime has to be proved **correct**. Correct here means: the **right
actor** received the **right fact**, and an uninvolved actor received **nothing**. A listener count
says none of those three things.

**What it emits in source.** A consumer end-to-end test whose assertions name the recipient row and
the payload type, and whose own title claims the negative — the fact did not leak to another socket.
No assertion anywhere counts listeners.

**Recognition signs.** The assertion is a number: how many listeners, how many messages, how many
sockets. The test goes red when a pod or a subscriber is added even though the business did not
change. The test stays green while the fact is delivered to the **wrong person**, because the number
is still right.

**Boundary.** Not `DELIVERY-6`: this code says **what to assert**, while `DELIVERY-6` says **how many
instances to run on**. A test can satisfy this code and still fail the other.

**Common business situations.** A notification reaching only its intended recipient · a message
reaching only the right room · progress reaching only the person who submitted · someone without
permission receiving nothing.

## `DELIVERY-6` — prove it on two real instances

**Situation.** The contract to be proved is: publish **once** on A and B receives **exactly once**,
and A does not echo back to itself. No clause of that sentence exists inside a single process.

**What it emits in source.** A cross-instance end-to-end test plus its world helper, booting two
independent instances on a shared real broker, where the helper counts broker messages so the
origin's "exactly one delivery" is proved after its echo arrived, not before it could have.

**Recognition signs.** The test calls the local event emitter directly and then concludes something
about fan-out. The broker is mocked, so self-echo never happens and the guard has never been tried.
Only one app is booted, and the "second instance" is a variable.

**Boundary.** Not `DELIVERY-5`: see above. The closed exception is that the two instances may boot a
reduced module graph and substitute infrastructure that is not the subject — retry, logging, digest
cache — provided the publisher, the envelope factory, the bridge and the broker are the production
ones.

**Common business situations.** Cross-pod chat · a notification to someone plugged into another pod ·
job status updated by a worker on another pod · a health snapshot re-emitted on every pod.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a lint rule in `@starci/eslint-canon-be`
catches it; `documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `DELIVERY-1` | `documented` | — |
| `DELIVERY-2` | `documented` | — |
| `DELIVERY-3` | `enforced` | `nats-bridge-delivery-contract` (export `natsBridgeDeliveryContract`), message `origin` |
| `DELIVERY-4` | `enforced` | `nats-bridge-delivery-contract` (export `natsBridgeDeliveryContract`), message `digest` |
| `DELIVERY-5` | `documented` | — |
| `DELIVERY-6` | `documented` | — |

**Two enforced, four documented, none unrepresentable.** The module publishes exactly one rule; that
rule holds two codes because it reports two distinct messages, `origin` and `digest`, and each
message fails independently. Two codes per rule is the honest count here — one rule is not
automatically one code, and pretending otherwise would understate what the gate actually catches.

The gap is the point of this table rather than a defect in it. Four of these codes are properties of
a decision made somewhere other than the file a rule can be aimed at: `DELIVERY-1` is a property of
what a factory puts in an envelope, `DELIVERY-2` of a config object with no type forcing its shape,
and `DELIVERY-5` and `DELIVERY-6` of what a test chose to assert and how many processes it booted.
Every `documented` row is named again in the module's audit record under its open risks, with what a
rule would have to see in order to hold it — or why no rule can.

The enforced rows are enforced at `error`. Both fire on one file path only, which is a real bound on
the gate and is recorded as such in the audit record rather than hidden behind the word `enforced`.

The layers that must stay ignorant of this concern are the ones on either side of the bridge: the
deciding code publishes a fact and knows nothing of transport, and the listener reacts to a local
emit and knows nothing of producer identity, digests or redelivery. Deduplication in the listener is
the shape this pattern refuses.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `DELIVERY-1` | `modules/platform/event/nats/nats-message-factory.service.ts` → `createMessage` · `modules/platform/event/nats/types.ts` → `NatsMessage` | The envelope is built with `id` taken from the instance service and `digest` hashed from the payload, never from the subject. The interface is where the envelope's obligation is declared, and where `digest` being optional is visible |
| `DELIVERY-2` | `modules/platform/event/config.ts` → `configMap` · `modules/platform/event/event-emitter.service.ts` → `emit` | Every entry declares both flags, and several carry a comment naming why one is still `false`. The emitter reads exactly those two flags to choose its branches, so the config is the contract and not a hint |
| `DELIVERY-3` | `modules/platform/event/nats/nats-bridge.service.ts` → the guard above the ping branch · `@starci/eslint-canon-be` → `originIndex > emitIndex` | The guard compares `parsed.id` with the instance id, and carries the comment recording the bug the subject comparison caused. The rule checks the comparison exists *and* precedes the emit — order is the whole content of the code |
| `DELIVERY-4` | `modules/platform/event/nats/nats-bridge.service.ts` → the digest get/set pair · `@starci/eslint-canon-be` → `digestIndex > emitIndex` | Read the digest, record the digest, then emit — three statements whose order is the invariant. The rule's second message is aimed at exactly that order |
| `DELIVERY-5` | `tests/e2e/notification-delivery.e2e-spec.ts` | The assertions name the recipient row and the payload type, and the test's own title claims the negative: the fact did not leak to another socket. No assertion anywhere counts listeners |
| `DELIVERY-6` | `tests/e2e/cross-instance-event-routing.e2e-spec.ts` · `tests/helpers/nats-cross-instance-world.ts` | Two independently booted instances share a real broker; the helper counts broker messages so the origin's "exactly one delivery" is proved after its echo arrived, not before it could have |

Every code is anchored. None reads "not yet anchored".

## Inputs

| Input | Evidence required |
|---|---|
| fact | The decision already taken, expressed as a payload with no further branching to do |
| reach | Which instances must react: this process only, or every process holding a connection |
| transport | The `useLocal` and `useNats` pair the event declares |
| identity | Where producer identity comes from in the envelope |
| idempotency | The digest, and the point at which it is claimed |
| consequence | The local effect the emit causes, and what a second copy of it would cost |
| proof | The number of real instances the behaviour was observed on |

## Rules

1. An envelope carries producer identity and digest; a subject carries neither.
2. Transport is declared per event in one config, not chosen per call site.
3. Self-origin is dropped before the local emit, never after it.
4. The digest is claimed before the local emit, never after it.
5. A local consequence happens at most once per fact per instance.
6. Correctness is stated as recipient and content; topology is not part of it.
7. Cross-instance fan-out is proved on more than one instance.
8. Every published event resolves to exactly one code. No event is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Heartbeat without digest.** `DELIVERY-1` permits an envelope built with the digest omitted when
  the message carries no business fact and exists only to keep a consumer's idle timer alive. It is
  still identified by producer id, and it is skipped before any business handling.
- **Process-private event.** `DELIVERY-2` is satisfied by `useNats: false` when the reacting code
  runs in the same process as the deciding code. What it refuses is the flag being absent, not the
  flag being `false`.
- **Deliberate single-instance realtime.** `DELIVERY-2` admits an event whose fan-out is knowingly
  local for now, provided the config records the condition under which it flips. An undated silence
  is not that record.
- **Re-broadcast on every instance.** `DELIVERY-3` drops the producer's own envelope, not the
  producer's own local emit. An event that is both `useLocal` and `useNats` is emitted once locally
  at publish time and once locally on every *other* instance — that is one consequence per instance,
  which is the rule, not a violation of it.
- **Digest cache scope.** `DELIVERY-4` is satisfied by a process-local claim. A shared claim store
  would suppress the delivery on every instance but the first, which is the opposite of fan-out.
- **Counting a broker message.** `DELIVERY-5` permits counting envelopes observed at the transport
  when the count is a synchronisation point rather than the assertion — it establishes that the echo
  already arrived, so a later assertion about the recipient can mean something.
- **Focused instance graph.** `DELIVERY-6` allows the two instances to boot a reduced module graph
  and substitute infrastructure that is not the subject, provided the publisher, the envelope
  factory, the bridge and the broker are the production ones.

## Output

One block per file the shape produces.

```text
event: <event name>
fact: <the decision already taken>
transport: <useLocal | useNats | both>
situation: <DELIVERY-1 … DELIVERY-6>
identity: <where producer id comes from>
idempotency: <digest, and where it is claimed relative to emit>
proof: <the test that observes this on the required number of instances>
reason: <the business fact that excludes the adjacent code>
```

## Worked example

The accepted shape: *a notification fact is decided on one instance and must reach the one recipient
it belongs to, wherever that recipient's socket happens to be connected.*

That sentence states the fact and the reach. It does **not** state the transport pair, where producer
identity comes from, where the digest is claimed relative to emit, or how many instances the proof
runs on — so it resolves none of those, and each is settled below by a code, not by the shape.

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-2
identity: n/a at this file
idempotency: n/a at this file
proof: the config entry declares both flags and the emitter branches on exactly them
reason: the recipient's socket may be on another pod, so the reach is not this process only — that
  fact excludes the local-only shape DELIVERY-2 would otherwise permit
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-1
identity: id taken from the instance service in the envelope factory
idempotency: digest hashed from the payload, produced here, claimed elsewhere
proof: the envelope type declares id and digest; digest optional is visible in the interface
reason: this file only builds the envelope and never emits, so ordering against emit is not its
  concern — that excludes DELIVERY-4
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-3
identity: parsed.id compared with this instance's id in the bridge guard
idempotency: n/a at this statement
proof: the guard sits above the emit call, and the rule reports origin when it does not
reason: this drops the producer's own echo, not a broker redelivery — that excludes DELIVERY-4
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-4
identity: n/a at this statement
idempotency: digest read then recorded, both before the local emit, in a process-local claim
proof: the rule reports digest when the set does not precede the emit
reason: the envelope already carries a digest, so the fault surface here is ordering and not
  envelope content — that excludes DELIVERY-1
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-5
identity: n/a at this file
idempotency: n/a at this file
proof: a consumer test asserting the recipient row and the payload type, and that an uninvolved
  socket received nothing
reason: the assertion names an actor and a content, not a number — that excludes the listener count
  and stays inside DELIVERY-5 rather than DELIVERY-6
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-6
identity: production envelope factory on both instances
idempotency: production bridge on both instances
proof: two independently booted instances on a real broker, published once, with broker messages
  counted only as a synchronisation point
reason: the claim under proof is that A does not echo to itself and B receives exactly once, which
  no single process can contain — that excludes DELIVERY-5
```

## Scope

This rule holds for any back end that fans one decided fact out across more than one running
instance. It names no product, no repository, no private module and no single feature. Examples are
ordinary TypeScript in a NestJS-shaped application. The broker is named only where the transport's
own semantics are the subject; everywhere else the law holds for any broker that can redeliver. The
rule id is the only proper noun, because it is the enforcement identity and a renamed rule cannot be
cited in a config.
