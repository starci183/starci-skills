# business.reconcile

## Job

Compare one published business promise, dimension by dimension of its frozen coverage matrix,
against the source that was actually delivered, and republish the head with the reconciliation it
now carries or stop on the first discrepancy that stands.

## Done when

Done when the `business-reconciliation` carries one row per dimension of the frozen coverage matrix
with the delivered evidence each rests on and no discrepancy standing, the `claims` bind every
delivered fact to the frozen source head, and the `model` republishes the same head under the
exclusive lease with the reconciliation it performed and the legal transition it took, archived under
its content address and named by the head index with the state it now holds.

## A reconciliation reads delivered source, never a plan

Nothing is modelled here. The head was decided and its coverage matrix frozen by `business.decide`;
this operator takes that matrix as it stands and asks, for every row, whether the source a backend
run delivered enforces what the row promised. The Input `backend-source-application` is therefore
required, because a reconciliation with no delivered source is an opinion about code nobody read,
and `implemented` is never published on the strength of a plan: it is published here, after the
comparison, or not at all. A feature with no published head has nothing to reconcile against, and a
head whose state does not admit the target transition cannot take it; both are
`HEAD_NOT_RECONCILABLE`, handed to the person who decides the promise, never invented here.

## A discrepancy stops, it is never averaged

Every row of the matrix ends in one of two states: the delivered evidence enforces it, cited by a
fact claim bound to the frozen source head, or it does not, and the discrepancy is written against
the dimension in the person's terms. One standing discrepancy stops the branch with
`RECONCILIATION_DISCREPANCY` and publishes no head, because a head republished over a known gap is a
promise that is true in the offer and false at the guard. An example, a screenshot or an owner's
intent illustrates a promise; only an observed fact in the delivered source proves it enforced, and a
claim that cites a source nobody bound is `EVIDENCE_MISSING`.

## One flat authority root

One feature owns exactly one head directory, `<businesses root>/features/<featureId>`, whose
`model.json` is the head, and the republished head is written under an exclusive lease on that
alias. `features/` is the only segment between the root and a feature, so a head that is not exactly
`features/<featureId>` is refused. The transition is legal against the state the head was found in,
the previous head is named rather than erased, and the coverage fingerprint travels unchanged, so
quality and UAT can prove they consumed the same matrix rather than a paraphrase of it.

## Publishing a head is three writes or none

A head written to its feature directory alone is a head no other reader finds: the index of the
businesses root still names the head it replaced, and everything that binds a promise by content
address goes on reading the promise that was superseded. Publishing the head is therefore this
operator's job and not a person's afterwards, and it is one write set: the feature directory, the
canonical model archived in the content store under its own address, and the feature's entry in the
head index naming that address with the state the head now holds, the base head unchanged, the head
replaced, the delivered source heads the claims bind, and the addresses of the frozen claims and
matrix. An index that names a source head no fact claim binds rests the promise on evidence nobody
read, and is refused the same way a missing object is.

A head carries two numbers and they are never substituted for each other. Its **address** — what the
store files it under and what the index names — is the document exactly as it stands, its own
fingerprint field included, which is what makes an archived object hash to its own name. Its
**fingerprint** is the document without that field, and it is what a receipt correlates a matrix or a
claim set by. Reading one where the other is meant publishes a head under a name the store does not
hold.

`previousHeadRef` names the archived object of the head it replaced, never a session file: a session
is deleted and a lineage pointing into one stops resolving, so a lineage is a chain of objects. When
the head being replaced was never archived, this operator archives it first, from the feature
directory as it stood, and the receipt's `## Lineage` says which of the two happened.

## A reconciled head is reconciled again when the delivery moves

A head published `implemented` binds its fact claims to one source head. When the delivered source moves
after that — a repair under a red gate, a re-verification at a new commit — the promise is compared again
at the new head and, when no discrepancy stands, republished `implemented` over the transition
`implemented->implemented`: the same state, new bindings, because a published head that cites a commit the
gates never passed on is a promise resting on the wrong evidence. Only this operator takes that transition;
a decision that changes the promise still moves the state.

## A promise is proved as far as it was measured

A delivery is compared with its promise, and how much of the delivery anybody looked at is part of that
comparison. The `## Unchecked` table copies the feature's open unchecked ledger into the receipt, so a reader
of one reconciliation sees the limits of the delivery beside its claims instead of inferring them from a
run they were not present for. An entry of tier `secondary` is a unit the mission's journey never entered
and does not stand in the way of `implemented`. An entry of tier `journey` is a state of a surface the
journey itself passes through that no lane measured: the promise has been carried as far as it has been
carried and no further, which is what `in-progress` already means, so the head is republished in that
state rather than declared enforced. Nothing new is invented to say it; the lifecycle already had the
word.

## Concrete attempt flow

This operator's rows are gated by the shared expected/actual attempt contract in `scripts/attempt-gate.mjs`.

| Observed state | Action | Actual check | Next branch |
| --- | --- | --- | --- |
| promise and delivery match | reuse content; update allowed lifecycle/lineage | compare every dimension and evidence | publish reconciled head |
| promise missing or invalid | repair nothing here | record complete missing/invalid set | handoff `business.decide` |
| delivery discrepancy | record every mismatch | each row names promise, actual and evidence | handoff `backend.generate`; retry on new head |
| incomplete evidence | publish no implemented claim | comparison is inconclusive with unchecked coverage | emit typed replan/repair evidence |

## Boundary

Context is read-only apart from the one head it publishes. The operator writes only `response/` of
its own branch — `response.md`, `response/data/claims.json`, `response/data/model.json` and
`response.json` — plus that head under `@worktrees/businesses`, which is three files and no others:
the feature directory `features/<featureId>`, the objects the publication archives under
`objects/sha256/<address>.json`, and the feature's entry in the head index
`business-registry-v1.json`. It never models a promise, freezes or edits a coverage matrix, restates
a promise, promotes an example or an intent into product truth, publishes a head while a discrepancy
stands, leaves a published head unarchived or unnamed by the index, rewrites another feature's entry
or an object already archived, advances a head through a transition the lifecycle does not allow,
modifies product source, or claims that a quality gate or a UAT run has passed.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/businesses/<featureId>` | the published head, its state and its frozen coverage matrix, by content address from the head index; the one place this operator writes outside its branch, as the feature directory, the archived objects and the feature's index entry together | yes |
| `@workspaces/be` | the routed backend checkout read at the frozen head; every fact claim cites it by path, line range and head | yes |
| `@worktrees/unchecked/<product>` | the feature's open unchecked coverage: the units and states the delivery's own verification did not take, listed in the receipt beside the claims | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `backend-source-application` | `backend.generate`; the delivered source the reconciliation reads | yes |
| `quality-verification` | `quality.verify`; the gates that passed on the delivered head, read as evidence only | no |
| `uat-flow-verification` | `uat.verify`; the journey that was walked on the delivered head, read as evidence only | no |
| `api-verification` | `api.verify`; the end-to-end suite run as a client against the delivered head, read as evidence only | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `featureId` | id | — | The one feature whose published promise is reconciled |
| `targetState` | choice | — | `implemented` when the delivered source enforces every row, or `in-progress` when the head is republished with what was delivered so far |
| `approval` | id | null | The owner approval the transition needs, supplied on resume after `APPROVAL_REQUIRED` |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate, the delivered-source input and the resume | `resume` | `request/request.json`, input `backend-source-application`, @workspaces/be at the frozen head | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Inspect the promise and classify it reusable, missing or invalid before transition checks; hand missing or invalid promise to business.decide and create nothing here | `featureId`, `targetState`, `approval` | @worktrees/businesses/<featureId>: the current head, its state, its matrix and its fingerprints | — | `HEAD_NOT_RECONCILABLE`, `APPROVAL_REQUIRED` |
| 3 | Normalize the delivered source into fact claims, each with its path, line range and head | — | input `backend-source-application`, @workspaces/be at the frozen head, inputs `quality-verification` and `uat-flow-verification` as evidence only, @tools/git | `response/data/claims.json` | `EVIDENCE_MISSING` |
| 4 | Compare every matrix row with delivery, record the complete discrepancy and unchecked sets, and emit typed repair or replan evidence without rewriting the goal | — | `response/data/claims.json`, @worktrees/businesses/<featureId> for the matrix at the published head, @worktrees/unchecked/<product> for what the delivery's verification did not take | `response/response.md` | `RECONCILIATION_DISCREPANCY` |
| 5 | Publish the head under an exclusive lease with the reconciliation it now carries: the feature directory, the object it is archived under and the entry that names it | — | `response/data/claims.json`, @worktrees/businesses/<featureId> at the previous head, its archived object and the head index entry that names it | @worktrees/businesses/<featureId> as the new model.json head, its object in the content store and the feature's entry in the head index, `response/data/model.json`, @tools/sourcewrite | `SOURCE_DRIFT` |
| 6 | Emit | — | everything above | `response/response.json` | — |

A resume begins again at step 1, reuses only unchanged fingerprinted observations, and reads the
delivered source again; a resume that adds no delivered change, approval or evidence is
`NO_PROGRESS`.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `business-reconciliation` | `response/response.md` | md | yes |
| `claims` | `response/data/claims.json` | data | yes |
| `model` | `response/data/model.json` | data | yes |

## The best outcome

On `done`, print **The best outcome** as the promise-to-delivery reconciliation in `response/response.md`, with `response/data/claims.json` and `response/data/model.json` as secondary tables. A mismatch leads with the unresolved claim rows and their evidence instead of claiming the promise is implemented.

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `HEAD_NOT_RECONCILABLE` | terminate |
| `APPROVAL_REQUIRED` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `RECONCILIATION_DISCREPANCY` | terminate |

## Next

| When | Operator |
| --- | --- |
| the head is reconciled against the delivered source and the delivery may be published | `git.publish` |
| a discrepancy stands and the delivered source must be corrected | `backend.generate` |
| the promise itself must be decided again before it can be reconciled | `business.decide` |
