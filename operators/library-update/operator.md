# library.update

## Job

Update one explicitly authorized owner package end to end: reproduce the regression in the package,
repair it, bump the patch version, build and gate the package, then consume that exact release in the
consumer's dependency metadata with the unchanged consumer regression proof, in two session commits
that account for every byte of both; `mode` says which of those halves this branch runs, so an owner
package and a consumer that live in two repositories use two isolated worktrees, one branch in each, inside
the same user host session, both owned by this one operator rather than split into unrelated jobs.

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
`library-release` beside its `library-archive`, published to the registry the package manifest names
under the archive's own integrity unless the request asked for no publication, with no consumer
metadata touched; or, under mode
`consume`, the consumer half alone runs against the `library-release` the earlier owner branch in the
same user host session produced, or a compatible historical release imported from a sibling session,
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
  package with its before and after proof, bumps the version, commits once, packs the archive,
  publishes it and records the `library-release` that identifies it. No consumer metadata is read or
  written, and no consumer section may appear in the receipt. Publication is the end of this mode, not
  an errand left for a person: with the package proofs green and the archive packed and digested, the
  archive itself goes to the registry the package manifest names, under that manifest's own
  `publishConfig` for provenance and access, with the credential resolved by name and never printed.
  The registry is then read back: it must serve that exact version, and the integrity it serves must
  equal the digest of the archive the receipt carries. Only then does the record say
  `publication { registry, version, state: "published", integrity, at }`. A registry that already
  serves the version, an integrity that differs, or a refused publish is `LIBRARY_PUBLISH_REJECTED`
  with the registry's own answer as the reason — never a receipt that quietly says pending. A pending
  publication is lawful in one case only: a request that preset `publish: false` because a person will
  publish that archive themselves.
- `consume` — the consumer route alone. `consumer` is supplied and `plan` is not; the input is the
  `library-release` of the earlier owner branch in this user host session, or a compatible historical
  sibling-session release imported into it, and the job is exactly the consumer half: the exact manifest delta,
  the lock identity, the dependency closure and the consumer proofs against that release. No package
  source is written, no package section may appear in the receipt, and the package identity and the
  version consumed are read from the release record rather than from a plan. That record may be
  `published` or `pending`; a pending one is the rare path, because it names an archive that lives
  only inside the producing session, and a consumer whose metadata resolves to a place no other
  checkout has is `DEPENDENCY_BOUNDARY_REJECTED`.

So an owner package in one repository and its consumer in another are a `publish` branch in an
isolated owner worktree and a `consume` branch in an isolated consumer worktree within the same user
host session. The second binds the first's `library-release` through `producer-import`; historical
cross-session imports remain compatible. A `chain` route that names this operator is asking for the
first of those branches.

## Boundary of the package half

The package manifest at the frozen base proves the package's identity; a caller-supplied directory
name does not. Every declared file is inside that package and the route's write roots. Symlinks,
nested package boundaries, consumer files, new dependencies, script changes, undeclared assets and
undeclared public deltas are refused. A behavior plan may explicitly declare a prop, anatomy,
semantic-attribute, token, claim or class delta with concrete owner evidence and exact consumer
impact; semantic markup and attributes that implement that declared package contract are then part
of the owner repair. A behavior file is a script, or the style sheet a package ships its recipes in —
a family whose law lives in CSS repairs that sheet as behavior, with the same paired regression
reading the recipe. Only existing behavior files, their paired
regression tests, the existing manifest's next patch version, the package changelog and package
version metadata in a lockfile may change. A workspace lockfile is allowed only when the plan and
route both name it; its parsed content may change only the bound package entry's version. Presentation
changes use the interface pipeline. The package is never pushed, merged or tagged here, and the only
way it leaves this checkout is the publication step of mode `publish`: the packed archive, whole and
unmodified, to the registry its own manifest names. It never stashes, resets, forces, cleans, rebases or checks out another branch inside the routed checkout, and it deletes nothing by hand under a checkout whose `node_modules` is a junction — a temporary worktree is removed with `git worktree remove --force`. `## Binding` of `changes.md` is where those two laws are read: `Preflight` as `<passed|failed> at <ISO 8601 instant>`, and `Reflog before` and `Reflog after` as `HEAD <reflog entries> <head sha>; stash <reflog entries>` (orchestrator.json#sourceWrites).

## A presentation release is proved on the surface it repairs

The consumer half's before-and-after proof asks the consumer to fail at the installed version and pass
at the release. For a package a consumer calls, that is a consumer test and nothing else will do. For a
package whose behaviour exists only once rendered — a visual family, whose repair is a stamp on the
markup or a rule in the recipe sheet — a consumer that composes the family and calls none of it has no
such test, and one written for the occasion proves the stamp rather than the surface: it passes at the
new version because the attribute is there, whatever the surface then looks like.

So a release may declare the family it realizes, and a release that declares one is a **presentation
release**. Its consume may take the before and after halves from two `interface.audit` branches of the
same session instead: the first at the head the consumer still serves, where the family-owned claims
this release repairs fail and are routed to the family owner as a grammar gap; the second at the head
this branch bumped, where the same claims pass. Both refs must resolve, both audits must judge the same
claims by identifier, the version each observed must be the version its half stands for, and the after
audit must have measured the commit this branch committed — an audit of some other head is an audit of
something else. This authority is lawful nowhere else: a release that names no family is proved by a
consumer regression, because a package a consumer can call can be failed by calling it.

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
will run; a package path is resolved only where a package half runs. Before any mutation it also
freezes the exact Grammar manifest and a family-understanding brief that separates Common semantics,
family style and product facts, then records the search order: reuse, compose, extend the existing
owner, and introduce a new owner only for an evidenced gap. Under `full` and `publish`, write
the paired tests first. Run `run-proof.mjs <branch> before`; it requires behavior and manifests to
remain at the base, and records the declared regression's failing assertion. Apply the behavior repair
and the next patch version, then run the helper for `after` and every declared package gate. Each
existing package test, typecheck and build script is required without filters. Commit the declared
package set once, then pack the archive and digest it. Under `publish`, unless the request preset
`publish: false`, that digested archive is published then and there and the registry is read back
before the release is recorded; under the other two modes the archive is consumed inside this
checkout and reaches no registry. Record the release. Under `full` and `consume`, run
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
| `@knowledge/grammars/<family>` | the concrete route family's INDEX, package DNA snapshot, family definition, idioms, playbook and canonical gaps | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `route` | `workspace.bind`; the verified checkout, session policy and write roots | yes |
| `library-release` | a `library.update` branch under mode `publish`, imported into this session through `producer-import` or produced by an earlier branch of it; required under mode `consume` and refused under the other two | no |
| `knowledge-repair-receipt` | `knowledge.repair`, when this is a retry with a rebound manifest | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `mode` | choice | full | `full` runs both halves in the routed checkout; `publish` runs the owner half alone and ends at the recorded release; `consume` runs the consumer half alone against a bound `library-release` |
| `plan` | object | null | The closed library-behavior-plan schema: owner package identity, exact file set, paired regression, existing scripts, next patch, declared public delta and exact consumer impact; supplied under `full` and `publish`, absent under `consume` |
| `consumer` | object | null | The closed dependency-plan schema: the consumer manifests and lockfile that pin the package, the before-and-after authority — an unchanged consumer regression, or the two audits of a presentation release — and the complete delivery gates; supplied under `full` and `consume`, absent under `publish` |
| `publish` | choice | true | `true` publishes the packed release to the registry when the package proofs are green; `false` leaves it packed for a person; read under mode `publish`, where nothing else makes a release reach a registry |
| `resume` | token | null | The blocked branch token when re-entering with a changed plan or proof |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the request, freeze the exact family manifest and understanding brief, run the request preflight, and preflight the halves the mode names, all before the first write outside the session folder | `mode`, `plan`, `consumer`, `resume` | `request/request.json`, input `route`, input `library-release` under `consume`, @knowledge/grammars/<family>, @workspaces/fe at the base, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `LIBRARY_BOUNDARY_REJECTED`, `DEPENDENCY_BOUNDARY_REJECTED` |
| 2 | Write only the paired regression tests in the owner package and prove the failure | `plan` | @workspaces/fe at the base, @tools/shell | @workspaces/fe/branch/session within the test ceiling, @tools/sourcewrite, `library-proof` | `LIBRARY_PROOF_FAILED` |
| 3 | Repair the declared behavior and bump the next patch version | `plan` | @workspaces/fe inside the package ceiling | @workspaces/fe/branch/session within the declared file set, @tools/sourcewrite | `LIBRARY_BOUNDARY_REJECTED` |
| 4 | Run the regression and the complete package test, typecheck and build scripts | `plan` | @workspaces/fe, @tools/shell | `library-proof` | `LIBRARY_PROOF_FAILED` |
| 5 | Commit the package delivery once and verify its Git change set and proof hashes | `plan` | @workspaces/fe at the package commit, @tools/git | @workspaces/fe/branch/session, `library-source-application` | `LIBRARY_BOUNDARY_REJECTED`, `LIBRARY_PROOF_FAILED` |
| 6 | Pack the archive from the package commit and record the release it identifies | `plan` | @workspaces/fe at the package commit, @tools/shell | `library-archive`, `library-release` | `DEPENDENCY_BOUNDARY_REJECTED` |
| 7 | Publish the digested archive to the registry the manifest names, read the served version and integrity back, and record the publication | `plan`, `publish` | @workspaces/fe at the package commit, `library-release`, @tools/registry, @tools/secrets | `library-release` | `LIBRARY_PUBLISH_REJECTED` |
| 8 | Install the baseline in the consumer and run the unchanged consumer regression, or bind the before audit of a presentation release | `consumer` | @workspaces/fe, the bound release, the `interface.audit` branch this session measured the installed version on, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 9 | Install the bound release within the exact consumer metadata boundary | `consumer` | @workspaces/fe and the bound release, @tools/shell | @workspaces/fe/branch/session within the metadata ceiling, @tools/sourcewrite | `DEPENDENCY_BOUNDARY_REJECTED` |
| 10 | Verify the installed bytes and run the consumer regression and complete gates, or bind the after audit of a presentation release | `consumer` | @workspaces/fe, the `interface.audit` branch this session measured the bumped commit on, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 11 | Commit the consumer metadata once and verify its delta and proof hashes | `consumer` | @workspaces/fe at the consumer commit, @tools/git | @workspaces/fe/branch/session, `dependency-update` | `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED` |
| 12 | Emit | — | everything above | `changes`, `knowledge-coverage`, `family-understanding`, `response/response.json` | — |

Steps 2 to 6 are the package half and run under `full` and `publish`; step 7 is the publication and
runs under `publish` alone, and only where the request did not preset `publish: false`; steps 8 to 11
are the consumer half and run under `full` and `consume`. Under `full`, `response.json` carries both shas under
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
| `knowledge-coverage` | `response/data/knowledge-coverage.json` | data | no |
| `family-understanding` | `response/data/family-understanding.json` | data | no |

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
| `LIBRARY_PUBLISH_REJECTED` | terminate |
| `DEPENDENCY_BOUNDARY_REJECTED` | terminate |
| `DEPENDENCY_PROOF_FAILED` | terminate |

## Next

| When | Operator |
| --- | --- |
| the package or consumer commits must pass independent quality verification | `quality.verify` |
| the consumer commit is in place and the head must be served before the surface that raised the finding is observed | `runtime.serve` |
| the release is consumed and the surface that raised the finding must be measured again | `interface.audit` |
