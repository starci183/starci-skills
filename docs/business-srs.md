# Business requirements: the fr, br, nfr, data, journey and decision families

Business defines observable product behavior. Its records are a source-of-truth contract derived from product intent, stakeholder authority, policy and customer outcomes. They are independent of source code. Architecture (the `sds` family, see [architecture-sds.md](architecture-sds.md)) maps that behavior to a target technical design; Implementation later proves whether actual code conforms.

## Progressive authoring

For a not-yet-implemented capability, author the smallest decision-complete records for the next selected
implementation slice. They must settle the actor goal, observable outcome, material invariants and
permissions, relevant main/alternative/exception behavior, acceptance and consequential open decisions.
They need not predict unrelated future capabilities or reversible source-local mechanics.

A reviewed record remains `state: todo` while implementation, test/E2E or UAT evidence is open.
Use `activity: investigating|implementing|verifying` to show current work and `blockers[]` for impediments;
do not invent another lifecycle state. The bounded `business.decide` job may pass once the records are usable
downstream, but that job result is not Work completion. During implementation, concrete observations may
expose a missing observable case. They are feedback, not business authority: revise the record only from
accepted intent or an owner decision, preserve unaffected content, record the change and
invalidate only affected downstream proof. File names, private helpers and library choices remain in
Implementation.

Write all current canonical content in English, including natural-language prose, YAML and schema
keys, stable IDs and refs, enum literals, protocol identifiers, API fields, variables, types,
operation names and source symbols. Conversation or presentation locale never translates canonical
records.

One project has one backend-owned `.starciwork`. The root `index.yaml` is the product catalog and every actual capability owns `features/<feature>/`. Shared rules, data, NFRs, decisions and cross-feature journeys have one accountable feature owner; other features reference their stable IDs.

## Layout

Every business record is a flat family folder directly under its feature. There is no `business/`, `overview/` or nested grouping folder; `modules/schemas/work-layout.yaml` owns where a record lives.

```text
.starciwork/features/<feature>/
├── index.yaml                       # work/feature@1, the feature's readable overview
├── fr/<name>/index.yaml             # work/functional-requirement@1
├── nfr/<name>/index.yaml            # work/non-functional-requirement@1
├── br/<name>/index.yaml             # work/business-rule@1
├── data/<name>/index.yaml           # work/data@1
├── journey/<name>/index.yaml        # work/customer-journey@1
└── decision/<name>/index.yaml       # work/policy-decision@1
```

Each record is a complete typed document of its own family schema, owns one `index.yaml`, and may nest deeper by name segment (`fr/documents/update/index.yaml`) without any other family name appearing inside a family folder. Do not scaffold empty folders.

| Family | Schema | File |
| --- | --- | --- |
| Functional requirement | `work/functional-requirement@1` | `modules/schemas/work-functional-requirement.schema.yaml` |
| Non-functional requirement | `work/non-functional-requirement@1` | `modules/schemas/work-non-functional-requirement.schema.yaml` |
| Business rule | `work/business-rule@1` | `modules/schemas/work-business-rule.schema.yaml` |
| Business data | `work/data@1` | `modules/schemas/work-data.schema.yaml` |
| Customer journey | `work/customer-journey@1` | `modules/schemas/work-customer-journey.schema.yaml` |
| Policy decision | `work/policy-decision@1` | `modules/schemas/work-policy-decision.schema.yaml` |

These schemas own each record's required fields and sections; this page states only the authoring policy around them. `modules/schemas/index.yaml` catalogs them and `modules/models/kinds.yaml` names which ops read and write each family. Do not use a product-specific schema such as `my-app/srs@1`.

## Functional requirements

`fr/<name>/index.yaml` owns the complete use case:

- stable id, title, actors and trigger, with authority/source in `refs` or the owning rule's `authorityRefs`;
- ordered `mainFlow` steps, the path when everything works;
- `exceptionFlows`, each a path out when something goes wrong, naming the step where it forks, the condition, the handling and the resulting state;
- `postconditions` for success and failure;
- `composes`, `refs` and `dependsOn` to business rules, data, NFRs and unresolved decisions;
- `requiresProof` and `provenBy`, so every path is mapped to planned verification.

Authority references identify product briefs, stakeholder decisions, policies or approved research. Do not put repository roles, code paths, symbols, commits or implementation observations into a business record.

Main and exception flows remain inside the same functional requirement file. When a branch class genuinely does not apply, record an explicit rationale; an empty list without rationale is invalid. Repeated requests, concurrent changes, cancellation, timeouts, uncertain outcomes and recovery are specified when they can materially change the observable result of the selected slice. Do not manufacture generic edge cases with no plausible actor, state or acceptance consequence.

## NFRs, rules, data and decisions

Each NFR states its `quality`, `observableCriterion`, `measurement` boundary and `appliesTo` scope (exact FR, flow or journey). It defines what must be measurable, not what execution evidence must be stored. A missing target stays tied to an open decision; never invent an SLA, latency percentile, retention period or capacity budget.

Business rules state reusable invariants as `statements` and carry their checkable `acceptance` criteria (given/when/then, addressed as `<rule id>#<criterion id>`). A rule is true whatever screen or endpoint it surfaces on. Data definitions own meaning, `fields`, validation, sensitivity, `stateMachine`, `invariants`, relations and privacy handling. Decisions name the open `question`, the `options`, the `outcome`, safe behavior while open, what the decision `blocks` and the evidence that closes it.

Before presenting a numbered owner choice, author `options` as at least two distinct concrete,
mutually exclusive policy outcomes, with the consequence of each. An unprepared draft may
omit `options`, but cannot become an actionable choice from its agenda, report text or old UI labels.
The canonical `question` and `options` bind the owner request together. A receipt selecting a topic
such as "Whether notice is required" does not establish a yes/no policy. Preserve that receipt
as history and return the unresolved policy to its owner; never reinterpret or rewrite the receipt.
On workflow reconciliation, a historical authenticated receipt is withdrawn from active semantics only
when its selected label and complete displayed option set match the canonical agenda,
or the canonical record binds that exact ask and receipt and explicitly says its question-form
selection did not settle policy. The same receipt must have continued into an unfinished requester, and the
open record must not name the label as an explicit outcome. The runtime snapshots the receipt, old question,
operation identity and requester continuation, removes only their active dependency effect, and re-prepares
from current canonical `options`. Ambiguous, unlinked or already accepted requester state fails closed.

## Customer journeys

`journey/<name>/index.yaml` connects a real actor need to an observable result across one or more FRs (and across features, via `crossesFeatures`). Its ordered `steps` are phrased as the person's actions and expectations, and `requirements` names the FRs each step relies on. Significant waiting, cancellation, denial and recovery paths reference the matching FR exception flow; the journey does not restate that flow.

Every FR should participate in at least one journey. A journey is incomplete when its step order breaks, it links an unrelated FR, or its completion claim ignores a referenced failed/cancelled branch.

## Chatbot example

A chatbot feature can split its business contract without scattering one use case:

```text
features/chat/
├── fr/ask-a-question/index.yaml            # FR-CHAT-01
├── nfr/answer-latency/index.yaml           # NFR-CHAT-01
├── br/conversation-access/index.yaml       # BR-CHAT-01
├── decision/retention-period/index.yaml    # PD-CHAT-01
├── data/conversation/index.yaml            # DATA-CHAT-01
└── journey/get-an-answer/index.yaml        # J-CHAT-01
```

`FR-CHAT-01` owns the whole observable interaction: the learner submits a valid question, sees an accepted/waiting state when work is not immediate, and finally receives a grounded answer or an explicit terminal outcome. Its exception flows cover clarification, cancellation, a repeated request, unauthorized conversation access, invalid input, knowledge unavailability, model timeout and an unknown late result. Each names its fork step, ordered responses, resume/end point and final state.

`NFR-CHAT-01` defines the measurement boundary from submit action to visible state and links an open decision when no percentile target has been accepted. `BR-CHAT-01` says only a current conversation member can read or append messages. `DATA-CHAT-01` owns request identity, conversation/message states, invariants and privacy. `J-CHAT-01` orders open conversation, ask, wait or clarify, receive result and recover/retry steps by referencing the FR ids they rely on.

## Validation and completion

Run `node bin/starci.mjs validate <work-root>`. The validator checks each record against the schema its own `schema:` const names, the flat family layout, id uniqueness, typed references, journey coverage and data transitions. It does not prove stakeholder acceptance, complete reasoning, implementation or production behavior.

Draft and blocked records cannot earn completed Work. A reviewed record is authored as `todo` and remains the current product contract for downstream design, UI, implementation and UAT. `todo + activity: idle` means defined but not currently being worked; `todo + activity: investigating|implementing|verifying` means in progress. Only final reconciliation may author `done`, after current business, design, code, test/E2E and UAT evidence bind the same delivery revision and every required assertion passes. Missing, stale or mismatched evidence leaves the record `todo` and the workflow partial or blocked. Moving or renaming a record changes its semantic ancestry; preserve old proof and establish fresh evidence for changed content.
