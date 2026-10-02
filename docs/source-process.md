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

## Enforcement

Shipped, as checks and code:

- R221 `CI_TRIGGERS_RELEASE_ONLY`: workflows, in `.claude`, its examples and the hfs app templates (so every scaffolded app inherits it), start only on a release tag or by hand.
- R222 `RELEASE_NOTES`: a release tag needs its finished CHANGELOG section.
- The release flow (`starci release cut`, `scripts/supervisor/release-cut.mjs`) is the only path that pushes main, behind one lock function; it refuses a push of main without a new
  annotated `v*` tag, a non-release tag, and a dirty tree, and it runs L4 once.

Planned, in alpha.4 and owned by their own lanes (rule ids are claimed in their lanes, not here):

1. Role rights in the PreToolUse command guard: deny a push, a tag, a publish and a commit to the worker and op roles; deny whole-suite test patterns outside the release cut and the
   verify ops; deny an install without the host lock. The role comes from the seat or dispatch the guard already knows (the RIGHTS lane).
2. App hook templates: the pre-commit hook is L0 only (typecheck moves to the op gate); the pre-push hook is a release gate check (HEAD carries a new release tag made by the release
   cut and a recorded L4 log for it) and runs no tests (the RIGHTS lane).
3. `.claude` gets the same two hooks (the RIGHTS lane).
4. Test budgets: a land run targets 15 minutes or less, and a spec file over 60 seconds needs a shared fixture (the TEST-SPEED lane).
5. The host lock as a runtime API: one heavy run at a time, owned by a role (the RIGHTS lane; the release cut calls it through one function until it lands).
