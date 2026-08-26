# Architecture and backend capabilities for v6.1

This package is an integration-ready specification. It deliberately does not edit the v6 router, catalog, materializer, root package, or existing skills.

## Core ruling

Source is an observation, not an authority. Architecture work must keep these identities separate:

- `observed`: proved by hash-pinned source, deployment, configuration, test, or runtime evidence;
- `authorized`: accepted business or owner intent;
- `target`: a proposed future design;
- `migration`: the explicit path from observed to target;
- `unknown`: material evidence is absent;
- `contradicted`: two applicable claims disagree.

Creativity is required when source precedent conflicts with business intent, isolation, correctness, security, recovery, or operability. Creativity may produce alternatives and target designs. It must never manufacture a claim about current reality.

## Mandatory model depth

An architecture model is incomplete until it identifies:

1. runtime, language, framework, version constraints, and supported lifecycle;
2. deployables, processes, replicas, workers, jobs, and ownership;
3. inbound and outbound interfaces, protocols, authentication, retries, idempotency, and failure behavior;
4. every physical store, database, schema, collection, bucket, queue, cache, and vendor-owned namespace;
5. every reader, writer, schema authority, migrator, backup owner, and restore unit;
6. infrastructure, network exposure, environment and secret binding, deployment mechanism, rollback, and observability;
7. local development, build, test, migration, release, and incident workflows;
8. observed, target, and migration states without flattening them into one picture.

`PostgreSQL`, `Qdrant`, `jobs`, or `documents` alone are not valid resource identities. A state-changing edge must resolve to a qualified store and resource.

## Atomic architecture capabilities

| Capability | Sole responsibility | Primary artifact |
| --- | --- | --- |
| `architecture/evidence-discovery` | Collect and classify exact claims without selecting a design. | evidence set |
| `architecture/tech-stack-model` | Model runtime/framework/language, versions, topology, communication, persistence, infra, security, observability, and developer workflow. | tech-stack model |
| `architecture/system-model` | Build current and target component/store/edge graphs. | system model |
| `architecture/options` | Produce materially different target options from constraints and contradictions. | option set |
| `architecture/data-ownership` | Qualify every resource, reader, writer, migrator, isolation and restore owner. | ownership matrix |
| `architecture/contradiction-analysis` | Triangulate conflicting source, business, deployment, test, and runtime claims. | contradiction ledger |
| `architecture/design-realization` | Map every designed component and mutation to code, composition root, connection, deployment, configuration and proof. | realization matrix |
| `architecture/migration-design` | Specify coexistence, backfill, cutover, rollback and fleet compatibility. | migration plan |
| `architecture/independent-critique` | Blindly challenge the proposal using independent business, data, runtime and adversarial-source lenses. | critique receipt |
| `architecture/conformance` | Compare implementation and deployment evidence with the approved model. | conformance report |

## Atomic backend capabilities

| Capability | Sole responsibility | Primary artifact |
| --- | --- | --- |
| `backend/solution-design` | Select one behavior-preserving backend solution from approved architecture. | solution |
| `backend/api-contract` | Freeze request/response/auth/error/compatibility semantics. | API contract |
| `backend/event-contract` | Freeze producer, consumer, envelope, ordering, retry and version semantics. | event contract |
| `backend/mutation-contract` | Map every state change to exact store/resource/writer and proof. | mutation contract |
| `backend/query-contract` | Map reads to source of truth, consistency, authorization and performance proof. | query contract |
| `backend/transaction-contract` | Define local transactions and cross-store saga/outbox/compensation boundaries. | transaction contract |
| `backend/contract-critique` | Challenge the joined backend contracts before source access. | contract critique |
| `backend/implementation-conformance` | Check code against contracts before lint or framework gates. | implementation report |
| `backend/delivery-proof` | Close evidence from contracts through implementation, migration and runtime behavior. | delivery proof |

## Required ordering

Architecture discovery and criticism precede backend source mutation. Backend implementation conformance precedes formatter, lint, typecheck, build, and tests. A lint-green implementation writing to the wrong database is a failed implementation.

## Independent critique

The critique capability receives the proposal and evidence, but not the proposal author's reasoning transcript. It runs four read-only lenses:

- business/domain fit and product potential;
- persistence, consistency, retention and recovery;
- runtime, deployment, credentials and operability;
- adversarial source analysis: legacy, dead, duplicated, transitional or unauthorized precedent.

It cannot approve its own revision. A proposal is clean only when every mutation is store-qualified, writer and migrator ownership is explicit, contradictions are resolved or accepted by authority, deployment realization is complete, and migration is executable.

## Context and cleanup

Capabilities exchange typed session refs and compact artifacts. Worker prompts, source bodies, raw knowledge, rejected options and reasoning transcripts are purged after the consuming capability acknowledges them. Approved artifacts survive only until the parent objective terminates.
