# library.update — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop. You see only what request.json names; nothing else exists.

## Job

Update one explicitly authorized owner package end to end: reproduce the regression in the package, repair it, bump the patch version, build and gate the package, then consume that exact release in the consumer's dependency metadata with the unchanged consumer regression proof, in two session commits that account for every byte of both; `mode` says which of those halves this branch runs, so an owner package and a consumer that live in two repositories are two routes, two sessions and two branches of this one operator rather than a job nobody can express.

## Done when

Done when the `library-source-application` records exactly one one-parent commit on the session branch whose change set is the declared file set inside the authorized owner package and nothing else, `library-proof` records whose hashes match the committed bytes show the paired regression failing before and passing after and every existing package test, typecheck and build script passing unfiltered, the `library-release` records the archive packed from that commit at the next patch version under its own sha512 digest, that second commit's metadata delta touches only the named dependency entries of the declared consumer manifests and lockfile with the installed package matching the release file for file, each `dependency-proof` with its raw `dependency-log` shows the unchanged consumer regression and every declared consumer gate passing on it, and the `changes` names the paths of both commits; or, under mode `publish`, the package half alone ends at that `library-release` beside its `library-archive` with no consumer metadata touched; or, under mode `consume`, the consumer half alone runs against the `library-release` a sibling session produced, writing the one metadata commit and no package source at all.

Primary output: `library-source-application`

## Inputs

`route`, `library-release` (optional)

## Outputs

`library-source-application` `response/data/library.json` (optional)
`library-proof` `response/data/proofs/<phase>.json` (optional)
`library-release` `response/data/release.json` (optional)
`library-archive` `response/artifacts/release/<file>.tgz` (optional)
`dependency-update` `response/data/dependency.json` (optional)
`dependency-proof` `response/data/proofs/consumer-<phase>.json` (optional)
`dependency-log` `response/artifacts/proofs/consumer-<phase>.log` (optional)
`changes` `response/changes.md`

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `LIBRARY_BOUNDARY_REJECTED`, `LIBRARY_PROOF_FAILED`, `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED`
