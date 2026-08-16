---
id: be-patterns-event-delivery-index
title: INDEX.md
slug: /be/patterns/event-delivery
sidebar_label: event-delivery
sidebar_position: 0
description: Binding rules for carrying an already-decided fact from one application instance to every instance that must react locally.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `event-delivery`

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
`Tầng giữ` table below says exactly which is which, because a law that implies uniform enforcement
it does not have teaches a reader to trust a gate that was never watching.

## Situation Codes

Every situation this module governs carries a code, `DELIVERY-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | What it requires | What it forbids |
|---|---|---|
| `DELIVERY-1` | The transport envelope carries producer identity and a content digest alongside the payload | Deriving producer identity from the subject, the connection or the receipt order; publishing a payload with no stable idempotency key |
| `DELIVERY-2` | Every event declares `useLocal` and `useNats` in the central event config | Inferring transport at the call site, or leaving either flag off an event and letting the reader guess |
| `DELIVERY-3` | The bridge compares the parsed envelope's producer id with this instance's id and drops the match before local emit | Comparing the subject to an instance id; filtering self-origin after emit; skipping the check because "the producer will not receive its own message" |
| `DELIVERY-4` | The digest is checked and recorded before the local emit | Recording the digest after emit; deduplicating in the listener; treating "at most once in practice" as a guarantee |
| `DELIVERY-5` | A consumer test asserts which actor received which fact, and that an uninvolved actor received nothing | Asserting a listener count, a message count, or a number of connected sockets |
| `DELIVERY-6` | Cross-instance behaviour is proved by two real instances on a real broker, publishing once | Mocking the broker, calling the local emitter directly, or proving fan-out from one booted instance |

Six codes, and it ends at six. A situation that genuinely has no code is a rule change recorded in
`changelog.md`, not a seventh number added in passing.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write; `enforced` means a lint rule in
[`sources/be/event-delivery.mjs`](../../../sources/be/event-delivery.mjs) catches it; `documented`
means nothing mechanical holds it and only a reader does.

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
Every `documented` row is named again in `audit.md` under "Rủi ro còn mở", with what a rule would
have to see in order to hold it — or why no rule can.

The enforced rows are enforced at `error`. Both fire on one file path only, which is a real bound on
the gate and is recorded as such in `audit.md` rather than hidden behind the word `enforced`.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `DELIVERY-1` | `src/modules/platform/event/nats/nats-message-factory.service.ts` → `createMessage` · `src/modules/platform/event/nats/types.ts` → `NatsMessage` | The envelope is built with `id` taken from the instance service and `digest` hashed from the payload, never from the subject. The interface is where the envelope's obligation is declared, and where `digest` being optional is visible |
| `DELIVERY-2` | `src/modules/platform/event/config.ts` → `configMap` · `src/modules/platform/event/event-emitter.service.ts` → `emit` | Every entry declares both flags, and several carry a comment naming why one is still `false`. The emitter reads exactly those two flags to choose its branches, so the config is the contract and not a hint |
| `DELIVERY-3` | `src/modules/platform/event/nats/nats-bridge.service.ts` → the guard above the ping branch · `sources/be/event-delivery.mjs` → `originIndex > emitIndex` | The guard compares `parsed.id` with the instance id, and carries the comment recording the bug the subject comparison caused. The rule checks the comparison exists *and* precedes the emit — order is the whole content of the code |
| `DELIVERY-4` | `src/modules/platform/event/nats/nats-bridge.service.ts` → the digest get/set pair · `sources/be/event-delivery.mjs` → `digestIndex > emitIndex` | Read the digest, record the digest, then emit — three statements whose order is the invariant. The rule's second message is aimed at exactly that order |
| `DELIVERY-5` | `src/tests/e2e/notification-delivery.e2e-spec.ts` | The assertions name the recipient row and the payload type, and the test's own title claims the negative: the fact did not leak to another socket. No assertion anywhere counts listeners |
| `DELIVERY-6` | `src/tests/e2e/cross-instance-event-routing.e2e-spec.ts` · `src/tests/helpers/nats-cross-instance-world.ts` | Two independently booted instances share a real broker; the helper counts broker messages so the origin's "exactly one delivery" is proved after its echo arrived, not before it could have |

Every code is anchored. None reads `chưa neo được`.

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

## Invariants

- An envelope carries producer identity and digest; a subject carries neither.
- Transport is declared per event in one config, not chosen per call site.
- Self-origin is dropped before the local emit, never after it.
- The digest is claimed before the local emit, never after it.
- A local consequence happens at most once per fact per instance.
- Correctness is stated as recipient and content; topology is not part of it.
- Cross-instance fan-out is proved on more than one instance.
- Every published event resolves to exactly one code. No event is out of scope.

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

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.
`changelog.md` is read when a version marker disagrees with what a record says.

## Scope

This module states a rule true of any back end that fans one decided fact out across more than one
running instance. Examples are ordinary TypeScript in a NestJS-shaped application: they name no
product, no repository and no private module. The broker in the examples is named only where the
transport's own semantics are the subject; everywhere else the law holds for any broker that can
redeliver. The rule id is the only proper noun, because it is the enforcement identity and a renamed
rule cannot be cited in a config.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding, removing or renumbering a `DELIVERY-<n>` code is a major change, not an increment.
