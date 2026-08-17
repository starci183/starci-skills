---
title: CDC
---

# CDC

The input to this pattern is a shape that is already accepted: a read model somebody agreed to show, a projection whose numbers a screen depends on, a source table whose changes must reach that screen. This pattern does not re-open that decision. Its output is source architecture — which file the code goes in, which layer owns the connection and which layers stay ignorant of it, what the class extends, what it declares, what it exports, and what a query is allowed to say.

## Law

CDC turns committed source rows into recomputed read projections. A projection listener does not replay business commands and does not apply a second write delta; it translates one database change into the stable identity of a projection, then rebuilds that projection from source truth.

The deciding question is:

> Would processing the same row change twice produce the same projection?

If the answer is no, the code is not a CDC projection — whatever it is named, whatever topic it subscribes to.

**This is binding, not advisory.** Every file whose name ends `projection.listener.ts` carries a CDC situation, and every one of the situations below has a code. There is no projection small enough to be exempt: a listener that follows one table and writes one counter answers to `CDC-4` for the same reason a listener that fans four topics into two aggregates answers to `CDC-3`. "It only ever gets one event" is not an exemption — it is a prediction about delivery that the broker is under no obligation to keep.

The reason the law is shaped around replay rather than around correctness-on-first-delivery is that a broker gives you at-least-once and nothing more. Duplicate delivery is not a fault to be handled; it is the contract. Code that is only correct when each message arrives exactly once is code that has quietly assumed a guarantee nobody offered it.

`CDC-4` IS THE ROOT, THE OTHERS ARE ITS CONDITIONS. Idempotent recompute is what makes `CDC-6` survivable — a swallowed message is repairable only because the next change to the same row rebuilds the same target from scratch. It is what makes `CDC-2` affordable: a stable group can resume from a committed offset precisely because re-processing near the boundary changes nothing. Break `CDC-4` and the other six stop being safe; they do not merely become untidy.

The numbering has no meaning beyond identity. `CDC-1` is not more severe than `CDC-7`, and the codes do not form a scale.

## Situation codes

Every situation this module governs carries a code, `CDC-<n>`. The code names the SITUATION; the third column names what that situation obliges the source to look like. The numbers are fixed and are cited from other law files and from task records — a code is never renumbered, and a code is never retired by reusing its number for something else.

| Code | Situation | What the source must look like |
|---|---|---|
| `CDC-1` | A new projection needs to listen to Kafka | Every concrete `*projection.listener.ts` extends `AbstractProjectionListener`; connection, subscription, envelope parsing and failure isolation live in that base. Forbidden: a projection listener with its own `onModuleInit`, its own consumer, its own parsing or its own error policy |
| `CDC-2` | The projection must state who it is and which tables it listens to | A declared `groupId` that is the durable identity of the projection consumer, and a `topics` array that is the complete set of sources able to invalidate it. Forbidden: a generated, random or instance-scoped group; an implicit or inherited topic set |
| `CDC-3` | One row changed — what has to be recomputed | `deriveTargets` reads the changed row and returns projection identities; `recomputeTarget` delegates to the projection service. Forbidden: business commands, side effects or SQL policy inside the listener |
| `CDC-4` | Recomputing the projection's number | Recompute rebuilds the projection with an UPSERT from authoritative rows. Forbidden: updating a projection by adding the delta carried by the event |
| `CDC-5` | A source row is deleted | A payload with no `after` image is skipped; delete repair comes from another retained source or a purpose-built deletion stream. Forbidden: treating a tombstone as an empty entity and writing that emptiness through |
| `CDC-6` | One broken message mid-stream | Parse or recompute failure is logged with topic and consumer group and isolated to that one message. Forbidden: throwing out of the message handler and stalling the consumer loop |
| `CDC-7` | Proving the CDC path actually runs | An operational E2E publishes through the real broker and waits for the database projection. Forbidden: calling `deriveTargets`, `recomputeTarget` or a listener method directly and calling that a CDC test |

## Reading an accepted shape

1. Read what the shape states. It states a read model, the number or row it shows, and the source data that number is computed from. That is enough to name the projection, its sources and the identity it is stored under.
2. Read what it does not state, and therefore does not resolve. An accepted shape does not state the consumer group id, the topic prefix, whether recompute is an UPSERT or an increment, what happens on delete, or whether a broker-level test exists. Those are architecture decisions this pattern lands; the shape neither grants nor forbids them.
3. Resolve outermost first. Decide the file and its base class before its members, its members before their bodies, its bodies before the SQL a service body calls. `CDC-1` is answered before `CDC-2`, and `CDC-2` before `CDC-3` and `CDC-4`, because a listener that owns its own consumer has no stable place to put a group id.
4. Ask each code's question in turn. `CDC-1`: if the envelope format changes tomorrow, do I edit one file or seventeen? `CDC-2`: restart this process 100 times — is it still one consumer group, or 100 groups each replaying the whole history? `CDC-3`: replay 10,000 old messages — does anything happen outside the projection? `CDC-4`: does a duplicate double the number, and does a lost message heal on the next change to the same row? The answers must be no and yes. `CDC-5`: where does the identity I am writing under come from, when the source row no longer exists? `CDC-6`: does one dirty row stop the whole projection updating? `CDC-7`: if I declared the wrong `groupId` or forgot a topic, does this test go red?
5. When two codes both match, they are two different failures and are repaired separately. Inheriting the right base while generating `groupId` at boot satisfies `CDC-1` and breaks `CDC-2`. Delegating correctly to a service whose body increments satisfies `CDC-3` and breaks `CDC-4`. Writing a zero for a deleted row breaks `CDC-5` and `CDC-4` at once, because the zero is derived from the event rather than from source. Returning an empty target list because a column change is irrelevant is `CDC-3`; returning empty because there is no `after` image is `CDC-5`. Both are correct and neither substitutes for the other.

## `CDC-1` — Kafka lifecycle belongs to the shared base

**Situation.** You add a new projection. It needs a connection, a subscription, Debezium envelope parsing, and a policy for a broken message. None of those four are this projection's work — there is already a place that owns them.

**What it emits in source.** One concrete class in a `*projection.listener.ts` file extending `AbstractProjectionListener`, declaring no lifecycle method of its own and injecting no Kafka client of its own. Connection, subscription, parsing and failure isolation stay in the base.

**Recognition signs.** `onModuleInit`, `consumer.run`, `subscribe` or a `JSON.parse` of a message appears inside the listener file. The listener injects a Kafka client itself instead of receiving it through the base constructor. The file contains a `try/catch` deciding what to do with a broken message.

**Boundary.** Not `CDC-2`: `CDC-1` says who OWNS the connecting; `CDC-2` says what is DECLARED so that connection has an identity — inherit the right base with a randomly generated `groupId` and `CDC-1` holds while `CDC-2` breaks. Not `CDC-6`: failure isolation is a BEHAVIOUR of the base, so a listener that writes its own per-message `try/catch` has already broken `CDC-1` before `CDC-6` is even reached.

**Common business situations.** Adding a course-statistics projection; adding a user-points projection; splitting one old projection into two; a projection that needs a third topic.

## `CDC-2` — consumer identity and source set are declared

**Situation.** `groupId` is the durable identity of this projection's consumer; `topics` is the complete set of sources able to make the projection wrong. Both are written down, not inferred at run time.

**What it emits in source.** A `groupId` string literal that names the projection, and a `topics` array assembled from an environment-scoped topic prefix plus explicit table names. The prefix may come from configuration; the table list may not.

**Recognition signs.** `groupId` is a constant string you can read and know which projection it is. `topics` lists each source table one by one. No `randomUUID()`, no `Date.now()`, no instance name inside `groupId`.

**Boundary.** Not `CDC-1`: see above. Not `CDC-4`: a random group PLUS idempotent recompute produces correct numbers at a horrifying resource cost; a random group PLUS delta addition produces wrong numbers on the very first restart. The two codes fail in two different ways and must be repaired separately.

**Common business situations.** Deploying several replicas that all read one projection; adding a new source table and forgetting to declare its topic; renaming a source table; running the same listener in staging and production with different topic prefixes.

## `CDC-3` — the listener routes, the service recomputes

**Situation.** `deriveTargets` reads the row that just changed and returns the IDENTITIES of the affected projections. `recomputeTarget` hands the recomputation to the projection service. The listener owns ROUTING, not SQL POLICY.

**What it emits in source.** A `deriveTargets` that only reads, branches on topic, and returns ids or an empty array; a `recomputeTarget` containing exactly one call to the projection service and nothing else; the SQL living in the service, not the listener.

**Recognition signs.** No `save`, `insert`, `emit`, `sendMail` or `publish` anywhere in the listener. The recompute call carries an identity, not a payload. Branching in `deriveTargets` is on topic, and its returns are ids or `null`/`[]`.

**Boundary.** Not `CDC-4`: `CDC-3` says WHO CALLS; `CDC-4` says HOW THE CALLED FUNCTION COMPUTES — delegate correctly to a service that then `increment`s and `CDC-3` holds while `CDC-4` breaks. Not `CDC-5`: returning an empty array because a parent could not be resolved is CORRECT `CDC-3`, not evasion.

**Common business situations.** A submission changing state must recompute course progress; a points ledger row must recompute a points total; a new review must recompute an average rating; an enrollment row must recompute both progress and access.

## `CDC-4` — recompute from source, never add the delta

**Situation.** The projection is rebuilt by an UPSERT from authoritative source rows. It is never updated by adding the number the event carried.

**What it emits in source.** A recompute function that takes an id and no amount; SQL that aggregates over the source table — `SUM(...)` / `COUNT(...)` — and ends `ON CONFLICT ... DO UPDATE`; a function that returns the same result run three times in a row.

**Recognition signs.** The recompute signature has no `amount`, `delta` or `points` parameter. The write is an UPSERT keyed by the projection identity. The value written is selected, not accumulated.

**Boundary.** Not `CDC-3`: see above. Not `CDC-6`: swallowing a broken message is only SAFE because `CDC-4` holds — if recompute is not idempotent, every swallow is a permanent error and `CDC-6` turns from a self-healing mechanism into silent data loss.

**Common business situations.** A user's points total; a course's learner count; an average review score; a completed-lesson count; a streak; a group leaderboard; an interaction count for a piece of content.

## `CDC-5` — a tombstone does not construct current state

**Situation.** A Debezium payload with no `after` image has no current row to map. The base skips it. A projection that genuinely needs repair on delete must take the identity from a source that is still retained, or from a purpose-built deletion stream.

**What it emits in source.** An `unwrapRow` in the base returning `null` when there is no usable current image, and a handler returning early on that `null` — with no concrete listener re-implementing the unwrapping. Where deletes truly matter, a second retained source or a deletion stream in the `topics` set.

**Recognition signs.** Code reading `payload.after` without a `null` check. A cast of a tombstone into an empty entity that is then written through. A comment along the lines of "deleted, so treat it as 0".

**Boundary.** Not `CDC-3`: an empty array because "this column changed but is irrelevant" is `CDC-3`; an empty array because "there is no `after` image" is `CDC-5`. Both are right, but they are two different reasons and they break in two different ways. Not `CDC-4`: writing a zero for a deleted row is still a write DERIVED FROM THE EVENT rather than from source — it breaks both codes at once.

**Common business situations.** Cancelling an enrollment; removing a piece of content from a course; deleting a review; unpinning a project; leaving a group.

## `CDC-6` — one broken message does not kill the consumer

**Situation.** A parse failure or a recompute failure is logged with TOPIC and CONSUMER GROUP and affects exactly that message. The consumer does not stop.

**What it emits in source.** A `catch` around the handling of ONE message — not around the loop — inside the base's `handleMessage`, building a typed CDC exception, logging it with `groupId` and `topic`, and not rethrowing.

**Recognition signs.** The log carries both `groupId` and `topic`; missing either makes the failure untraceable. Nothing throws back out of the handler. The `catch` scope is one message wide.

**Boundary.** Not `CDC-1`: this behaviour LIVES IN THE BASE, so a listener writing its own isolation mechanism is breaking `CDC-1`. Not `CDC-4`: swallowing is only legitimate while recompute is idempotent — see above.

**Common business situations.** A connector changing its SMT configuration mid-flight; a column changing type; a row carrying invalid JSON; the database briefly refusing a connection during recompute.

## `CDC-7` — prove it through a real broker

**Situation.** An operational E2E publishes through a real Kafka and then waits for the projection in the database. Calling `deriveTargets`, `recomputeTarget` or any listener method directly proves the mapping code, not CDC.

**What it emits in source.** An E2E spec whose ARRANGE writes source rows directly and does not call the projection service, whose ACT touches only the broker, and whose ASSERT polls the projection table until it is right, with a timeout.

**Recognition signs.** A publish helper followed by a polling wait on the projection table. No projection-service call in the arrange step. A bounded wait rather than a fixed sleep.

**Boundary.** Not `CDC-3`: a unit test on `deriveTargets` is LEGITIMATE and useful — it simply does not count as CDC evidence. Not `CDC-2`: this is the only test that can catch a `CDC-2` defect, because a wrong `groupId` or a missing topic only shows itself with a real broker in the middle.

**Common business situations.** Adding a new projection; changing an existing projection's topic set; upgrading the connector; changing the topic prefix between environments; merging two projections into one.

## Layer held

The concern is held by the shared projection base in the platform layer, not by any feature module. Connection, subscription, envelope parsing, tombstone skipping and failure isolation belong to `AbstractProjectionListener`; SQL policy belongs to the projection service; the concrete listener holds routing only, and the feature's business modules must stay entirely ignorant that a broker exists.

The tiers below say which layer actually holds each code today. `unrepresentable` means the wrong value cannot be written; `enforced` means a lint rule reports it; `documented` means only a reader holds it.

| Code | Tier | Held by | Not held |
|---|---|---|---|
| `CDC-1` | `enforced` | `starci-be/projection-listener-contract`, messages `base` (superclass is not `AbstractProjectionListener`) and `lifecycle` (a concrete listener declares `onModuleInit`) | A listener that injects a consumer and runs it from the constructor or from a method named anything other than `onModuleInit` |
| `CDC-2` | `documented` | — | `projection-listener-contract` message `member` reports a MISSING `groupId` or `topics`; it never reads their values, so `groupId = randomUUID()` and a topic list built from a wildcard both pass |
| `CDC-3` | `documented` | — | The same `member` message reports a missing `deriveTargets` or `recomputeTarget`; it does not look inside either body, so a repository write inside `deriveTargets` passes |
| `CDC-4` | `documented` | — | Nothing reads the SQL or the service call; `increment(...)` and `recompute(...)` are equally valid identifiers to a linter |
| `CDC-5` | `documented` | — | The skip lives in the shared base, so no rule needs to fire while the base is used; a listener that re-implements unwrapping is caught by `CDC-1`, not by a tombstone rule |
| `CDC-6` | `documented` | — | Same as `CDC-5`: isolation is a property of the base's `handleMessage`, not of any concrete listener a rule could inspect |
| `CDC-7` | `documented` | — | No rule relates a listener to a test that exercises it; a projection with no operational E2E is indistinguishable from one whose E2E lives in another file |

Six of seven rows read `documented`, and that is the honest reading rather than a gap to be papered over. Two of the six (`CDC-5`, `CDC-6`) are documented for a good reason: the behaviour is centralised in the base class, so the enforceable statement about them is already `CDC-1`. The other four are unheld work. Note in particular that the one enforced check is thinner than its name suggests: the `member` message reports only PRESENCE, so a `groupId` renamed into a random value still passes.

## Anchor

A law that cannot be pointed at in real code is a proposal. Each code names source that can be read today and the exact thing to read it for.

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

Every code is anchored. No code is unanchored in this version.

## Inputs

| Input | Evidence required |
|---|---|
| source tables | Every table whose change can invalidate the projection, named |
| target identity | The key the projection is stored under, and how a row resolves to it |
| recompute query | The authoritative query that rebuilds one target from source rows |
| delivery | Consumer group id, and whether the projection is proved through a broker |
| deletion | What repairs the projection when a source row disappears |

## Rules

1. Processing the same row change twice produces the same projection.
2. The base class owns connection, subscription, parsing and failure isolation.
3. A consumer group id is a constant, not a value computed at boot.
4. The topic list is the complete invalidation set; an unlisted source means a stale projection, not a slower one.
5. `deriveTargets` returns identities and performs no business side effect.
6. A projection is written by UPSERT from source rows, never by applying an event's delta.
7. A payload with no current row image produces no write.
8. One failed message affects one message.
9. A CDC claim is proved through a broker or it is not a CDC claim.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Boot is best-effort (`CDC-1`).** Subscription failure at startup is logged and swallowed rather than crashing the process, because a broker outage must not take the API down with it. This is an exception about AVAILABILITY, not about ownership: the swallow lives in the base, and a concrete listener still declares no lifecycle of its own.
- **Reads inside `deriveTargets` (`CDC-3`).** Resolving a parent id — a submission to its milestone, a content row to its course — is a read and is allowed, because mapping a row to an identity sometimes requires the graph. A write inside `deriveTargets` is never allowed, and the test is whether replay would repeat an effect.
- **An empty target list (`CDC-3`, `CDC-5`).** Returning `[]` is the correct answer for an irrelevant column change, an unresolvable parent or a delete. Skipping is a decision the code is entitled to make; inventing a target to avoid an empty return is not.
- **A projection that genuinely needs deletes (`CDC-5`).** Consume a retained source that still carries the identity, or a purpose-built deletion stream. Reading the tombstone key and treating the absence as a zero row is refused even when the zero happens to be correct today.
- **A unit test on mapping (`CDC-7`).** Calling `deriveTargets` directly is a legitimate test of mapping code. It is refused only as EVIDENCE OF CDC — one operational E2E through the broker is owed regardless of how many mapping tests exist.

## Output

One block per file the accepted shape produces.

```text
projection: <projection name>
sources: <tables that can invalidate it>
groupId: <stable consumer group>
target: <identity a row resolves to>
recompute: <authoritative query, upsert key>
situation: <CDC-1 | CDC-2 | CDC-3 | CDC-4 | CDC-5 | CDC-6 | CDC-7>
reason: <the replay fact that decides it>
```

## Worked example

Accepted shape: a profile screen shows a learner's total points, and the points ledger is the source of truth for that total.

```text
projection: user points total
sources: points ledger table
groupId: user-xp-projection
target: one row per user id
recompute: delegated to the projection service; listener holds routing only
situation: CDC-3
reason: the listener maps a ledger row to a user id and calls one service method; replaying 10,000 ledger rows produces no effect outside the projection, which is what excludes CDC-4 — nothing in this file computes a value
```

```text
projection: user points total
sources: points ledger table
groupId: user-xp-projection
target: one row per user id
recompute: SUM over the ledger for that user id, UPSERT on the user id key
situation: CDC-4
reason: recompute takes a user id and no amount, so a duplicated delivery cannot double the total and a lost delivery heals on the next ledger change; that is the fact excluding CDC-3, because this file computes rather than routes
```

```text
projection: user points total
sources: points ledger table
groupId: user-xp-projection
target: one row per user id
recompute: proved end to end, not called directly
situation: CDC-7
reason: the arrange step writes ledger rows and the act step touches only the broker, so a wrong groupId or a missing topic turns this red; that is what excludes CDC-2 as sufficient evidence — CDC-2 is a declaration, this is the only place it is measured
```

The accepted shape says a screen shows a total and where the total comes from. It does not state the consumer group id, the topic prefix, whether recompute upserts or increments, what happens when a ledger row is deleted, or whether an operational E2E exists — and therefore it resolves none of them. Those five are settled here, by code, and the delete case in particular stays open until a retained source or a deletion stream is named.

## Scope

This rule holds for any service in this stack that projects committed rows into read models. It names no single feature: every example is ordinary TypeScript in a NestJS-shaped class, and no product, brand or private module name is needed to understand one. The `## Anchor` table is the single exception, and deliberately so: it cites real source paths in the repository this trust tree governs, because a law nobody can check against running code is a proposal.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published name, plugin prefix and all, because that is the exact string a build log prints and a disable comment carries. A citation that cannot be pasted into a search is not a citation. What the ban above forbids is PROSE and EXAMPLES that need a product to be understood — never an identifier somebody will read in a failure and have to look up.
