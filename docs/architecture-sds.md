# SDS as source-independent architecture

SRS defines observable behavior, rules, journeys and acceptance. SDS maps those outcomes to logical
components, interfaces, data ownership, quality mechanisms, deployment and recovery. Together they
are the upstream source of truth. SDS never contains repository roles, file paths, symbols,
signatures, call graphs, source revisions or executed proof. Implementation owns the mapping from
this logical design to actual code.

Write all natural-language prose in current canonical SDS in Vietnamese. Keep YAML and schema keys,
stable IDs and refs, enum literals, protocol identifiers, API fields, variables, types, operation
names and source symbols in English, including when they appear inside Vietnamese sentences. This
language rule does not translate runtime contracts, knowledge topics or implementation identifiers.

Architecture may inspect a small relevant source/configuration/API surface to check feasibility and
migration impact. Those observations inform a design decision but never become SDS content or
authority. Record the selected logical design, rationale, impact and migration; record actual code
mapping and conformance under Implementation.

## Required tree

```text
.starciwork/features/<feature>/architecture/
├── index.yaml
├── overview/index.yaml
└── sds/
    ├── index.yaml
    ├── flows/{index.yaml,<flow>/index.yaml}
    ├── components/{index.yaml,<component>/index.yaml}
    ├── contracts/{index.yaml,<interface>/index.yaml}
    ├── data/{index.yaml,<model-or-store>/index.yaml}
    ├── quality/{index.yaml,security|performance|reliability/<concern>/index.yaml}
    ├── deployment/{index.yaml,<topology>/index.yaml}
    ├── decisions/{index.yaml,<decision>/index.yaml}
    └── verification/{index.yaml,<scenario>/index.yaml}
```

Every folder owns `index.yaml`. Parents carry `starci/sds-aggregate@1` metadata and no authored
state/completion. Detailed leaves use `extensions.work3.sds`:

| Folder | Schema |
| --- | --- |
| Flow | `starci/sds-flow@1` |
| Component | `starci/sds-component@1` |
| Contract | `starci/sds-contract@1` |
| Data model/store | `starci/sds-data-model@1` |
| Quality concern | `starci/sds-quality@1` |
| Deployment topology | `starci/sds-deployment@1` |
| Design decision | `starci/sds-decision@1` |
| Verification scenario | `starci/sds-verification@1` |

The overview leaf carries `starci/sds-overview@1`: accepted SRS IDs, goals, scope, actors, system
context, quality strategy, constraints, topology references, implementation handoff and design
decisions. The machine-readable contract is `specifications/sds-map.json`. Legacy
source-independent `starci/specification@3` remains readable; it is not the new authoring format.

## Flows and components

`flows/<flow>/index.yaml` traces main, alternative and exception paths from exact SRS IDs to an
observable result. Each entry point and ordered step names a logical `componentRef`, operation,
input/output, contract/data references, transaction behavior and failure references. It also states
preconditions, recovery owner, durable state source, retry identity, safe resume condition,
postconditions, immediate/late result mapping, topology and verification scenarios.

`components/<component>/index.yaml` owns a logical responsibility and kind such as service, worker,
store, gateway, client, external system or UI surface. It links logical interfaces, data, quality
and verification. It must not name a repository, source path, class, function, symbol, signature or
source call graph. Those details are a separate Implementation mapping back to the component ID.

Components are not required to mirror processes or files. A component exists because the design
needs one responsibility boundary; deployment separately decides whether components share a
process or cross a network.

## Contracts, data and topology

Contracts connect `callerComponentRef` to `receiverComponentRef` and state sync/async/in-process
mode, transport, operation, request, response, errors, authorization, timeout, retry, idempotency
and compatibility. Async contracts identify message identity, ordering and duplicate handling.

Each data leaf uses `ownerComponentRef` and identifies authoritative or derived role, store,
fields, states, transactions, consistency, retention and recovery. Deployment placements use
`componentRef` and map logical components/stores to the selected topology, connections,
configuration and credential custody, scaling, failure domains, rollout, rollback and recovery.

For a monolith, show logical module boundaries and in-process interfaces without inventing network
concerns. For microservices, show independent ownership and failure, partial completion and
reconciliation. Shared-database or cross-service writes require an explicit decision.

## Quality, decisions and verification

Quality leaves cover applicable security, performance and reliability mechanisms and scenarios.
Do not invent business SLAs or retention; unresolved targets remain linked to their SRS owner.
Decisions compare viable alternatives and record status, rationale, tradeoffs, affected refs and
revisit conditions.

Verification specifies planned scenarios and expected results linked to SRS acceptance and SDS
scope. It contains no evidence or executed proof. Actual test locations, commands, results and
artifacts belong to Implementation/UAT.

## Logical example

For `FR-CHAT-01`, an SDS flow may say:

```text
Chat UI surface
  -> Conversation API component
  -> Authorization component
  -> Conversation state component
  -> Knowledge retrieval component
  -> Language model gateway
  -> Conversation state component
  -> Chat UI surface
```

Each boundary resolves to a logical component and, where interaction semantics matter, a contract.
The flow still covers invalid input, denial without disclosure, clarification, duplicate request,
timeout, accepted asynchronous work, late-result reconciliation, cancellation races and partial
delivery. It does not prescribe controllers, handlers, repositories, method names or files.

## Review and completion

Validate with `node bin/starci.mjs validate <work-root>`. Structural validity proves only internal
shape and traceability. Review checks that significant SRS branches reach logical components and
observable outcomes, contract/data ownership is unambiguous and material edge cases have selected
mechanisms. Implementation separately maps actual source to these IDs and proves conformance.

Changing accepted SRS invalidates dependent SDS review. Changing logical SDS invalidates affected
Implementation and UAT. Preserve unrelated completed scopes and historical local run state.
