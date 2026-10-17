Task: choose the test scope, the change path and the rights of each role for a change

# Source management process

Who may do what, and which test scope runs when, for `.claude` upgrades and for product coding (apps scaffolded by `starci app scaffold` / `starci app scaffold`, worked by
workflows and ops). The git model (lands, fast-forward pushes of main, CI triggers, tags, release notes) is [git governance](git-governance.md) and is not restated here.

## The test ladder

| Level | Scope | When | Who runs it |
|---|---|---|---|
| L0 static | format and lint of the staged files, hygiene | every commit, seconds | the pre-commit hook |
| L1 targeted | the specs of the changed unit and their importers; tsc and lint of the changed files; the runtime has no specs of its own, so a runtime change runs `starci runtime verify` | while working, every op or worker attempt | the op gate, the worker |
| L2 dependent | the dependent-spec selection (imports and data paths) of the change against local main | lane to local main (pre-verify, land) | the lane lead (pre-verify), the coordinator (land) |
| L3 boundary | the affected integration, contract and e2e specs when the change touches IO (database, queue, Kafka, webhook, saga, jobs) | at the land of that change only | the coordinator, opt-in by touched slot |
| L4 full | every suite: packages, the scaffold e2e, example unit, integration, e2e and contract, the Docker images, Sonar at zero, coverage per component, the Linux-parity CI jobs run locally | exactly once per release, before the tag | the release cut only |
| L5 CI | the CI run on Linux | the release push of main and every tag, as the confirmation | the CI service |

Everyday verification of the runtime is `starci runtime verify`: the runtime check, `starci release clean-test` of the packages the change touches and `starci release scaffold-e2e`, joined on one commit in one receipt (the check alone runs no test and is not the proof a branch is fit to merge). The runtime has no specs of its own (owner ruling `no-runtime-specs`).

On demand only: `unit.verify` and `e2e.verify` (the owner or the goal asks), and a debugging run of ONE red spec file. Never: the whole suite in a lane, a preview, an audit, a
fresh clone or on main after a land; an install in a worktree someone else is editing; two heavy runs at once on the host (one lock).

A red at L2 or L3 refuses the land. It is re-run once, alone: green on the re-run is a recorded flake (evidence in the land log and a follow-up to fix it), red again is fixed at
the cause. There are no skip lists, no allowlists and no weakened specs.

## What runs at each level

| Level | Specs | Lint | Checks | tsc |
|---|---|---|---|---|
| L0 commit | none | the staged files and format | work hygiene | none |
| L1 working (op gate, worker) | the specs of the change and their importers | the changed files | `starci app lint --changed` (apps), the self-checks touching the change (`.claude`) | the project(s) holding the changed files |
| L2 land (local main) | the dependent specs (imports and data paths) | the changed files | the FULL check set (`starci check run --level L2`): fast and structural | every affected project |
| L3 land touching IO | L2 plus the affected integration, contract and e2e specs | as L2 | as L2 | as L2 |
| L4 release cut (once, before the tag) | ALL: the packages, the scaffold e2e, and each example's unit, integration, e2e and contract runs | the whole repository and stylelint | the full check, `starci app check` of every example, Sonar at zero and the coverage per component (the existing local gate scans each example and reads its dashboard; the local SonarQube stack is started for it when stopped and put back as found) | every project; first a real `npm ci` in every example, and last the Linux-parity step: the CI-equivalent light jobs derived from `.github/workflows` (installs, the full check set, package clean installs, per example codegen, typecheck, starci app lint and the builds; never a spec suite) in a Linux container on this host |
| L5 CI (Linux, the release push of main and the tag) | as L4 | as L4 | as L4 | as L4 |

Checks run in full from L2 because they are fast and catch structure errors early; the specs are the expensive part, so only L4 runs all of them. L4 is exactly the row above, each
step to a recorded log; every skipped test is reported with its reason, and a skipped scaffold e2e test fails it. On demand: `unit.verify` (all unit specs of an app) and `e2e.verify` (all e2e of an app).

## Rights by role

| Action | Worker / op | Lead / Kernel | Coordinator / Supervisor | Release cut | Owner |
|---|---|---|---|---|---|
| edit files in its worktree | yes | yes | no (only through a lane) | the version bump, the CHANGELOG and the re-pin only | yes |
| commit | no (the runtime commits a passed slice) | yes, on its branch | land merge commits only | the release commit | yes |
| merge local main into its branch | no | yes | yes | n/a | yes |
| land to local main | no | no | yes (one serial slot) | n/a | yes |
| push to the remote | no | no | backup refs only; the runtime main never (it moves with a release) | yes: main and one tag, atomically | yes, through the release cut |
| create, move or delete a tag | no | no | no | creates the release tag only | decides the hygiene |
| publish packages | no | no | no | yes, once per release | holds the credentials |
| L0 and L1 tests | yes | yes | yes | yes | yes |
| L2 and L3 tests | no | pre-verify | land | n/a | yes |
| L4 full suite | no | no | no | yes, once | on demand |
| install dependencies | its own worktree, under the lock | its own worktree, under the lock | yes | yes | yes |

## The two flows

**A. A `.claude` upgrade.** A lane branch in its worktree, from local main. Workers run L0 and L1; the lead reviews, commits and runs pre-verify (L2). The coordinator lands L2
(and L3) into local main backs the refs up; local main stays unpushed between releases. The release cut then bumps the version, writes the CHANGELOG, publishes the packages, re-pins the examples, runs L4, and pushes main
with its tag atomically; L5 confirms the tag; the GitHub Release is made from the CHANGELOG section.

**B. Product coding.** One workflow is one worktree from the app's local main. Ops run L0 and L1 through the op gate and the runtime commits each passed slice. The workflow finish
lands into the app's local main with L2 (and L3 for touched IO). The app release (the owner) runs L4 (full unit, integration, e2e, build, images, Sonar), pushes main with its tag
atomically, and L5 confirms. Images and deploys come from the TAG (the images workflow runs on tags), never from a branch push.

## The three change paths

| Step | 1. The owner edits `.claude` by prompt | 2. The supervisor self-upgrades `.claude` | 3. Ops work on an app |
|---|---|---|---|
| Where | a lane worktree on its own branch | its own lane worktree; the protected zone is forbidden | the app's workflow worktree; `.claude` is forbidden |
| Commit | the lead commits (L0) | the supervisor commits (L0) | the runtime commits a passed slice (L0) |
| While working | workers (L1) | L1 | the op gate (L1) |
| Into local main | the coordinator lands (L2, and L3 for IO) | lands at L2, one revertable ref per upgrade | the workflow finish lands (L2, and L3 for touched IO) |
| Release | the owner approves; the release cut runs L4 once and pushes main with its tag | NEVER releases, pushes, tags or publishes: its lands ride the next owner-approved release and are listed in the CHANGELOG as self-upgrades | the owner approves; L4 plus the images, the tag, a deploy from the tag |
| Full run on demand | no | no | `unit.verify` or `e2e.verify` when the owner or the goal asks |

The **protected zone**, which path 2 may not edit (changes there come only through path 1): the guard and its role rights, the release cut and the git hooks, the CI workflow triggers,
the test policy (the real tests of the runtime and the `specs.*` switches), the host lock, the rule-catalog entries that enforce these, and the supervisor's own permission and model settings. A
self-upgrade that needs a change there files a proposal for the owner. Path 3 never edits `.claude`: an op that finds a harness defect records a lesson or an upgrade request, which
path 2 or 1 picks up.

## Syntax

Every tracked JavaScript file must parse (rule R227, `RT_SYNTAX_INVALID`): a spec with a syntax error fails the check stage instead of a land run.

## Enforcement

Shipped, as checks and code:

- R221 `CI_TRIGGERS_RELEASE_ONLY`: the workflows of `.claude` start on a push to main, on a release candidate ref `release/candidate-*` (required in every ci.yml), on a release tag or by hand; its examples and the hfs app templates (so every scaffolded app inherits it) start only on a release tag or by hand.
- R222 `RELEASE_NOTES`: a release tag needs its finished CHANGELOG section.
- The release flow (`starci release cut`, `scripts/supervisor/release-cut.mjs`) is the only path that pushes a release tag, behind one lock function; it pushes main with a new
  annotated `v*` tag, refuses a non-release tag and a dirty tree, and runs L4 once. The pre-push hook of the runtime repository refuses every push of main or of a `v*` tag whose commit is not a release commit ([git governance](git-governance.md), rule 2): a push of the runtime main is a release.

## R208

`RT_PORT_RESTATED` reports a runtime port literal outside its owner, or a port repeated across runtime sources without one owner. Read the UI port through `ui/ports.mjs` and the Sonar host through its owning constant. A runtime reader references that owner instead of repeating its numeric value. Product stack declarations own their service ports and are outside this scan. Both editions share this runtime check.

## R209

`RT_CONFIG_DEFAULT_TWICE` reports a documented runtime configuration default repeated as a literal fallback outside its owner. Import the owner constant or call its accessor, including the owner-language accessor; do not derive a second default in a reader. Tests, generated copies, product templates and stories are outside this scan. Both editions share the same owner rules.

## R210

`RT_VERSION_RESTATED` reports a tracked reference that repeats a dependency's canon-pinned version near its package name. Refer to the pin in `knowledge/hfs/canon-pins.yaml`; package manifests and lockfiles are declared install and resolution sites. Refresher-owned `canon.version`, `provenance.version` and `identity.version` bindings are permitted. Both editions use this runtime check.

## R211

`RT_SLOT_ID_SHAPE` reports a malformed slot identifier or inconsistent suffix vocabulary in an authored slot manifest. Use lowercase kebab segments separated by dots, a declared prefix and an existing parent or shared family. App-kind identifiers name a declared kind. Keep live and banned suffixes disjoint, refuse undeclared synonym pairs and retain both members of a declared same-concept exception. The app and runtime manifests are checked for both editions.

## R227

`RT_SYNTAX_INVALID` reports each parser diagnostic in tracked `.mjs`, `.cjs` and `.js` authored source, with its file and line. Both editions use the same check. Generated roots, vendored build output and managed templates containing render tokens are excluded; clean authored JavaScript passes.

## R228

`RT_IDENTIFIER_UNDECLARED` reports runtime ES-module names without a declaration, import, parameter or permitted global in their enclosing scope. Restore the real binding after moving code; a re-export alone does not bind a local name. Browser globals are permitted only inside functions passed to page evaluation. Both editions use the same runtime module scan.

## R229

`RT_REMOVED_VOCABULARY` reports obsolete names taught by runtime instruction surfaces, including their file, line and replacement from the removed-name catalog. Update instructions to the replacement. Historical records and explicitly marked removed lists are exempt. Both editions use the same catalog and scan.
