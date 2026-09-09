# Source-independent Architecture and SDS

Business says what must happen. Architecture explains how the system is designed
to satisfy it. Implementation maps that design to actual source and verifies the
running behavior. None of these documents substitutes for the others.

Use the current accepted SRS/SDS in `.starciwork` as design authority, never an
existing implementation or its passing tests. Follow [specification repair](source-of-trust.md)
when a relevant case is uncovered: revise the owning SRS/SDS as appropriate,
review affected consumers and re-establish current `done` before dependent
implementation. A missing mechanism such as the actual form of restore requires
an explicit design, not a call graph or a generic promise to support recovery.

SDS here means Software Design Specification, including architecture and enough
logical detail to implement without guessing the important mechanisms. It does
not mean a source inventory. Source paths, symbols, revisions, commits and test
commands belong to Implementation. Technologies, topology, API/event contracts,
data models and recovery procedures are legitimate design content.

## Structure and ownership

```text
<scope>/
├── business/
│   ├── index.yaml
│   ├── overview/index.yaml
│   └── srs/
│       ├── index.yaml
│       └── <capability>/<subscope>/index.yaml
└── architecture/
    ├── index.yaml
    ├── overview/index.yaml
    └── sds/
        ├── index.yaml
        ├── structure/<component>/index.yaml
        ├── contracts/<interaction>/index.yaml
        ├── data/<boundary>/index.yaml
        ├── runtime/<scenario>/index.yaml
        ├── deployment/index.yaml
        ├── concerns/<concern>/index.yaml
        └── decisions/<decision>/index.yaml
```

This is an expansion guide, not mandatory scaffolding. Small SDS scopes put
several typed views in one leaf. Split only where a separate owner, reusable
decision or independently understandable design question warrants it. Each
semantic folder has index.yaml; parents aggregate and do not duplicate leaf
payloads or author state. Assets may be nested beside any owning node.

Business splits by capability. SDS splits by design responsibility/view. Do not
mirror each FR into every design folder, nor require one folder per FR. A runtime
scenario may serve multiple SRS flows; exceptions that change responsibility,
consistency or failure behavior need explicit branches/scenarios.

Shared platform design has one owner. Module consumers import the particular
component/contract/data views they use and specify their own differences. Neither
folder nesting nor `extends Module` implies permission, shared database ownership
or an implicit dependency. Solo and cooperator use the same contracts and tree;
only task ownership and change coordination differ.

## Authoring contract

Each authored leaf carries `extensions.work3.specification`, schema
`starci/specification@3`, op `architecture.decide`. The full JSON Schema is
[sds.schema.json](../specifications/sds.schema.json). Business remains SRS@2.

- `purpose`: the selected design responsibility.
- `businessRefs`: canonical owner node ID and exact requirement, flow and
  acceptance IDs. Do not copy their text into SDS. Owners must resolve through
  the node's declared refs/dependsOn, including inherited aggregate inputs.
- `designRefs`: exact canonical SDS owner and view IDs imported from shared
  design. Imports use `node-id#view-id`; local links use `view-id`. `#` is reserved.
- `views`: typed design details; IDs are stable within the owner.
- `decisions`: problem, chosen mechanism, alternatives, rationale, tradeoffs,
  affected views, applicable references, owner, status and revisit conditions.
- `checks`: planned review/test method and expected result, linked to canonical
  SRS acceptance where applicable. These are not execution results.
- `references`: primary design/pattern documentation with explicit applicability.
- `limitations`: what remains unverified, outside scope or dependent on a later
  operating decision. Do not hide a material blocker here while declaring pass.

| View | Required design answers |
| --- | --- |
| overview | Scope, quality drivers, external actors, exclusions. |
| structure | Logical owner, responsibilities, exclusions, allowed dependencies. |
| contracts | Caller, receiver, mode, request/response/errors, authority, timeout, retry, idempotency, compatibility. |
| data | Writer, classification, authoritative/rebuildable role, storage, isolation, consistency, lifecycle, recovery. |
| runtime | SRS flow links, participants, ordered actions, contract/data links, commit points, failures and retry. |
| deployment | Component/store placement, allowed connections, failure domains, configuration/credentials, rollout and rollback. |
| concerns | Relevant problem, concrete mechanism/owner, trigger-impact-response scenarios, checks and residual risk. |

A design reference resolves both identity and view kind: a contract receiver must
be a component, not a store merely bearing a similar name. Declare direction and
ownership. A display shell can present three modules without owning their domain
writes. Cross-module admission is not completion of the receiver's business work.

## Brainstorm and challenge

Start with one coherent proposal. Trace an ordinary journey and put failures at
its significant boundaries. Ask who owns each fact, which transaction commits it,
what another participant can observe, and what happens when the response is lost.
Check invalid/unauthorized input, cancellation, concurrency, duplicate/out-of-order
events, partial completion, exhausted resources and dependency failure when relevant.

Challenge the proposal with a genuinely simpler alternative. Select patterns only
after identifying the problem and tradeoff. A list of Saga/CQRS/Outbox names is not
an architecture; Business must not require them as implementation mechanisms.
Consult the applicable knowledge topic and official reference, then explain why
it fits this scope. Do not create a universal pattern checklist from one incident.

For durable multi-tenant customer data, explicitly inventory authoritative stores,
derived indexes, volumes, configuration, Secrets and encryption keys. Design a
consistent backup point and custody outside the relevant failure domain. Explain
how to rebuild infrastructure, restore one tenant, verify data and safely resume
effects. Volume bytes alone do not establish database consistency or recover
external state. A simple local tool does not require a cluster-loss design.

Do not promise to enumerate every possible edge case. State applicability,
assumptions and residual risk. Do not invent business retention or RPO/RTO numbers;
make technical choices within approved constraints and separate genuine product
decisions from choices the architect can own.

The view separation is informed by [arc42](https://arc42.org/overview/), adapted
here to exclude source mapping. [C4](https://c4model.com/diagrams) supports selecting
only the diagram levels that add value; no code-level diagram is required. This
tree is a StarCi convention, not a claim of ISO/IEEE certification.

## Review, completion and compatibility

Review the whole scope: every selected FR has SRS flows and acceptance; significant
flows have an SDS runtime path; contracts, authoritative data, failure controls and
shared consumers agree. A schema can catch missing fields/IDs/owners, not prove
optimality, correct business meaning or production safety.

`draft` and `blocked` cannot complete a node. `pass` is design readiness, not proof
that code exists or tests ran. Passing SDS requires accepted referenced Business
and shared design, with no unresolved blocking decision. Existing completion
validation remains separate. Do not manufacture evidence to satisfy old records.

`done` remains editable. A semantic change requires review of affected consumers,
not reopening every unrelated branch. Keep canonical content authoritative and
avoid duplicate design/evidence copies. Useful diagrams/videos stay in assets.

Legacy specification@1/@2 remains readable under its original checks. Migration
preserves useful semantics and stable IDs, moves code mapping to Implementation
only under the selected scope, and never carries stale pass/completion to changed
content. Migration is not acceptance. The synthetic fixture in `fixtures/sds.mjs`
and `tests/sds.spec.mjs` exercise source-independent and recursive behavior.
