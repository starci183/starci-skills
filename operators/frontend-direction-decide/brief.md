# frontend.direction.decide — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop.

## Job

Decide one evidence-backed, implementation-ready frontend direction for one authorized target, and prove it against the business promise, the published Grammar, the observed implementation and a falsification pass that no candidate survives by taste.

## Done when

Done when the `frontend-direction-decision` names one selected direction that survived every falsification attack, declares its surface class, its presentation delta and its reference standards by class, and carries the scores and declared limits of every rendered candidate, the `ui-coverage` closes the state set under the same surface class, and every candidate that had to be rendered exists as `candidates` served over `host` and printed with a capture per viewport before the decision was written.

## Inputs

`business-promise-authority` (optional), `backend-source-application` (optional), `architecture-decision` (optional), `frontend-direction-decision` (optional)

## Outputs

`frontend-direction-decision` `response/response.md`
`ui-coverage` `response/data/coverage.json`
`candidates` `response/artifacts/<candidateId>.html` (optional)
`direction-image` `response/artifacts/images/<slot>.png` (optional)
`host` `response/artifacts/host.json` (optional)

## Stops

`INVALID_INPUT`, `ROUTE_UNVERIFIED`, `SOURCE_DRIFT`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED`, `GRAMMAR_REQUIRED`, `EVIDENCE_MISSING`, `REFERENCE_EVIDENCE_EXHAUSTED`, `REFERENCE_MISSING`, `NO_VIABLE_DIRECTION`, `DIRECTION_CHOICE_REQUIRED`*, `NO_PROGRESS`
