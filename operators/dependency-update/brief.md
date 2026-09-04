# dependency.update — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop.

## Job

Consume one verified package release by changing only its exact dependency metadata, then prove the unchanged consumer regression and complete declared delivery gates before one session commit.

## Done when

Done when the `dependency-update` records exactly one session commit whose metadata delta touches only the named dependency entries of the declared manifests and lockfile, the installed package matches the digest-verified release file for file, and each `dependency-proof` with its raw `dependency-log` shows the unchanged regression and every declared gate passing on that commit, whose paths the `changes` names.

## Inputs

`route`

## Outputs

`dependency-update` `response/data/dependency.json`
`dependency-proof` `response/data/proofs/<phase>.json`
`dependency-log` `response/artifacts/proofs/<phase>.log`
`changes` `response/changes.md`

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED`
