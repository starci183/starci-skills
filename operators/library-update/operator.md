# library.update

## Job

Update one explicitly authorized owner package end to end: reproduce the regression in the package,
repair it, bump the patch version, build and gate the package, then consume that exact release in the
consumer's dependency metadata with the unchanged consumer regression proof, in two session commits
that account for every byte of both; `mode` says which of those halves this branch runs, so an owner
package and a consumer that live in two repositories are two routes, two sessions and two branches of
this one operator rather than a job nobody can express.

## Done when

Done when the `library-source-application` records exactly one one-parent commit on the session
branch whose change set is the declared file set inside the authorized owner package and nothing
else, `library-proof` records whose hashes match the committed bytes show the paired regression
failing before and passing after and every existing package test, typecheck and build script passing
unfiltered, the `library-release` records the archive packed from that commit at the next patch
version under its own sha512 digest, that second commit's metadata delta touches only the named
dependency entries of the declared consumer manifests and lockfile with the installed package
matching the release file for file, each `dependency-proof` with its raw `dependency-log` shows the
unchanged consumer regression and every declared consumer gate passing on it, and the `changes` names
the paths of both commits; or, under mode `publish`, the package half alone ends at that
`library-release` beside its `library-archive` with no consumer metadata touched; or, under mode
`consume`, the consumer half alone runs against the `library-release` a sibling session produced,
writing the one metadata commit and no package source at all.

## One package, one consumer, one job

A package repaired and never consumed repairs nothing the person can see, and a consumer bumped to a
release nobody proved is a version number. This operator is both halves in order: the package half
writes the paired regression, repairs the behaviour, bumps the patch version, runs the package gates
and commits; the consumer half packs that commit into the release, installs it into the consumer with
exact metadata, proves the unchanged consumer regression and the consumer gates, and commits again.

## The three modes

The two halves are one job, not one checkout. `mode` says which of them this branch runs, and every
gate below reads only the half its mode needs:

- `full` — the default. The owner package and the consumer live in the routed checkout, both plans
  are supplied, and the branch makes both commits, package first.
- `publish` — the owner route alone. `plan` is supplied and `consumer` is not; the branch repairs the
  package with its before and after proof, bumps the version, commits once, packs the archive and
  records the `library-release` that identifies it. No consumer metadata is read or written, and no
  consumer section may appear in the receipt. Publishing that release to a registry is a person's
  authority, which no operator of this tree holds: the record carries its publication as pending, and
  a run that claims otherwise is refused.
- `consume` — the consumer route alone. `consumer` is supplied and `plan` is not; the input is the
  `library-release` of an earlier branch — a sibling session's, imported into this session, or an
  earlier branch of this one — and the job is exactly the consumer half: the exact manifest delta,
  the lock identity, the dependency closure and the consumer proofs against that release. No package
  source is written, no package section may appear in the receipt, and the package identity and the
  version consumed are read from the release record rather than from a plan.

So an owner package in one repository and its consumer in another are a `publish` branch on the owner
route and a `consume` branch on the consumer route, the second binding the first's `library-release`
through `producer-import`; a `chain` route that names this operator is asking for the first of those.

## Boundary of the package half

The package manifest at the frozen base proves the package's identity; a caller-supplied directory
name does not. Every declared file is inside that package and the route's write roots. Symlinks,
nested package boundaries, consumer files, new dependencies, script changes, CSS, assets, markup
structure, classes and inline style changes are refused. Only existing behavior files, their paired
regression tests, the existing manifest's next patch version, the package changelog and package
version metadata in a lockfile may change. A workspace lockfile is allowed only when the plan and
route both name it; its parsed content may change only the bound package entry's version. Presentation
changes use the interface pipeline. The package is never published, pushed, merged or tagged here.

## Boundary of the consumer half

The consumer plan pins the consumer manifests, the npm lockfile, the unchanged regression and the
complete delivery gates. The release is identified by its sha512 digest and the version the package
half bumped to — the tarball this run packed under `full` and `publish`, the archive beside the bound
`library-release` under `consume`; nothing is fetched from a registry. Only the named dependency value
in the consumer manifests' existing dependencies may change. Lock changes are limited to those
manifest dependency entries and the installed entries of that same package; a workspace link entry
stays what it was. Existing versions used by other workspaces stay intact. No transitive dependency,
script, option, UI, test, source or presentation value is edited.

## Proof before mutation

Run `validate.mjs <branch> --preflight` before writing. It reads the typed plans the mode names, the
bound route and the Git state, refuses a dirty tree, and proves the boundaries of the halves that
will run; a package path is resolved only where a package half runs. Under `full` and `publish`, write
the paired tests first. Run `run-proof.mjs <branch> before`; it requires behavior and manifests to
remain at the base, and records the declared regression's failing assertion. Apply the behavior repair
and the next patch version, then run the helper for `after` and every declared package gate. Each
existing package test, typecheck and build script is required without filters. Commit the declared
package set once, then pack the archive and record the release. Under `full` and `consume`, run
`install.mjs <branch> baseline` and `run-proof.mjs <branch> consumer-before` against the installed
version and the unchanged consumer regression, `install.mjs <branch> release` to consume the bound
release within the exact metadata boundary, and the helper for `consumer-after` and every declared
consumer gate; `test:ci` receives `COVERAGE_BASE_SHA` from the commit the consumer half runs on and
records it in its proof. The helpers execute only the existing scripts or the regression binary of a
declared dependency, with argument arrays and no shell interpolation, and record output, exit status,
exact file hashes, script body and timestamp. Every installed regular file is compared byte for byte
with the packed release; a version label alone is insufficient. Commit the consumer metadata once. The
final validator verifies each one-parent commit against its base, the complete Git change set of each,
the committed file hashes and every captured proof. A bare claim that a test passed, an absent log or
a proof from different bytes is rejected.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/fe` | the routed checkout: the owner package, its consumer, or both, at the frozen base; mutation is confined to its session branch | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `route` | `workspace.bind`; the verified checkout, session policy and write roots | yes |
| `library-release` | a `library.update` branch under mode `publish`, imported into this session through `producer-import` or produced by an earlier branch of it; required under mode `consume` and refused under the other two | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `mode` | choice | full | `full` runs both halves in the routed checkout; `publish` runs the owner half alone and ends at the recorded release; `consume` runs the consumer half alone against a bound `library-release` |
| `plan` | object | null | The closed library-behavior-plan schema: owner package identity, exact file set, paired regression, existing scripts and next patch; supplied under `full` and `publish`, absent under `consume` |
| `consumer` | object | null | The closed dependency-plan schema: the consumer manifests and lockfile that pin the package, the unchanged consumer regression and the complete delivery gates; supplied under `full` and `consume`, absent under `publish` |
| `resume` | token | null | The blocked branch token when re-entering with a changed plan or proof |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the request and preflight the halves the mode names before the first write | `mode`, `plan`, `consumer`, `resume` | `request/request.json`, input `route`, input `library-release` under `consume`, @workspaces/fe at the base, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `LIBRARY_BOUNDARY_REJECTED`, `DEPENDENCY_BOUNDARY_REJECTED` |
| 2 | Write only the paired regression tests in the owner package and prove the failure | `plan` | @workspaces/fe at the base, @tools/shell | @workspaces/fe/branch/session within the test ceiling, @tools/sourcewrite, `library-proof` | `LIBRARY_PROOF_FAILED` |
| 3 | Repair the declared behavior and bump the next patch version | `plan` | @workspaces/fe inside the package ceiling | @workspaces/fe/branch/session within the declared file set, @tools/sourcewrite | `LIBRARY_BOUNDARY_REJECTED` |
| 4 | Run the regression and the complete package test, typecheck and build scripts | `plan` | @workspaces/fe, @tools/shell | `library-proof` | `LIBRARY_PROOF_FAILED` |
| 5 | Commit the package delivery once and verify its Git change set and proof hashes | `plan` | @workspaces/fe at the package commit, @tools/git | @workspaces/fe/branch/session, `library-source-application` | `LIBRARY_BOUNDARY_REJECTED`, `LIBRARY_PROOF_FAILED` |
| 6 | Pack the archive from the package commit and record the release it identifies | `plan` | @workspaces/fe at the package commit, @tools/shell | `library-archive`, `library-release` | `DEPENDENCY_BOUNDARY_REJECTED` |
| 7 | Install the baseline in the consumer and run the unchanged consumer regression | `consumer` | @workspaces/fe, the bound release, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 8 | Install the bound release within the exact consumer metadata boundary | `consumer` | @workspaces/fe and the bound release, @tools/shell | @workspaces/fe/branch/session within the metadata ceiling, @tools/sourcewrite | `DEPENDENCY_BOUNDARY_REJECTED` |
| 9 | Verify the installed bytes and run the consumer regression and complete gates | `consumer` | @workspaces/fe, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 10 | Commit the consumer metadata once and verify its delta and proof hashes | `consumer` | @workspaces/fe at the consumer commit, @tools/git | @workspaces/fe/branch/session, `dependency-update` | `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED` |
| 11 | Emit | — | everything above | `changes`, `response/response.json` | — |

Steps 2 to 6 are the package half and run under `full` and `publish`; steps 7 to 10 are the consumer
half and run under `full` and `consume`. Under `full`, `response.json` carries both shas under
`commits`, the package commit first, and the `dependency-update` names the package commit as its
`base`; under `publish` it carries the package commit alone, under `consume` the consumer commit
alone, whose base is the frozen route head. The consumer proofs are the phases `consumer-before`,
`consumer-after` and `consumer-<gate>`, so they sit beside the package proofs without overwriting them.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `library-source-application` | `response/data/library.json` | data | no |
| `library-proof` | `response/data/proofs/<phase>.json` | data | no |
| `library-release` | `response/data/release.json` | data | no |
| `library-archive` | `response/artifacts/release/<file>.tgz` | artifact | no |
| `dependency-update` | `response/data/dependency.json` | data | no |
| `dependency-proof` | `response/data/proofs/consumer-<phase>.json` | data | no |
| `dependency-log` | `response/artifacts/proofs/consumer-<phase>.log` | artifact | no |
| `changes` | `response/changes.md` | md | yes |

Every output but the receipt belongs to one half, so which of them a done branch must carry is the
mode's answer and not a column's: `validate.mjs` requires the package set under `full` and `publish`,
the consumer set under `full` and `consume`, and refuses the other half's set as a section that
branch had no authority to write.

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `LIBRARY_BOUNDARY_REJECTED` | terminate |
| `LIBRARY_PROOF_FAILED` | terminate |
| `DEPENDENCY_BOUNDARY_REJECTED` | terminate |
| `DEPENDENCY_PROOF_FAILED` | terminate |

## Next

| When | Operator |
| --- | --- |
| the package or consumer commits must pass independent quality verification | `quality.verify` |
| the consumer commit is in place and the head must be served before the surface that raised the finding is observed | `runtime.serve` |
| the release is consumed and the surface that raised the finding must be measured again | `interface.audit` |
