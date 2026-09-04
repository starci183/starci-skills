# architecture.decide — brief

Generated from `operators/architecture-decide/operator.md`. Profile `sol-fresh`, dispatch `fresh`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Decide one architecture with its tech stack, system boundaries, and data ownership, and prove it against the observed current state, the rejected alternatives, verified compatibility, and an independent critique.

## Inputs

| Kind | Required |
| --- | --- |
| `architecture-decision` | no |
| `model` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `objective` | prompt | — |
| `decisionId` | id | slug of `objective` |
| `alternatives` | number 1–4 | 1 |
| `tradeoffAxes` | list | cost, complexity, revers |
| `constraints` | list of `{id, kind,  | — |
| `selectionPolicy` | choice | automatic |
| `approval` | id | null |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `architecture-decision` | `response/response.md` | md | yes |
| `restatement` | `response/restatement.md` | md | no |
| `current-state` | `response/data/current-state.json` | data | yes |
| `stack-model` | `response/data/stack-model.json` | data | yes |
| `alternatives` | `response/artifacts/<decisionId>-alternatives.html` | artifact | no |
| `independent-critique` | `critique/response/critique.md` | md | yes |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `RESTATEMENT_UNCONFIRMED`, `EVIDENCE_MISSING`, `CURRENT_STATE_UNOBSERVED`, `BUSINESS_AUTHORITY_REQUIRED`, `CONSTRAINT_CONTRADICTION`, `NO_VIABLE_ALTERNATIVE`, `CHOICE_REQUIRED`*, `COMPATIBILITY_UNVERIFIED`*, `DATA_OWNERSHIP_UNASSIGNED`, `CRITIQUE_UNRESOLVED`

## Next

`business.decide`, `backend.source.apply`, `frontend.direction.decide`
