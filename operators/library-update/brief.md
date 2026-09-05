# library.update — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when the `library-source-application` records exactly one one-parent commit on the session branch whose change set is the declared file set inside the authorized owner package and nothing else, `library-proof` records whose hashes match the committed bytes show the paired regression failing before and passing after and every existing package test, typecheck and build script passing unfiltered, the `library-release` records the archive packed from that commit at the next patch version under its own sha512 digest, that second commit's metadata delta touches only the named dependency entries of the declared consumer manifests and lockfile with the installed package matching the release file for file, each `dependency-proof` with its raw `dependency-log` shows the unchanged consumer regression and every declared consumer gate passing on it, and the `changes` names the paths of both commits; or, under mode `publish`, the package half alone ends at that `library-release` beside its `library-archive`, published to the registry the package manifest names under the archive's own integrity unless the request asked for no publication, with no consumer metadata touched; or, under mode `consume`, the consumer half alone runs against the `library-release` the earlier owner branch in the same user host session produced, or a compatible historical release imported from a sibling session, writing the one metadata commit and no package source at all.

Primary output: `library-source-application`

## Inputs

`route`, `library-release`?, `knowledge-repair-receipt`?

## Outputs

`library-source-application` `response/data/library.json`?
`library-proof` `response/data/proofs/<phase>.json`?
`library-release` `response/data/release.json`?
`library-archive` `response/artifacts/release/<file>.tgz`?
`dependency-update` `response/data/dependency.json`?
`dependency-proof` `response/data/proofs/consumer-<phase>.json`?
`dependency-log` `response/artifacts/proofs/consumer-<phase>.log`?
`changes` `response/changes.md`
`knowledge-coverage` `response/data/knowledge-coverage.json`?
`family-understanding` `response/data/family-understanding.json`?

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `LIBRARY_BOUNDARY_REJECTED`, `LIBRARY_PROOF_FAILED`, `LIBRARY_PUBLISH_REJECTED`, `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED`
