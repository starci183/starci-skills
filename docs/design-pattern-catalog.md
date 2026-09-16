# Enterprise design pattern catalog for Next.js and NestJS

Reviewed against primary framework/database documentation, original engineering pattern analyses and selected Academy/Nivo source on **2026-09-16**. Links identify each source's author/maintainer; recommendations below are this standard's design judgments, not an industry certification. This is the agent's semantic design reference under the [common rules](architecture-rules.md). It does not replace the executable [code-pattern contract](code-pattern-enforcement.md), select infrastructure, authorize product changes or certify the inspected source.

The standard fixes TypeScript, Next.js, NestJS and the owner's adopted Academy code forms. The choices below concern consistency, ownership and failure handling within that stack. Use the smallest design that satisfies the actual invariant. A pattern name in a class, dependency list or SDS is not evidence that its guarantees hold.

## How an agent uses this catalog

For an affected scenario, record the trigger, selected pattern IDs, authoritative state/owner, rejected simpler alternative, failure contract and required evidence in its existing SDS/design section. Do not create a new Work node for every pattern or file. A decision may be `not applicable` with a concrete reason; absence of a hard problem is a valid reason not to add machinery.

Agent review asks whether the design meets the product invariant. Scripts check the adopted mechanical clauses and their complete applicable coverage. Concurrency, crash, authorization and recovery claims additionally need executable behavior evidence at the relevant boundary. Neither channel can waive the other. A unit mock may prove control flow; it cannot prove a database transaction, remote idempotency or broker acknowledgement.

## Selection map

| ID | Design question | Start with | Escalate when |
| --- | --- | --- | --- |
| DP-01 | Where does the behavior live? | Modular capability and explicit use case | A provider/protocol needs an adapter or a independently owned contract |
| DP-02 | Do reads and writes need different models? | Direct typed use case and query | Dispatch policy or read/write consistency requires CQRS |
| DP-03 | Can concurrent writes break an invariant? | Local transaction and database constraint | Conditional update, lock or stronger isolation is needed |
| DP-04 | Can a caller repeat a mutation? | Stable operation identity and result receipt | Network uncertainty or replay requires durable idempotency |
| DP-05 | Must a commit produce a notification/job? | Local atomic state change | Dispatch crosses the transaction and needs atomic durable intent/outbox |
| DP-06 | Can a message arrive twice? | Idempotent consumer/inbox | Delivery is at least once or processing can crash |
| DP-07 | Does work cross independent transactions? | Explicit operation contracts and receipts | Multi-step progress, unknown outcomes, recovery or compensation needs a persisted coordinator |
| DP-08 | Can an old executor still write? | Resource-enforced fence/version | A lease/replacement can overlap a paused worker |
| DP-09 | Can a remote call fail transiently? | Deadline and classified bounded retry | Backoff/jitter and a retry budget are justified |
| DP-10 | Can a failing dependency exhaust the app? | Concurrency limits and bounded queues | Isolation/breaker behavior is needed and measured |
| DP-11 | Can contracts and projections evolve separately? | Versioned event contract and explicit consistency | Replay, mixed deployments or read lag matter |
| DP-12 | Who may act on this resource? | Resource policy and authenticated scope | Jobs/services and multiple entry points share authority |
| DP-13 | Does a request outlive the connection? | Durable operation status | Polling or push must recover after disconnect |
| DP-14 | Who owns browser data and mutations? | One query/mutation owner and safe DTOs | Cache identity, optimistic updates or reconnect races appear |
| DP-15 | Must authoritative history reconstruct state? | Current-state storage plus necessary audit | Event sourcing's replay value justifies its cost |
| DP-16 | Can old and new code coexist safely? | Compatible schema/contract rollout | Backfill and removal need an expand/contract sequence |

## DP-01 — Modular capability, use case and adapter

**Use:** Features own scenarios; shared modules own reusable capability policy, state or integration. A public contract exposes the responsibility. A protocol/provider adapter translates its external representation at the boundary. Map roles through the [backend](backend-source-pattern.md) and [portable FE/BE](portable-source-architecture.md) profiles.

**Avoid:** An interface, forwarding service or empty dynamic-module builder for every class. Nest dynamic registration is useful when callers actually configure a module; it is not required merely because a module exists. [Nest dynamic modules](https://docs.nestjs.com/fundamentals/dynamic-modules).

**Review/prove:** Ownership is cohesive; imports preserve direction; configured tokens preserve distinct instances; multiple transports reach the same policy. Boot-test nontrivial dependency identity. An API adapter for a remote application is not a cluster-administration adapter.

## DP-02 — CQRS and optional read models

**Use:** Separate commands and queries when their contracts, validation, authorization, dispatch or scaling genuinely differ. CQRS can share one database. A separate read model adds an explicit lag and reconciliation contract. Keep feature command/query/handler files in the owning application area; transport DTOs stay at transport boundaries.

**Avoid:** A bus and one forwarding class per method in straightforward CRUD. CQRS does not require event sourcing, separate services or separate databases. [Microsoft CQRS guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs).

**Review/prove:** One transaction owner; write receipt and read-after-write behavior; out-of-order projection recovery. Nest's `@Saga()` transforms observable event streams into commands: infer no persisted checkpoint or crash recovery from that decorator. Those guarantees require an additional durable design and evidence. [Nest CQRS](https://docs.nestjs.com/recipes/cqrs).

## DP-03 — Local transaction and concurrency control

**Use:** Commit the invariant's related writes together through the same named connection and transactional EntityManager. Choose a unique constraint, conditional update/version, row lock or isolation level according to the competing operation. Return an explicit conflict/retry disposition.

**Avoid:** Read-then-write as an atomic guard; holding a database transaction open over an unbounded remote call; assuming stronger isolation removes retry needs. PostgreSQL Read Committed uses statement snapshots; serialization failures can require retrying the complete transaction. [PostgreSQL 16 isolation](https://www.postgresql.org/docs/16/transaction-iso.html). An upsert must target the actual uniqueness invariant. [PostgreSQL 16 INSERT](https://www.postgresql.org/docs/16/sql-insert.html).

**Review/prove:** Simultaneous competing calls and a rollback midway through the write set, using the real store. Inspect every helper's manager parameter; a transaction around the caller does not fix a helper using another manager.

## DP-04 — Durable idempotency and operation receipts

**Use:** A retriable mutation binds caller/scope, operation identity, canonical request meaning and stored disposition. Repeating the same intent returns the existing result or operation; reusing the identity for different input fails. State the retention window and handling of late retries. Record local receipt and local mutation atomically where possible. [AWS idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/).

**Avoid:** A random key on each retry, payload hash alone as business intent, an in-memory map as cross-process exclusion, or a locally deduplicated request as proof that a provider deduplicates effects.

**Review/prove:** Two simultaneous identical requests, changed payload under the same key, lost acknowledgement, expired receipt and crash after remote success. The provider adapter owns its supported idempotency/reconciliation contract; the use case owns product intent.

## DP-05 — Transactional outbox and durable dispatch

**Use:** Store the domain change and publication/dispatch intent in one local transaction. A separate publisher delivers committed intents and tracks progress. Handle duplicates, ordering scope, retry exhaustion and retention explicitly. The same reasoning applies to a database job followed by enqueueing to Redis. [AWS transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

**Avoid:** Database commit followed by an unprotected publish/enqueue with no recovery owner; assuming an in-process event emit is durable broker delivery; claiming exactly once because the publisher marks a row sent.

**Review/prove:** Rollback before commit, crash before send, send succeeded but acknowledgement/mark failed, competing publishers and old claim holders. A lease/claim must protect its settlement too. Use domain-owned outbox intent plus a shared delivery mechanism without moving product policy into infrastructure.

## DP-06 — Inbox and idempotent consumer

**Use:** Identify a message within its consumer's scope and atomically record consumption with local state changes. A uniqueness constraint handles concurrent duplicates; a pre-read alone does not. A separate processed-message table is one option, not the only one. [Chris Richardson's idempotent consumer pattern](https://microservices.io/patterns/communication-style/idempotent-consumer.html).

**Avoid:** Mark-before-effect that loses work, mark-after-effect that silently duplicates non-idempotent effects, or a database inbox as proof of browser delivery. Remote effects need their own idempotency or a durable relay.

**Review/prove:** Duplicate delivery concurrently and after restart, effect/receipt crash boundaries, poison messages and replay after retention. Distinguish broker acknowledgement, local processing, realtime notification and client observation; they are separate milestones with different guarantees.

## DP-07 — Durable saga / process manager

**Use:** Persist progress for scenarios spanning independent transactions. The owning coordinator defines step identity/version, input/results, forward and compensation transitions, retry budgets, unknown outcomes and recovery. Separate reversible steps, an irreversible pivot and forward recovery as appropriate. Compensation can fail and is not database rollback. [Microsoft saga guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga).

**Avoid:** A saga around one adequate local transaction; keeping progress only in an RxJS stream; blindly repeating a non-idempotent step after a timeout; describing cancellation as instant reversal.

**Review/prove:** Restart between every effect and checkpoint, compensation failure, cancellation racing completion, definition upgrades with old runs, and a step whose outcome is unknown. Resume the persisted valid cursor; preserve previous receipts. The scenario owns orchestration, while modules own their step capabilities and provider adapters.

## DP-08 — Lease, fencing and reconciliation

**Use:** A resource that must reject obsolete executors checks an execution epoch/version with each protected mutation. A lease bounds admission; it does not stop a paused worker. The token must reach the write authority and be compared there. [Kleppmann's distributed locking analysis](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html).

**Avoid:** Treating lease expiry or a fenced local journal update as evidence a remote command did not happen. If a provider lacks fencing, specify its supported idempotency, conditional update, serialization or reconciliation strategy and the residual limitation.

**Review/prove:** Pause executor A beyond lease expiry, admit B, then resume A; inspect the actual resource's accepted effects. Reconciliation compares recorded intent/receipt with authoritative remote state and has bounded, owned dispositions for unknown or conflicting outcomes. It must not manufacture completion.

## DP-09 — Deadline, bounded retry, backoff and jitter

**Use:** Classify transient, permanent and unknown failures. Set an end-to-end deadline, bounded attempts and a retry budget at a chosen owner; account for SDK/queue retries below it. Use backoff and jitter to avoid synchronized overload. A timeout may occur after an effect. [AWS Builders' Library](https://d1.awsstatic.com/builderslibrary/pdfs/timeouts-retries-and-backoff-with-jitter.pdf).

**Avoid:** Retrying authentication/schema failures unchanged, nested retry multiplication, or retrying unsafe mutations simply because the transport failed.

**Review/prove:** Attempt/deadline limits, cancellation, a slow handshake, throttling and restart persistence where the job is durable. Use controlled time in narrow retry tests; exercise the real adapter separately. Exhaustion must expose a recoverable disposition or terminal failure, not an invisible loop.

## DP-10 — Bulkhead, backpressure and optional circuit breaker

**Use:** Partition finite concurrency/resources where one dependency or tenant could exhaust unrelated work. Bound queues and define admission/rejection behavior. [Microsoft bulkhead](https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead). A breaker can suppress repeatedly failing calls and probe recovery; choose its scope and thresholds from the dependency behavior. [Microsoft circuit breaker](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker).

**Avoid:** Unbounded `Promise.all`, global limits that starve unrelated capabilities, or a breaker around every call without testing recovery. Limits and retry budgets may be enough; a new state machine carries operational cost.

**Review/prove:** Saturation of one partition while another serves, queue expiry, fair admission, bounded half-open probes and recovery without a restart storm. Keep capability-specific priority policy above the shared admission mechanism.

## DP-11 — Versioned events and recoverable projections

**Use:** A producer-owned event contract declares identity, scope, version and ordering domain. Consumers declare compatibility, idempotency and checkpoint/rebuild behavior. Schema compatibility depends on format and policy; adding a field is not universally safe. [Confluent schema evolution](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html).

**Avoid:** Treating an ORM entity as an integration event, comparing sequence numbers from unrelated streams, or assuming delivery order establishes business causality. A projection is derived state, not a second authority.

**Review/prove:** Old/new producers and consumers, duplicate/out-of-order messages, missing sequence, rebuild from an authorized checkpoint and observable lag. Decide whether lag blocks an action, triggers authoritative reread or is acceptable. Realtime consumers must include the relevant resource/run generation in their ordering identity.

## DP-12 — Resource policy and scoped authority

**Use:** Authenticate the caller, then authorize the action on the resolved resource/scope. Apply the policy across HTTP/GraphQL, server actions, jobs and service calls as applicable. A caller-provided workspace ID is data, not permission. Choose least privilege and deny unspecified access. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

**Avoid:** UI hiding as access control, a guard decorator as the whole policy, or trusting an internal network as service identity. Domain/resource policies belong to their capability; transport identity parsing belongs to the adapter; token/key mechanisms are shared modules.

**Review/prove:** Cross-scope attempts, revoked membership, delegated job authority and alternate entry paths. Logs identify the action and disposition without exposing credentials. Static decorator/import checks cannot prove these decisions.

## DP-13 — Durable asynchronous operation and client recovery

**Use:** Accept a long operation with a stable authorized status reference. Distinguish accepted, running, succeeded, failed, cancellation requested and settled cancellation as the scenario requires. Polling and push are delivery options; persisted status remains the authority. Define retention and reconnect behavior. [Microsoft asynchronous request/reply](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply).

**Avoid:** HTTP success as proof provisioning completed, a connected socket as readiness, or a percentage invented from elapsed time. Disconnect is not product failure and cancellation request is not confirmed cancellation.

**Review/prove:** Lost submit response, client refresh, missed push, stale run event, status expiry and reconnect to an authoritative snapshot. The FE query/lifecycle owner merges updates; presentational components receive explicit state/actions. Map GraphQL or other selected transports without mechanically imposing HTTP status codes on them.

## DP-14 — FE state ownership, safe data boundary and optimistic mutation

**Use:** Keep server-only authority/data access separate from client rendering. Return the minimal safe representation and re-authorize mutations; a server action is an entry point. With a Nest-owned backend, Next's server-side adapter calls the owned API rather than duplicating domain persistence. [Next data security](https://nextjs.org/docs/app/guides/data-security).

**Avoid:** Two sources of truth for the same server state, identity-insensitive cache keys, server secrets in public config/props, and optimistic success for irreversible or externally unsettled work.

**Review/prove:** The query/mutation owner defines cache identity, stale-data/error/empty states, invalidation and rollback or reconciliation. Test identity change during a pending request, older responses overwriting newer mutations, component unmount, reconnect and expired authorization. Intrinsic browser interaction may stay in its visual owner; it does not automatically require a connected/presentational twin. Library-specific APIs must be verified against the installed version.

## DP-15 — Event sourcing is a separate decision

**Use:** Make events the authoritative history only when historical reconstruction and domain requirements justify that storage model. Plan stream concurrency, schema evolution, snapshots, replay and retention. An audit log or outbox alone is not event sourcing. [Microsoft event sourcing](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing).

**Avoid:** Adopting it because CQRS, Kafka or a saga already exists. Current-state relational persistence may satisfy the scenario with far less migration and operational cost.

**Review/prove:** Reconstruct state from history, handle old events, enforce competing stream appends and prevent replay from repeating external effects. The domain owns event meaning. Adding this pattern to an existing product requires an accepted storage/migration decision, not a framework-only upgrade.

## DP-16 — Compatible rollout and expand/contract

**Use:** When versions coexist, introduce compatible fields/contracts first, deploy readers/writers in a safe order, backfill with restartable progress, verify parity, then remove the old contract after its users are gone. This is this standard's deployment inference from explicit producer/consumer compatibility, not a claim that a schema checker proves a live rollout. See DP-11 and the [application runtime/config/health profile](application-runtime-config-and-health.md).

**Avoid:** A destructive schema change and new binary that can only work when every process changes atomically; replaying old sagas through an incompatible definition; calling a rollback safe after irreversible data transformation.

**Review/prove:** The actual supported old/new combination, resumable backfill, compatible rollback boundary and startup/readiness behavior. `.stacks` binds the selected placement and deployment authority. A remote application API hosted in K3s keeps its own deployment boundary; consuming it does not confer cluster control.

## Review record and evidence boundaries

An accepted semantic review records: source/input identities; applicable DP IDs and rejected alternatives; owners and state transitions; transaction/effect boundary; failure and recovery cases; commands/tests actually executed; unresolved assumptions and their effect on acceptance. Link that record from the existing owning Work design/implementation evidence. Do not duplicate SRS/SDS into runtime knowledge.

The [source research note](design-pattern-source-review-20260916.md) distinguishes inspected implementations from untested guarantees. It is a point-in-time investigation, not a current product conformance certificate. Re-scan changed source before applying its conclusions. Passing stale/lint audits settles a measurement; findings still require separately authorized repair and fresh validation.
