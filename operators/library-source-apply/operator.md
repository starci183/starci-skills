# library.source.apply

## Job

Repair existing behavior inside one explicitly authorized owner package, prove its regression and
package gates, and commit exactly one next-patch delivery on the bound session branch.

## Boundary

This operator owns library implementation maintenance. It does not compose or restyle product
surfaces and takes no presentation resolution. The package manifest at the frozen base proves its
identity; a caller-supplied directory name does not. Every declared file is inside that package and
the route's write roots. Symlinks, nested package boundaries, consumer files, new dependencies,
script changes, CSS, assets, markup structure, classes and inline style changes are refused.
Only existing behavior files, their paired regression tests, the existing manifest's next patch
version, the package changelog and package version metadata in a lockfile may change. A workspace
lockfile is allowed only when the plan and route both name it; its parsed content may change only
the bound package entry's version. Presentation changes use the frontend pipeline.

The operator never publishes a package, pushes, merges, tags, touches another checkout, changes a
gate or claims an application audit or UAT pass. A package delivery remains subject to quality and
the independently authorized publication boundary.

## Proof before mutation

Run `validate.mjs <branch> --preflight` before writing. It reads the typed plan, bound route and Git
state, refuses a dirty tree, and proves the package and session boundary. Write the paired tests
first. Run `run-proof.mjs <branch> before`; it requires behavior and manifests to remain at the
base, and records the declared regression's failing assertion. Apply the behavior repair and next
patch version, then run the helper for `after` and every declared gate. Each existing test,
typecheck and build script is required without filters. The helper executes only the existing
package scripts or the regression binary of a declared dependency, with argument arrays and no
shell interpolation, and records output,
exit status, exact file hashes, script body and timestamp. The after regression and package gates
run on identical file contents; the regression tests are identical before and after.

Stage only the declared set and commit once. The final validator verifies the one-parent commit
against the base, the complete Git change set, committed file hashes and the captured proofs. A
bare claim that a test passed, an absent log or proof from different bytes is rejected.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/fe` | the owner package's routed checkout at the frozen base; mutation is confined to its session branch | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `route` | `workspace.bind`; the verified checkout, session policy and write roots | yes |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `plan` | object | — | The closed library-behavior-plan schema: owner package identity, exact file set, paired regression, existing scripts and next patch |
| `resume` | token | null | The blocked branch token when re-entering with a changed plan or proof |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate request and preflight before the first write | `plan`, `resume` | `request/request.json`, input `route`, @workspaces/fe at the base, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `LIBRARY_BOUNDARY_REJECTED` |
| 2 | Write only the paired regression tests and prove the failure | `plan` | @workspaces/fe at the base, @tools/shell | @workspaces/fe/branch/session within the test ceiling, @tools/sourcewrite, `library-proof` | `LIBRARY_PROOF_FAILED` |
| 3 | Repair the declared behavior and next patch version | `plan` | @workspaces/fe inside the package ceiling | @workspaces/fe/branch/session within the declared file set, @tools/sourcewrite | `LIBRARY_BOUNDARY_REJECTED` |
| 4 | Run the regression and complete test and build scripts | `plan` | @workspaces/fe, @tools/shell | `library-proof` | `LIBRARY_PROOF_FAILED` |
| 5 | Commit once and verify the actual Git change set and all proof hashes | `plan` | @workspaces/fe at the commit, @tools/git | @workspaces/fe/branch/session, `library-source-application`, `changes`, `response/response.json` | `LIBRARY_BOUNDARY_REJECTED`, `LIBRARY_PROOF_FAILED` |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `library-source-application` | `response/data/library.json` | data | yes |
| `library-proof` | `response/data/proofs/<phase>.json` | data | yes |
| `changes` | `response/changes.md` | md | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `LIBRARY_BOUNDARY_REJECTED` | terminate |
| `LIBRARY_PROOF_FAILED` | terminate |

## Next

| When | Operator |
| --- | --- |
| the owner package commit must pass independent quality verification | `quality.verify` |
