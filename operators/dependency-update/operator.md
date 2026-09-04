# dependency.update

## Job

Consume one verified package release by changing only its exact dependency metadata, then prove the
unchanged consumer regression and complete declared delivery gates before one session commit.

## Boundary

The plan pins the consumer base, package versions, exact consumer manifests and npm lockfile, the
published tarball URL and integrity, and a session artifact with the same digest. The selected base
may be a verified descendant of the canonical route head; it must belong to the same Git repository.
Only the named dependency value in existing dependencies may change. Lock changes are limited to
those manifest dependency entries and installed entries of that same package. Existing versions
used by other workspaces stay intact. No transitive dependency, script, option, UI, test, source or
presentation value is edited. Nothing is published, pushed, merged, tagged or served here.

Run install.mjs <branch> baseline before preflight and install.mjs <branch> release after the before proof. Both modes derive the exact consumer session cwd from the validated route and use fixed npm arguments; caller cwd and ad hoc install commands are not accepted. The release helper stops if npm changes unrelated metadata; restore only that unrelated churn before the next proof. test:ci receives COVERAGE_BASE_SHA from the frozen plan base and records it in its proof.

Run the preflight before writing. Run `run-proof.mjs <branch> before` against the original installed
version and existing failing regression. Install the verified release using install.mjs,
changing only the declared metadata. Run `after` and every declared gate with the helper.
The helper checks the installed package against every regular file in the digest-verified tarball;
an installed version label alone is insufficient. It captures raw command logs as artifacts and
records their hashes. The test code stays unchanged. Run all pinned complete test, lint, typecheck
and build gates available in the root manifest. A filtered regression never substitutes for them.
Commit exactly once, then validate the real commit, metadata delta, installation and proof hashes.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/fe` | the verified consumer repository and its session worktree at the selected descendant base | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `route` | `workspace.bind`; canonical checkout identity, source head and exact write roots | yes |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `plan` | object | — | The closed dependency-plan schema, including release identity, selected consumer base, exact metadata paths, existing regression and complete gates |
| `resume` | token | null | The blocked branch token after a changed release or installation |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the request, session, ancestry and verified artifact before writing | `plan`, `resume` | `request/request.json`, input `route`, @workspaces/fe, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `DEPENDENCY_BOUNDARY_REJECTED` |
| 2 | Install the baseline with install.mjs, then run the unchanged regression | `plan` | @workspaces/fe, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 3 | Install the verified package with install.mjs release within the exact metadata boundary | `plan` | @workspaces/fe and the verified release artifact, @tools/shell | @workspaces/fe/branch/session within the metadata ceiling, @tools/sourcewrite | `DEPENDENCY_BOUNDARY_REJECTED` |
| 4 | Verify installed bytes and run the regression and complete gates | `plan` | @workspaces/fe, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 5 | Commit once and verify the actual metadata delta and proof hashes | `plan` | @workspaces/fe, @tools/git | @workspaces/fe/branch/session, `dependency-update`, `changes`, `response/response.json` | `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED` |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `dependency-update` | `response/data/dependency.json` | data | yes |
| `dependency-proof` | `response/data/proofs/<phase>.json` | data | yes |
| `dependency-log` | `response/artifacts/proofs/<phase>.log` | artifact | yes |
| `changes` | `response/changes.md` | md | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `DEPENDENCY_BOUNDARY_REJECTED` | terminate |
| `DEPENDENCY_PROOF_FAILED` | terminate |

## Next

| When | Operator |
| --- | --- |
| the metadata commit requires independent quality verification | `quality.verify` |
