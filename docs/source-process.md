Task: choose the test scope, the change path and the rights of each role for a change

# Source management process

Who may do what, and which test scope runs when, for `.claude` upgrades and for product coding (apps scaffolded by `starci app scaffold` / `starci app scaffold`, worked by
workflows and ops). The git model (local lands, one push per release, CI triggers, tags, release notes) is [git governance](git-governance.md) and is not restated here.

## The test ladder

| Level | Scope | When | Who runs it |
|---|---|---|---|
| L0 static | format and lint of the staged files, hygiene | every commit, seconds | the pre-commit hook |
| L1 targeted | the specs of the changed unit and their importers; tsc and lint of the changed files | while working, every op or worker attempt | the op gate, the worker |
| L2 dependent | the dependent-spec selection (imports and data paths) of the change against local main | lane to local main (pre-verify, land) | the lane lead (pre-verify), the coordinator (land) |
| L3 boundary | the affected integration, contract and e2e specs when the change touches IO (database, queue, Kafka, webhook, saga, jobs) | at the land of that change only | the coordinator, opt-in by touched slot |
| L4 full | every suite: runtime, packages, example unit, integration, e2e and contract, the Docker images, Sonar at zero, coverage per component, the Linux-parity CI jobs run locally | exactly once per release, before the tag | the release cut only |
| L5 CI | the tag's CI on Linux | once per tag, as the confirmation | the CI service |

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
| L4 release cut (once, before the tag) | ALL: the runtime, the packages, and each example's unit, integration, e2e and contract runs | the whole repository and stylelint | the full check, `starci app check` of every example, Sonar at zero and the coverage per component (the existing local gate scans each example and reads its dashboard; the local SonarQube stack is started for it when stopped and put back as found) | every project; first a real `npm ci` in every example, and last the Linux-parity step: the CI-equivalent light jobs derived from `.github/workflows` (installs, the full check set, package clean installs, per example codegen, typecheck, starci app lint and the builds; never a spec suite) in a Linux container on this host |
| L5 tag CI (Linux, once) | as L4 | as L4 | as L4 | as L4 |

Checks run in full from L2 because they are fast and catch structure errors early; the specs are the expensive part, so only L4 runs all of them. L4 is exactly the row above, each
step to a recorded log; every skipped test is reported with its reason, a skip from missing infrastructure (Docker, Postgres, Supabase, a port) fails it, and only the declared
browser-conditional skips (draw-render, draw-rationale, draw-layer) may remain, listed by name. On demand: `unit.verify` (all unit specs of an app) and `e2e.verify` (all e2e of an app).

## Rights by role

| Action | Worker / op | Lead / Kernel | Coordinator / Supervisor | Release cut | Owner |
|---|---|---|---|---|---|
| edit files in its worktree | yes | yes | no (only through a lane) | the version bump, the CHANGELOG and the re-pin only | yes |
| commit | no (the runtime commits a passed slice) | yes, on its branch | land merge commits only | the release commit | yes |
| merge local main into its branch | no | yes | yes | n/a | yes |
| land to local main | no | no | yes (one serial slot) | n/a | yes |
| push to the remote | no | no | backup refs only (`refs/backup/`) | yes: main and one tag, atomically | yes |
| create, move or delete a tag | no | no | no | creates the release tag only | decides the hygiene |
| publish packages | no | no | no | yes, once per release | holds the credentials |
| L0 and L1 tests | yes | yes | yes | yes | yes |
| L2 and L3 tests | no | pre-verify | land | n/a | yes |
| L4 full suite | no | no | no | yes, once | on demand |
| install dependencies | its own worktree, under the lock | its own worktree, under the lock | yes | yes | yes |

## The two flows

**A. A `.claude` upgrade.** A lane branch in its worktree, from local main. Workers run L0 and L1; the lead reviews, commits and runs pre-verify (L2). The coordinator lands L2
(and L3) into local main and backs the refs up. The release cut then bumps the version, writes the CHANGELOG, publishes the packages, re-pins the examples, runs L4, and pushes main
with its tag atomically; L5 confirms; the GitHub Release is made from the CHANGELOG section.

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
the test policy (spec selection, budgets, the `specs.*` switches), the host lock, the rule-catalog entries that enforce these, and the supervisor's own permission and model settings. A
self-upgrade that needs a change there files a proposal for the owner. Path 3 never edits `.claude`: an op that finds a harness defect records a lesson or an upgrade request, which
path 2 or 1 picks up.

## Test budget

A land run targets 15 minutes end to end, and each spec file has a 60-second budget. The measured seconds of every slow spec live in `modules/kernel/spec-durations.yaml` with the one limit; a spec over the limit is reported as an advisory INFO finding ranked by its excess (rule R226, `RT_SPEC_OVER_BUDGET`) in the check stage and listed in the release record. It does not fail the check in alpha.4; the budget becomes blocking once the heavy specs are sped up (alpha.5).

A file goes over budget by repeating setup that one process can share. Reduce it without weakening a test: build one fixture per spec process and reset it between cases, copy a template instead of re-seeding, keep one resident real entry instead of a process per call, inject the clock the production code already accepts, and never hide the cost with a longer timeout. Every test, every assertion and every production entry stays; a speed-up is accepted only with equal test and assertion counts and the mutations of the original spec still caught.

Every tracked JavaScript file must parse (rule R227, `RT_SYNTAX_INVALID`): a spec with a syntax error fails the check stage instead of a land run.

## Enforcement

Shipped, as checks and code:

- R221 `CI_TRIGGERS_RELEASE_ONLY`: workflows, in `.claude`, its examples and the hfs app templates (so every scaffolded app inherits it), start only on a release tag or by hand.
- R222 `RELEASE_NOTES`: a release tag needs its finished CHANGELOG section.
- The release flow (`starci release cut`, `scripts/supervisor/release-cut.mjs`) is the only path that pushes main, behind one lock function; it refuses a push of main without a new
  annotated `v*` tag, a non-release tag, and a dirty tree, and it runs L4 once.

Planned for alpha.4, owned by their own lanes (rule ids are claimed in their lanes, not here):

1. Role rights in the PreToolUse command guard: deny a push, a tag, a publish and a commit to the worker and op roles; deny whole-suite test patterns outside the release cut and the
   verify ops; deny an install without the host lock. The role comes from the seat or dispatch the guard already knows (the RIGHTS lane).
2. App hook templates: the pre-commit hook is L0 only (typecheck moves to the op gate); the pre-push hook is a release gate check (HEAD carries a new release tag made by the release
   cut and a recorded L4 log for it) and runs no tests (the RIGHTS lane).
3. `.claude` gets the same two hooks (the RIGHTS lane).
4. Test budgets: a land run targets 15 minutes or less, and a spec file over 60 seconds needs a shared fixture (the TEST-SPEED lane).
5. The host lock as a runtime API: one heavy run at a time, owned by a role (the RIGHTS lane; the release cut calls it through one function until it lands).
