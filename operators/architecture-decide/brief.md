# architecture.decide — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop.

## Job

Decide one architecture with its tech stack, system boundaries, and data ownership, and prove it against the observed current state, the rejected alternatives, verified compatibility, and an independent critique.

## Done when

Done when the `architecture-decision` names one selected design whose every boundary owns or disowns its stores and whose every committed write is an operation the `stack-model` restates with a verified compatibility verdict on every retained component, the `current-state` it was proposed against was observed at the frozen head, an `independent-critique` from a fresh agent has been answered, and the confirmed `restatement` of the objective travels with the receipt.

## Inputs

`architecture-decision` (optional), `model` (optional)

## Outputs

`architecture-decision` `response/response.md`
`restatement` `response/restatement.md` (optional)
`current-state` `response/data/current-state.json`
`stack-model` `response/data/stack-model.json`
`alternatives` `response/artifacts/<decisionId>-alternatives.html` (optional)
`independent-critique` `critique/response/critique.md`

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `RESTATEMENT_UNCONFIRMED`, `EVIDENCE_MISSING`, `CURRENT_STATE_UNOBSERVED`, `BUSINESS_AUTHORITY_REQUIRED`, `CONSTRAINT_CONTRADICTION`, `NO_VIABLE_ALTERNATIVE`, `CHOICE_REQUIRED`*, `COMPATIBILITY_UNVERIFIED`*, `DATA_OWNERSHIP_UNASSIGNED`, `CRITIQUE_UNRESOLVED`
