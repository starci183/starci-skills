# architecture.decide

## Job

Decide one architecture with its tech stack, system boundaries, and data ownership, and prove it
against the observed current state, the rejected alternatives, verified compatibility, and an
independent critique.

## Done when

Done when the `architecture-decision` names one selected design whose every boundary owns or disowns
its stores and whose every committed write is an operation the `stack-model` restates with a
verified compatibility verdict on every retained component, the `current-state` it was proposed
against was observed at the frozen head, an `independent-critique` from a fresh agent has been
answered, and the confirmed `restatement` of the objective travels with the receipt.

## The objective is restated before it is designed

When the request supplies `objective`, which every run does, step 2 writes `response/restatement.md`
before the current state is observed: plain-language lines, within the count the `restatement` kind
allows, saying what the objective was read to mean, and the person's own words quoted verbatim under
`## Source`. The lines are written in the language of `objective`, because a restatement the person
cannot read confirms nothing; the validator checks the shape and the quote, not the language, so the
language is the agent's duty. The choice is keyed `restatement:<decisionId>` by the effective
`decisionId`: the requirement, or its default when the request leaves it empty. Unless the request
carries that top-level `decisionId` with a `selectedOption` recorded in state.json.choices, the branch
ends `blocked` with `RESTATEMENT_UNCONFIRMED`, `fields.restatement` set and no other output, and
`interaction` of kind `restatement-confirm` on that decisionId offering exactly `as-stated` and
`corrected`. A re-entry that selects `corrected` names the blocked branch in `resume` and carries an
`objective` that differs from that branch's; one that selects `as-stated` carries the same objective;
the branch then proceeds and the done receipt still carries `fields.restatement`. A request that also
carries the `model` Input from `business.decide`, whose promise was confirmed there, still restates
the objective: the objective is the architecture's own reading, and a confirmation of the promise does
not transfer to it.

## Observe before proposing

Nothing is proposed before the current state has been observed at the frozen head of
`@workspaces/be` and written to `response/data/current-state.json` with its own fingerprint. A
proposal written before the observation describes a system simpler than the real one, and every
later comparison inherits that simplification. An observation taken at another head is worse: it
looks rigorous while describing code that no longer exists.

## Incumbency is not authority

The inventory says what the system runs today; that is the most useful and the most dangerous
context this operator receives. An existing framework, datastore, broker, or deployment shape enters
the decision in exactly two roles: as a measurable constraint the target must satisfy, or as observed
evidence about behaviour already proved. It never enters as a reason by itself. A component
justified because it is already there is rejected outright.

## Prove, do not assume

An alternative is counted only when it is materially different, different in ownership or
mechanism, not in wording, and assessed on exactly the trade-off axes the person named. Every
retained component carries a verified verdict with evidence across runtime version, deployable
unit, communication failure, datastore ownership, and backup and restore; a verdict that skipped an
axis is a partial check wearing a complete label. Every boundary answers the data question: it owns
at least one store or states that it owns none; a store names one owning boundary that writes it,
and a second writer exists only with an explicit shared-write justification.

## The decision names every write it commits to

A boundary that owns a store says nothing about who writes it, when, or under which transaction, so
the decision closes that gap itself: `response/data/stack-model.json` carries one `operations` entry
per write this architecture commits to, and `## Operations` of the receipt restates the same rows.
Each entry names its transport, its writer, the stores it touches, its transaction boundary, its
idempotency kind, the migrations it ships, and the coverage-matrix dimensions of the business head it
implements. That list is the frozen contract `backend.generate` fills: the implementation restates
those operations unchanged and may add none, so an operation nobody declared here cannot be written
anywhere. Declaring a write is not the same as choosing an implementation, which is why the writer is
the one file path this operator names.

A standalone migration uses the operation shape in
[`stack-model.schema.json#/$defs/migrationOperation`](../../templates/kinds/stack-model.schema.json#/$defs/migrationOperation).
It remains part of the same ownership decision and independent critique. Naming its source operation
does not authorize applying it to an environment.

## The critique is a nested exchange

After the selected alternative is deepened, the branch pauses: it emits `response/response.json`
with status `waiting` and `awaiting { exchange: critique, kind: independent-critique }`. The
orchestrator writes `critique/request/request.json` with only `response/data/stack-model.json` as
input, never the author's rationale, and runs a fresh agent on this operator's own profile with no
inherited turns. That agent writes only `critique/response/`. When its response is done the paused
agent resumes at the confirmation step. Other branches of the same step keep running throughout.

## Concrete attempt flow

This operator's rows are gated by the shared expected/actual attempt contract in `scripts/attempt-gate.mjs`.

| Observed state | Action | Actual check | Next branch |
| --- | --- | --- | --- |
| prior decision satisfies constraints | reuse as a scored candidate and refresh changed evidence | all mandatory axes and current-state inventory pass | select by recorded policy |
| missing decision | create and deepen requested candidates | selected candidate owns every operation and store | emit after critique matches |
| invalid candidate | repair it or create another; never relabel failure | compatibility and critique expose each failure | new attempt |
| valid candidates tie | choose by goal/mandatory fit, reference/Grammar fit, lower cost, stable id | record scores and first differentiator | continue; never `CHOICE_REQUIRED` merely for tie |

## Boundary

Context is read-only. The operator writes only `response/` of its own branch: `response.md`,
`restatement.md`, `data/current-state.json`, `data/stack-model.json`, the alternatives page when more than one
alternative was asked for, and `response.json`; the critique agent writes only
`critique/response/`. It does not mutate routed source, publish business authority, start or
reconfigure runtime services, name implementation files in the handoff, or claim that an
implementation, a quality gate, or a UAT run has passed.

When the `model` Input is present it is the authority for this run and the published head is lineage
only, because a decision taken against yesterday's promise is a decision against the wrong promise.
When it is absent the published head is the authority.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/be` | the routed backend checkout read at the frozen head; the inventory comes from its manifests and deployment files | yes |
| `@worktrees/businesses/<featureId>` | the published business head, the promise the architecture must keep; evidence when the session carries a `model` Input | yes |
| `@knowledge/patterns` | reusable shapes the scope may bind; a shape, never a selection | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `architecture-decision` | a prior run of `architecture.decide` on the same or an adjacent boundary; lineage that may be contradicted, never ignored | no |
| `model` | `business.decide`; the head that branch modelled, when it has not been published yet | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `objective` | prompt | — | The objective the architecture must achieve, in the person's words |
| `decisionId` | id | slug of `objective` | The name the artifacts carry |
| `alternatives` | number 1–4 | 1 | How many materially different designs to generate; more than one only when a comparison was asked for |
| `tradeoffAxes` | list | cost, complexity, reversibility | The axes every alternative is scored on and the critique attacks along |
| `constraints` | list of `{id, kind, statement}` | — | kind is fixed-intent, measurable, preference, assumption or unknown; at least one fixed-intent |
| `selectionPolicy` | choice | automatic | `automatic`: the operator selects and records why; `approval-required`: the person selects |
| `approval` | id | null | The approved alternative id; required only under `approval-required`, supplied on resume after `CHOICE_REQUIRED` |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume, then classify the prior decision as reusable, missing or invalid against frozen constraints and current source | `resume`, `approval` | `request/request.json`, input `architecture-decision` when present, @workspaces/be at the frozen head | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Restate the objective in the person's language and hold for their confirmation | `objective`, `decisionId` | `request/request.json`: `requirements.objective`, and its top-level `decisionId` and `selectedOption` when the choice is already recorded | `restatement` | `RESTATEMENT_UNCONFIRMED` |
| 3 | Observe the current state | — | @workspaces/be at the frozen head: manifests, configuration, deployment files, @tools/git | `response/data/current-state.json` | `CURRENT_STATE_UNOBSERVED` |
| 4 | Bind the inventory to the business promise | — | `response/data/current-state.json`, input `model` when present, otherwise @worktrees/businesses/<featureId> at its published head | — | `BUSINESS_AUTHORITY_REQUIRED`, `EVIDENCE_MISSING` |
| 5 | Frame the decision | `objective`, `decisionId`, `constraints`, `tradeoffAxes` | `request/request.json` requirements | — | `CONSTRAINT_CONTRADICTION` |
| 6 | Generate the alternatives | `alternatives` | `response/data/current-state.json`, @knowledge/patterns, @tools/websearch | `response/artifacts/<decisionId>-alternatives.html` only when more than one alternative was asked for, @tools/visualize | `NO_VIABLE_ALTERNATIVE` |
| 7 | Score and select automatically; on a valid tie apply goal fit, approved reference or Grammar fit, lower cost, then stable id, recording the first differentiator | `selectionPolicy`, `tradeoffAxes`, `approval` | `response/artifacts/<decisionId>-alternatives.html` when present | — | `CHOICE_REQUIRED` |
| 8 | Deepen the selected alternative and declare the operations it commits to | `constraints` | `response/data/current-state.json`, the bound business head's coverage matrix for the dimensions each operation cites | `response/data/stack-model.json`, including its `operations` | `DATA_OWNERSHIP_UNASSIGNED`, `COMPATIBILITY_UNVERIFIED` |
| 9 | Await the critique: pause, a fresh agent attacks the selection, resume when it answers | — | `critique/response/critique.md` once the exchange is done | `response/response.json` (waiting, awaiting critique) | `CRITIQUE_UNRESOLVED` |
| 10 | Compare critique with every frozen criterion; repair or replace a failing candidate in a new attempt, and confirm a valid candidate without stopping merely for a tie | `selectionPolicy` | `critique/response/critique.md`, `response/data/stack-model.json` | — | `CHOICE_REQUIRED`, `NO_VIABLE_ALTERNATIVE` |
| 11 | Write the handoff and emit | — | everything above | `response/response.md`, `response/response.json` | — |

Under the defaults, step 6 produces one design and no comparison page, step 7 has nothing to
choose, and the decision's quality rests on step 9. When the only alternative fails an attack, step 10
stops with `NO_VIABLE_ALTERNATIVE`, not `CHOICE_REQUIRED`. The handoff names contracts, never
implementation files, because choosing the files is the next domain's job; the one exception is the
writer of each declared operation, which this operator does name, because the implementation may not
choose its own writer.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `architecture-decision` | `response/response.md` | md | yes |
| `restatement` | `response/restatement.md` | md | no |
| `current-state` | `response/data/current-state.json` | data | yes |
| `stack-model` | `response/data/stack-model.json` | data | yes |
| `alternatives` | `response/artifacts/<decisionId>-alternatives.html` | artifact | no |
| `independent-critique` | `critique/response/critique.md` | md | yes |

`response/response.md` carries the `## Operations` table and `response/data/stack-model.json` carries
the matching `operations` array; together they are the mutation contract `backend.generate`
consumes, and no other output of this operator crosses into that step.

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `RESTATEMENT_UNCONFIRMED` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `CURRENT_STATE_UNOBSERVED` | terminate |
| `BUSINESS_AUTHORITY_REQUIRED` | terminate |
| `CONSTRAINT_CONTRADICTION` | terminate |
| `NO_VIABLE_ALTERNATIVE` | terminate |
| `CHOICE_REQUIRED` | fallback |
| `COMPATIBILITY_UNVERIFIED` | fallback |
| `DATA_OWNERSHIP_UNASSIGNED` | terminate |
| `CRITIQUE_UNRESOLVED` | terminate |

## Next

| When | Operator |
| --- | --- |
| the business promise must be modelled again against the decided boundaries | `business.decide` |
| the decision is confirmed and a backend contract changes | `backend.generate` |
| the decision is confirmed and its operations span more than one writer boundary, so they are grouped into modules before one is filled per branch | `backend.plan` |
| the decision is confirmed and a frontend surface changes | `interface.generate` |
