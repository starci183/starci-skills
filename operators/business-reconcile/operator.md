# business.reconcile

## Job

Compare one published business promise, dimension by dimension of its frozen coverage matrix,
against the source that was actually delivered, and republish the head with the reconciliation it
now carries or stop on the first discrepancy that stands.

## Done when

Done when the `business-reconciliation` carries one row per dimension of the frozen coverage matrix
with the delivered evidence each rests on and no discrepancy standing, the `claims` bind every
delivered fact to the frozen source head, and the `model` republishes the same head under the
exclusive lease with the reconciliation it performed and the legal transition it took.

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

## Boundary

Context is read-only apart from the one feature head. The operator writes only `response/` of its
own branch — `response.md`, `response/data/claims.json`, `response/data/model.json` and
`response.json` — plus the republished head under `@worktrees/businesses/<featureId>`. It never
models a promise, freezes or edits a coverage matrix, restates a promise, promotes an example or an
intent into product truth, publishes a head while a discrepancy stands, advances a head through a
transition the lifecycle does not allow, modifies product source, or claims that a quality gate or a
UAT run has passed.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/businesses/<featureId>` | the published head, its state and its frozen coverage matrix, by content address from the registry; the one place this operator writes outside its branch | yes |
| `@workspaces/be` | the routed backend checkout read at the frozen head; every fact claim cites it by path, line range and head | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `backend-source-application` | `backend.generate`; the delivered source the reconciliation reads | yes |
| `quality-verification` | `quality.verify`; the gates that passed on the delivered head, read as evidence only | no |
| `uat-flow-verification` | `uat.verify`; the journey that was walked on the delivered head, read as evidence only | no |

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
| 2 | Read the published head, its state and its frozen coverage matrix, and check the transition and the authority it needs | `featureId`, `targetState`, `approval` | @worktrees/businesses/<featureId>: the current head, its state, its matrix and its fingerprints | — | `HEAD_NOT_RECONCILABLE`, `APPROVAL_REQUIRED` |
| 3 | Normalize the delivered source into fact claims, each with its path, line range and head | — | input `backend-source-application`, @workspaces/be at the frozen head, inputs `quality-verification` and `uat-flow-verification` as evidence only, @tools/git | `response/data/claims.json` | `EVIDENCE_MISSING` |
| 4 | Compare every row of the frozen matrix with the delivered claims and record each discrepancy against its dimension | — | `response/data/claims.json`, @worktrees/businesses/<featureId> for the matrix at the published head | `response/response.md` | `RECONCILIATION_DISCREPANCY` |
| 5 | Republish the head under an exclusive lease with the reconciliation it now carries | — | `response/data/claims.json`, @worktrees/businesses/<featureId> at the previous head | @worktrees/businesses/<featureId> as the new model.json head, `response/data/model.json`, @tools/sourcewrite | `SOURCE_DRIFT` |
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
