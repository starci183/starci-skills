# Business overview and nested SRS

Business describes observable product behavior. Architecture decides how to realize it. A source observation or a supplied technical constraint is not permission to invent business policy.

Current accepted Work, not legacy code, defines the intended product. Follow
[source of trust and specification repair](source-of-trust.md) when a case is
missing: complete the owning SRS flows and acceptance, review affected SDS and
re-establish current `done` within authority. Reporting the gap alone is not
completion of an authorized repair.

A project has one bound `.starciwork`. `features/index.yaml` is its product catalog; each actual feature owns its business, architecture and other applicable layers below `features/<feature>/`. The project name is metadata, not another directory. Shared definitions and cross-feature journeys have one accountable feature owner and are referenced across features. Create only layers containing actual work.

New authoring uses this actual folder tree inside the backend-owned `.starciwork`:

```text
.starciwork/features/<feature>/business/
├── index.yaml                 aggregate; no stored state/completion
├── overview/
│   └── index.yaml             readable purpose, outcome, scope, open questions
└── srs/
    ├── index.yaml             aggregate; shared scope/dependencies
    ├── documents/
    │   ├── index.yaml         aggregate
    │   └── update/
    │       └── index.yaml     complete cohesive SRS leaf
    └── A/
        ├── index.yaml         aggregate when it has children
        └── B/
            └── index.yaml     another cohesive SRS leaf
```

Add a folder with its own `index.yaml` under SRS to extend the tree. No registry edit is needed. A leaf may become an aggregate through a deliberate migration; remove its stored state/completion only as part of that migration, preserving old proof and establishing new leaf evidence. Intermediate folders own scope, not another copy of all descendant requirements. Every folder in an authored nested tree should have its own node.

The overview has `kind: business-overview` and a `businessOverview` object. SRS branches and leaves have `kind: business`; leaves own `extensions.work3.specification` with `schema: starci/specification@2`. Do not duplicate it in a compact `business` object or hide it in a prose description. Stable node IDs define dependencies; folder paths are organization, not identity. Put the overview dependency on the SRS aggregate so its descendants inherit that input.

## What a complete leaf contains

- Purpose, scope/exclusions, glossary, assumptions and sourced external constraints.
- Actors: goals, responsibilities, rights and restrictions.
- Stable FR, BR and NFR IDs with intent authority, sources and acceptance links. NFRs state observable criteria; unresolved numeric targets stay decisions, not invented SLAs.
- Business data attributes, validation, sensitivity, ownership, states and transitions; external inputs, outputs, errors and constraints. Explain an empty inventory.
- Each FR links to a full flow: trigger, actors, input, preconditions, ordered actor/request/response/guard/effect steps and success/failure postconditions.
- Alternatives and exceptions: starting step, condition, ordered steps, resume point or end, resulting state and acceptance. Explain an absent branch class.
- Given/When/Then acceptance, observable security denials, unresolved decisions and downstream handoff. Executable UI journeys, when applicable, retain their original actions and expectations.

A title such as **FR-KNOW-03 — Update a knowledge document** is not a flow. The [complete synthetic example](../examples/nested-business/knowledge/business/srs/documents/update/index.yaml) describes opening an owned document, editing, submitting, validating, saving and reading back. It includes cancellation, denied access, invalid content, concurrent modification and uncertain saving, with explicit postconditions. Its policies are illustrative and remain draft; do not copy them into a real product as approved requirements.

Run the example without changing any project:

```sh
node bin/starci.mjs validate examples/nested-business
node --test tests/srs-v2.spec.mjs
```

## Architecture consumes the SRS

Reference the accepted SRS leaf IDs or a deliberate aggregate scope through `refs`/`dependsOn`. The core resolves descendant specifications of referenced aggregates. New source-independent Architecture uses specification@3 `businessRefs` with canonical requirement/flow/acceptance IDs; it does not copy Business rows. Version-2 Architecture remains readable with its old copy-preservation checks, but is not the new authoring format.

Architecture owns logical components, contracts, connections and credential boundaries, data writers/storage, runtime scenarios and compatibility. Its SDS records concrete context, one coherent proposal challenged against a simpler alternative, relevant failure/security scenarios, decisions and limitations. Source files, symbols, revisions, code-impact mapping and executed checks belong to Implementation. Select concerns to match business consequences and operating conditions, not a universal Saga/CQRS/HA checklist. Durable customer data requires explicit storage, backup custody, consistency and recovery prerequisites; design prose is not an executed restore test. See [Architecture SDS](architecture-sds.md).

## Versioning and completion

Version 1 remains readable under its original payload checks. It is not automatically reapproved as version 2. New nested SRS uses version 2, with no Business code/service tables or implementation-check plan. An `uninvestigate` leaf may be a clear placeholder; authored `todo` or `done` SRS requires the complete payload. A branch cannot store state, completion or its own SRS payload.

Reorganization changes ancestry and may change input digests. Preserve published evidence bytes, obtain new scoped verification for changed specifications and never rewrite old digests to restore green status. Schema and reference validation check structure, not truth, user approval, completeness of human reasoning or deployed behavior.
