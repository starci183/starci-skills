# Business overview and filesystem-split SRS

Business defines observable product behavior. SRS is a source-of-truth contract derived from product intent, stakeholder authority, policy and customer outcomes. It is independent of source code. Architecture maps SRS behavior to a target technical design; Implementation later proves whether actual code conforms.

Write all current canonical SRS content in English, including natural-language prose, YAML and schema
keys, stable IDs and refs, enum literals, protocol identifiers, API fields, variables, types,
operation names and source symbols. Conversation or presentation locale never translates canonical
specifications.

One project has one backend-owned `.starciwork`. `features/index.yaml` is the product catalog and every actual capability owns `features/<feature>/`. Shared rules, data, NFRs, decisions and cross-feature journeys have one accountable feature owner; other features reference their stable IDs.

## Required tree

```text
.starciwork/features/<feature>/business/
├── index.yaml
├── overview/
│   └── index.yaml
└── srs/
    ├── index.yaml
    ├── functional-requirements/
    │   ├── index.yaml
    │   └── <function>/
    │       └── index.yaml
    ├── non-functional-requirements/
    │   ├── index.yaml
    │   └── <quality-requirement>/
    │       └── index.yaml
    ├── business-rules/
    │   ├── index.yaml
    │   ├── <rule>/
    │   │   └── index.yaml
    │   └── policy-decisions/
    │       ├── index.yaml
    │       └── <decision>/
    │           └── index.yaml
    ├── data/
    │   ├── index.yaml
    │   └── <business-entity>/
    │       └── index.yaml
    └── customer-journeys/
        ├── index.yaml
        └── <journey>/
            └── index.yaml
```

Every folder owns one `index.yaml`. Parent indexes aggregate scope and immediate children; they do not copy descendant details or store authored state/completion. Detailed leaves use `extensions.work3.srs` and one schema selected by their folder:

| Folder | Schema |
| --- | --- |
| Functional requirement | `starci/srs-functional-requirement@1` |
| Non-functional requirement | `starci/srs-non-functional-requirement@1` |
| Business rule | `starci/srs-business-rule@1` |
| Policy decision | `starci/srs-policy-decision@1` |
| Business data | `starci/srs-data-definition@1` |
| Customer journey | `starci/srs-customer-journey@1` |

The machine-readable contract is `specifications/srs-sections.json`. A legacy cohesive `starci/specification@2` leaf remains readable, but new work uses the split tree. Do not use a product-specific schema such as `starci-next/srs@1`.

## Functional requirements

`functional-requirements/<function>/index.yaml` owns the complete use case:

- stable ID, title, goal, authority/source and actors;
- trigger, preconditions, validated inputs and observable outputs;
- ordered main-flow steps with actor, request, system response, business effect and acceptance references;
- alternative and exception flows with the exact main step where they fork, condition, ordered handling, resume point or end, remaining state and acceptance;
- success and failure postconditions;
- references to business rules, data, NFRs and unresolved policy decisions;
- Given/When/Then acceptance linked back to its flow and steps;
- an SDS handoff requiring every path to be mapped to logical design and planned verification.

Authority references identify product briefs, stakeholder decisions, policies or approved research as `authorityRefs`. Do not put repository roles, code paths, symbols, commits, `sourceRefs` or implementation observations into SRS.

Main, alternative and exception flows remain inside the same functional requirement file. When a branch class genuinely does not apply, record an explicit rationale; an empty list without rationale is invalid. Repeated requests, concurrent changes, cancellation, timeouts, uncertain outcomes and recovery are specified when they can change the observable result.

## NFR, rules, data and decisions

Each NFR states its business reason, exact FR/flow/journey scope, measurement boundary, metric, conditions and acceptance criteria. It defines what must be measurable, not what execution evidence must be stored. A missing target stays tied to an open policy decision; never invent an SLA, latency percentile, retention period or capacity budget.

Business rules state reusable invariants and link acceptance. Data definitions own meaning, fields, validation, sensitivity, state transitions, invariants, relations and privacy handling. Policy decisions name the accountable role, open question, required decisions, safe behavior while open, affected FR/data/NFR IDs and evidence that closes the decision.

## Customer journeys

`customer-journeys/<journey>/index.yaml` connects a real actor need to an observable result across one or more FRs. Each ordered stage references the owning FR, flow and acceptance IDs. Significant waiting, cancellation, denial and recovery paths reference the matching FR branch; the journey does not restate that flow.

Every FR must participate in at least one journey. A journey is incomplete when its stage order breaks, it links an unrelated flow/acceptance, or its completion claim ignores a referenced failed/cancelled branch.

## Chatbot example

A chatbot feature can split its Business contract without scattering one use case:

```text
business/srs/
├── functional-requirements/ask-a-question/index.yaml       # FR-CHAT-01
├── non-functional-requirements/answer-latency/index.yaml   # NFR-CHAT-01
├── business-rules/conversation-access/index.yaml           # BR-CHAT-01
├── policy-decisions/retention-period/index.yaml             # PD-CHAT-01
├── data/conversation/index.yaml                             # DATA-CHAT-01
└── customer-journeys/get-an-answer/index.yaml               # J-CHAT-01
```

`FR-CHAT-01` owns the whole observable interaction: the learner submits a valid question, sees an accepted/waiting state when work is not immediate, and finally receives a grounded answer or an explicit terminal outcome. Its alternatives cover clarification, cancellation and a repeated request. Its exceptions cover unauthorized conversation access, invalid input, knowledge unavailability, model timeout and an unknown late result. Each branch names its fork step, ordered responses, resume/end point, final state and Given/When/Then acceptance.

`NFR-CHAT-01` defines the measurement boundary from submit action to visible state and links an open decision when no percentile target has been accepted. `BR-CHAT-01` says only a current conversation member can read or append messages. `DATA-CHAT-01` owns request identity, conversation/message states, invariants and privacy. `J-CHAT-01` orders open conversation, ask, wait or clarify, receive result and recover/retry stages by referencing exact FR flow and acceptance IDs.

## Validation and completion

Run `node bin/starci.mjs validate <work-root>`. The validator checks folder/schema matching, parent/leaf ownership, semantic ID uniqueness, FR flow/step/acceptance joins, typed references, journey coverage and data transitions. It does not prove stakeholder acceptance, complete reasoning, implementation or production behavior.

Draft and blocked payloads cannot earn completed Work. An accepted, reviewed SRS leaf is authored as `done` in the same change; `todo` is reserved for a genuinely unfinished draft or unresolved business-design task. An implementation workflow must not reopen or rewrite accepted SRS solely because stale lifecycle metadata says `todo`. Reorganizing folders changes semantic ancestry; preserve old proof and establish new review for changed content. Current accepted SRS remains the input to SDS, UI, implementation and UAT.

The compatibility reader also accepts the pre-upstream `starci/srs@3` leaf format for recovery and explicitly authorized migration. Do not use it for new authoring: new SRS content uses the section schemas published in `specifications/srs-sections.json`. Migration preserves stable IDs and useful evidence but requires a fresh scoped review; it never copies stale `done` state.
