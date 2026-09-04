# library.update — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop. You see only what request.json names; nothing else exists.

## Job

Update one explicitly authorized owner package end to end: reproduce the regression in the package, repair it, bump the patch version, build and gate the package, then consume that exact release in the consumer's dependency metadata with the unchanged consumer regression proof, in two session commits that account for every byte of both.

## Done when

Done when the `library-source-application` records exactly one one-parent commit on the session branch whose change set is the declared file set inside the authorized owner package and nothing else, `library-proof` records whose hashes match the committed bytes show the paired regression failing before and passing after and every existing package test, typecheck and build script passing unfiltered, the `library-release` packed from that commit carries the next patch version under the integrity the `dependency-update` records, that second commit's metadata delta touches only the named dependency entries of the declared consumer manifests and lockfile with the installed package matching the release file for file, each `dependency-proof` with its raw `dependency-log` shows the unchanged consumer regression and every declared consumer gate passing on it, and the `changes` names the paths of both commits.

Primary output: `library-source-application`

## Inputs

`route`

## Outputs

`library-source-application` `response/data/library.json`
`library-proof` `response/data/proofs/<phase>.json`
`library-release` `response/artifacts/release/<file>.tgz`
`dependency-update` `response/data/dependency.json`
`dependency-proof` `response/data/proofs/consumer-<phase>.json`
`dependency-log` `response/artifacts/proofs/consumer-<phase>.log`
`changes` `response/changes.md`

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `LIBRARY_BOUNDARY_REJECTED`, `LIBRARY_PROOF_FAILED`, `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED`
