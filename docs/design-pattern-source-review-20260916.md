# Pattern research: Academy and Nivo, 2026-09-16

This read-only sample scan informed the reusable [design catalog](design-pattern-catalog.md). It did not refactor product code, run product UAT, contact providers or test crash/concurrency behavior. Findings below identify visible design choices and specific proof obligations; they do not assert that every listed risk already occurs in production.

## Inspected source identities

| Source | Git revision | Selected surface |
| --- | --- | --- |
| Academy backend | `1731b15ba4ed526477e3c572b9d82c31ab64f1d5` | CQRS dispatch, named EntityManager, community outbox/projection, module/config composition |
| Academy frontend | `44bba218685b7eed2a5d9e479689707ab6381bc8` | Next routes, connected/render units, Grammar and data/config boundaries in the portable profile review |
| Nivo backend | `eb38ee005fa7a42959d5e9d600f505a6a71f9041` | Provisioning saga, outbox/inbox, dispatcher, transition emitter |
| Nivo frontend | `a01a7bd7474fc6b43b831853d9ef870c202f3844` | Provisioning realtime hook and query-answer model |

The selected Nivo saga/event and FE files matched tracked source at inspection; the full repositories are not declared clean. Historical Academy code details are additionally documented in [backend source pattern](backend-source-pattern.md) and [portable source architecture](portable-source-architecture.md). Reproduction uses the named repository and `git show <revision>:<relative-path>`; an installed runtime does not require these product repositories to exist.

Nivo's inspected manifests declare Nest `^11.0.1`, TypeORM `^0.3.28`, Next `16.1.6`, React `19.2.3` and SWR `^2.3.8`. These are declared ranges/versions, not a claim about a deployed process or every resolved lockfile dependency. Primary online documentation was read on 2026-09-16; current documentation may cover APIs beyond the installed version. Verify the actual API before implementation.

## What the source supports, and what remains to prove

| Observed implementation | Evidence and limit | Next bounded verification |
| --- | --- | --- |
| Academy separates transport, command/message and handler, with named manager injection | Useful responsibility and connection identity. A forwarding service/base `execute` to `process` bridge does not independently justify an extra layer | Select direct use case or meaningful bus semantics under DP-01/02; verify named DI and transaction identity |
| Academy community publisher claims rows with a lease and emits in process | `src/modules/bussiness/community/community-outbox-publisher.service.ts` uses a claim query; visible publication settlement is by row ID and local event emission is not durable consumer acknowledgement | DP-05/08: competing claims, stale claim settlement and crash boundaries; define whether this delivery is intentionally best effort |
| Nivo persists saga definition version, direction, cursors and step outcomes | `src/modules/bussiness/provisioning-saga/runner/provisioning-saga-runner.service.ts` runs a step before fenced local completion | DP-07/08: remote success followed by crash/fence rejection; prove each real step's idempotency/reconciliation instead of inferring it from the local fence |
| Nivo saga creation can participate in its caller's transaction | `src/modules/bussiness/provisioning-saga/atomic/provisioning-saga-action.service.ts` accepts a manager but also allows the injected fallback. Inspected AgentOS/expert/module dispatchers call it with their transaction manager | DP-03/05: exercise rollback and enforce the boundary for every applicable caller. The optional fallback alone is not proof those inspected calls lack atomicity |
| Dispatchers enqueue after database commit | `src/modules/bussiness/agentos-provision/agentos-provision.dispatcher.ts`, `expert-provision/expert-provision.dispatcher.ts`, and `agentos-solution-modules/agentos-module-provision.dispatcher.ts` under `src/modules/bussiness` | Crash between commit and enqueue must have an owned redispatch/reconciliation path. Enqueue outside a DB transaction avoids a false shared transaction but does not by itself close the gap |
| Nivo outbox carries event ID, saga sequence and partition key | `src/modules/bussiness/provisioning-events/provisioning-outbox.service.ts` writes through the passed manager. Its publisher sends then saves `publishedAt`; an in-process drain promise prevents only same-instance overlap | DP-05/06: duplicate publication after send/mark failure and parallel publishers; verify consumers and the intended ordering guarantee |
| Nivo inbox has a unique event ID and tracks `relayedAt` | `provisioning-event-consumer.service.ts` under that event module performs find/save, local emit, then marks relayed. `src/modules/platform/databases/postgresql/primary/entities/provisioning-event-inbox.entity.ts` declares the unique index | DP-06: concurrent first delivery, retry after unique conflict and crash around emit/mark. `ProvisioningTransitionEmitter` wraps Node `EventEmitter`; local relay is not proof a browser received anything |
| Nivo realtime filters by resource, resets on target/auth change and removes listeners on cleanup | `apps/app/src/modules/realtime/provisioning.ts` orders updates with sequence/timestamp. Saga messages contain saga IDs, while the visible ordering refs are per selected target | DP-11/13/14: new saga generation for the same resource, missed updates/reconnect snapshot and old responses. Inspect the complete caller/query integration before concluding recovery is absent |
| Nivo query helper distinguishes loading, failed and successful data | `apps/app/src/modules/query/index.ts` maps undefined, failed answer and success separately | DP-14: preserve useful error/retry semantics at the consuming owner; test lifecycle states rather than flattening every non-success into empty content |

## Rejected generalizations

- Existing saga/outbox/inbox code is not “nothing implemented”; preserve valid work and verify its exact gaps.
- A lease or job fence is not a universal fence over an external provider.
- A unique inbox key prevents duplicate stored identity; it does not automatically make an external or realtime effect atomic.
- Two transports do not force CQRS. CQRS does not force event sourcing. A single database transaction does not need a distributed saga.
- A public reference project can contain debt. Its legacy wrappers, empty configuration builders and narrow tests do not become universal obligations.
- A new SDS revision is a reason to compute affected proof/implementation scope. It is not authority to delete completion history or rewrite every source file.

## Outcome for subsequent Nivo work

Start with executable staleness and code-pattern coverage reports. Bind current source and accepted design, then select only affected DP cases. Prioritize effect/receipt crash gaps, competing actors, scoped authority and FE recovery around existing modules. The owner has separately selected Nivo Core as a native development process and the Nivo Control Plane application as a remote API in the existing Tino K3s environment; this is an accepted deployment input outside this scan, not a deployment fact established by the inspected source. Preserve that input through the [remote application API contract](remote-application-api.md) and bind its canonical project deployment declaration before later product work. Product migration and live verification remain future authorized work; this runtime research does not resume them.
