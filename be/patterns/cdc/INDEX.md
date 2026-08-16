---
id: be-patterns-cdc-index
title: INDEX.md
slug: /be/patterns/cdc
sidebar_label: cdc
sidebar_position: 0
description: Binding rules for turning a committed source row into a recomputed read projection.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `cdc`

## Law

CDC turns committed source rows into recomputed read projections. A projection listener does not
replay business commands and does not apply a second write delta; it translates one database change
into the stable identity of a projection, then rebuilds that projection from source truth.

The deciding question is:

> Would processing the same row change twice produce the same projection?

If the answer is no, the code is not a CDC projection — whatever it is named, whatever topic it
subscribes to.

**This is binding, not advisory.** Every file whose name ends `projection.listener.ts` carries a CDC
situation, and every one of the situations below has a code. There is no projection small enough to
be exempt: a listener that follows one table and writes one counter answers to `CDC-4` for the same
reason a listener that fans four topics into two aggregates answers to `CDC-3`. "It only ever gets
one event" is not an exemption — it is a prediction about delivery that the broker is under no
obligation to keep.

The reason the law is shaped around replay rather than around correctness-on-first-delivery is that
a broker gives you at-least-once and nothing more. Duplicate delivery is not a fault to be handled;
it is the contract. Code that is only correct when each message arrives exactly once is code that
has quietly assumed a guarantee nobody offered it.

## Situation Codes

Every situation this module governs carries a code, `CDC-<n>`. The code names the SITUATION; the
requirement column names what that situation obliges. The numbers are fixed and are cited from other
law files and from task records — a code is never renumbered, and a code is never retired by
reusing its number for something else.

| Code | Requires | Forbids |
|---|---|---|
| `CDC-1` | Every concrete `*projection.listener.ts` extends `AbstractProjectionListener`; connection, subscription, envelope parsing and failure isolation live in that base | A projection listener with its own `onModuleInit`, its own consumer, its own parsing or its own error policy |
| `CDC-2` | A declared `groupId` that is the durable identity of the projection consumer, and a `topics` array that is the complete set of sources able to invalidate it | A generated, random or instance-scoped group; an implicit or inherited topic set |
| `CDC-3` | `deriveTargets` reads the changed row and returns projection identities; `recomputeTarget` delegates to the projection service | Business commands, side effects or SQL policy inside the listener |
| `CDC-4` | Recompute rebuilds the projection with an UPSERT from authoritative rows | Updating a projection by adding the delta carried by the event |
| `CDC-5` | A payload with no `after` image is skipped; delete repair comes from another retained source or a purpose-built deletion stream | Treating a tombstone as an empty entity and writing that emptiness through |
| `CDC-6` | Parse or recompute failure is logged with topic and consumer group and isolated to that one message | Throwing out of the message handler and stalling the consumer loop |
| `CDC-7` | An operational E2E publishes through the real broker and waits for the database projection | Calling `deriveTargets`, `recomputeTarget` or a listener method directly and calling that a CDC test |

`CDC-4` IS THE ROOT, THE OTHERS ARE ITS CONDITIONS. Idempotent recompute is what makes `CDC-6`
survivable — a swallowed message is repairable only because the next change to the same row rebuilds
the same target from scratch. It is what makes `CDC-2` affordable: a stable group can resume from a
committed offset precisely because re-processing near the boundary changes nothing. Break `CDC-4`
and the other six stop being safe; they do not merely become untidy.

The numbering has no meaning beyond identity. `CDC-1` is not more severe than `CDC-7`, and the codes
do not form a scale.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means the wrong value cannot be written;
`enforced` means a lint rule in [`sources/be/cdc.mjs`](../../../sources/be/cdc.mjs) reports it;
`documented` means only a reader holds it.

| Code | Tier | Held by | Not held |
|---|---|---|---|
| `CDC-1` | `enforced` | `starci-be/projection-listener-contract`, messages `base` (superclass is not `AbstractProjectionListener`) and `lifecycle` (a concrete listener declares `onModuleInit`) | A listener that injects a consumer and runs it from the constructor or from a method named anything other than `onModuleInit` |
| `CDC-2` | `documented` | — | `projection-listener-contract` message `member` reports a MISSING `groupId` or `topics`; it never reads their values, so `groupId = randomUUID()` and a topic list built from a wildcard both pass |
| `CDC-3` | `documented` | — | The same `member` message reports a missing `deriveTargets` or `recomputeTarget`; it does not look inside either body, so a repository write inside `deriveTargets` passes |
| `CDC-4` | `documented` | — | Nothing reads the SQL or the service call; `increment(...)` and `recompute(...)` are equally valid identifiers to a linter |
| `CDC-5` | `documented` | — | The skip lives in the shared base, so no rule needs to fire while the base is used; a listener that re-implements unwrapping is caught by `CDC-1`, not by a tombstone rule |
| `CDC-6` | `documented` | — | Same as `CDC-5`: isolation is a property of the base's `handleMessage`, not of any concrete listener a rule could inspect |
| `CDC-7` | `documented` | — | No rule relates a listener to a test that exercises it; a projection with no operational E2E is indistinguishable from one whose E2E lives in another file |

Six of seven rows read `documented`, and that is the honest reading rather than a gap to be papered
over. Two of the six (`CDC-5`, `CDC-6`) are documented for a good reason: the behaviour is
centralised in the base class, so the enforceable statement about them is already `CDC-1`. The other
four are unheld work, and [`audit.md`](./audit.md) states, for each, what a rule would have to see.

## Anchor

A law that cannot be pointed at in real code is a proposal. Each code names source that can be read
today and the exact thing to read it for.

| Code | Anchor | What to look for |
|---|---|---|
| `CDC-1` | `src/modules/platform/projection/abstract-projection.listener.ts` | The single `onModuleInit` that calls `ensureTopics`, `createConsumer`, `subscribe` and `run`; then that all 17 files matching `src/modules/**/*projection.listener.ts` declare no lifecycle method of their own |
| `CDC-2` | `src/modules/bussiness/projections/user-xp/user-xp-projection.listener.ts` | `groupId = "user-xp-projection"` as a string literal, and `topics` built from `envConfig().kafka.cdcTopicPrefix` plus explicit table names — the prefix is environment-scoped, the table set is not |
| `CDC-2` | `src/tests/helpers/projection-cdc-world.ts` | `PROGRESS_GROUP` / `USER_XP_GROUP` repeating the production group ids as constants; a group a test can name from outside the process is a group that survives a restart |
| `CDC-3` | `src/modules/bussiness/projections/progress/progress-projection.listener.ts` | `deriveTarget` branching on `topic.endsWith(...)` and returning `{ userId, courseId }` or `null`; `recomputeTarget` containing one call to the projection service and nothing else |
| `CDC-4` | `src/modules/bussiness/projections/user-xp/user-xp-projection.service.ts` | `recompute` takes a user id and no amount; the SQL selects `SUM(x.amount)` from the ledger and ends `ON CONFLICT (user_id) DO UPDATE SET value = EXCLUDED.value` |
| `CDC-5` | `src/modules/platform/projection/abstract-projection.listener.ts` | `unwrapRow` returning `null` when `after` is present but empty, and `handleMessage` returning early on `row === null` and on an absent `message.value` |
| `CDC-6` | `src/modules/platform/projection/abstract-projection.listener.ts` | The `catch` in `handleMessage` building a typed CDC exception, logging it with `groupId` and `topic`, and not rethrowing |
| `CDC-7` | `src/tests/e2e/projection-cdc-routing.e2e-spec.ts` | `world.publishChange(...)` followed by `until(...)` polling the projection table — the arrange step writes source rows, the act step touches only the broker |

Every code is anchored. No code carries `chưa neo được` in this version.

## Inputs

| Input | Evidence required |
|---|---|
| source tables | Every table whose change can invalidate the projection, named |
| target identity | The key the projection is stored under, and how a row resolves to it |
| recompute query | The authoritative query that rebuilds one target from source rows |
| delivery | Consumer group id, and whether the projection is proved through a broker |
| deletion | What repairs the projection when a source row disappears |

## Invariants

- Processing the same row change twice produces the same projection.
- The base class owns connection, subscription, parsing and failure isolation.
- A consumer group id is a constant, not a value computed at boot.
- The topic list is the complete invalidation set; an unlisted source means a stale projection, not
  a slower one.
- `deriveTargets` returns identities and performs no business side effect.
- A projection is written by UPSERT from source rows, never by applying an event's delta.
- A payload with no current row image produces no write.
- One failed message affects one message.
- A CDC claim is proved through a broker or it is not a CDC claim.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Boot is best-effort (`CDC-1`).** Subscription failure at startup is logged and swallowed rather
  than crashing the process, because a broker outage must not take the API down with it. This is an
  exception about AVAILABILITY, not about ownership: the swallow lives in the base, and a concrete
  listener still declares no lifecycle of its own.
- **Reads inside `deriveTargets` (`CDC-3`).** Resolving a parent id — a submission to its milestone,
  a content row to its course — is a read and is allowed, because mapping a row to an identity
  sometimes requires the graph. A write inside `deriveTargets` is never allowed, and the test is
  whether replay would repeat an effect.
- **An empty target list (`CDC-3`, `CDC-5`).** Returning `[]` is the correct answer for an
  irrelevant column change, an unresolvable parent or a delete. Skipping is a decision the code is
  entitled to make; inventing a target to avoid an empty return is not.
- **A projection that genuinely needs deletes (`CDC-5`).** Consume a retained source that still
  carries the identity, or a purpose-built deletion stream. Reading the tombstone key and treating
  the absence as a zero row is refused even when the zero happens to be correct today.
- **A unit test on mapping (`CDC-7`).** Calling `deriveTargets` directly is a legitimate test of
  mapping code. It is refused only as EVIDENCE OF CDC — one operational E2E through the broker is
  owed regardless of how many mapping tests exist.

## Output

```text
projection: <projection name>
sources: <tables that can invalidate it>
groupId: <stable consumer group>
target: <identity a row resolves to>
recompute: <authoritative query, upsert key>
situation: <CDC-1 | CDC-2 | CDC-3 | CDC-4 | CDC-5 | CDC-6 | CDC-7>
reason: <the replay fact that decides it>
```

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for the business situation behind each code,
[`example.md`](./example.md) for the cases, exceptions and request mapping of every code, and
[`audit.md`](./audit.md) only while reviewing the canon.

## Scope

This module states a rule true of any service that projects committed rows into read models. Every
example is ordinary TypeScript in a NestJS-shaped class; no product, no brand and no private module
name appears in one. The `## Anchor` table is the single exception, and deliberately so: it cites
real source paths in the repository this trust tree governs, because a law nobody can check against
running code is a proposal.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in
[`changelog.md`](./changelog.md).
