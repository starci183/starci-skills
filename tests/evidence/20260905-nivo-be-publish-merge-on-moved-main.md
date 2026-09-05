# 2026-09-05 — publishing a session branch onto a moved main (nivo/be, ab36b8d6 → fae6462e)

Session `20260905-102233-nivo-be-publish-reachability` on StarCi Skills 2.1.0, processor Fable 5.1
standing in for the bound profiles (recorded as `boundProfile`/`ranProfile` on every receipt).
Mission: land the be half of the Setup reachability repair, `session/20260905-074125-nivo-environment.preflight`
at `ab36b8d6`, on `nivo-backend` main, which had moved from the session base `c87accaf` to `fae6462e`
(the repository-wide lint baseline, session `20260905-005141-nivo-lint-baseline`).

## What ran

| Branch | Operator | Outcome |
| --- | --- | --- |
| 1/1 | `environment.preflight` | blocked `ENVIRONMENT_NOT_READY` on the known `host.deps.be` drift, resolved by the person's goal block; 23 checks, 16 ok, 6 skipped, 1 wall; both validators green |
| 2/1 | `workspace.bind` | done: nivo/be bound on the session worktree `D:/Repositories/nivo-be-publish-20260905-102233` at `fae6462e`, `node_modules` junctioned under `sharedInstall`; both validators green |
| 3/1 | `backend.generate` | not dispatched (below) |
| 100/1, 101/1 | imported | the architecture decision (074125 step 4) and the backend receipt at `ab36b8d6` (074125 step 5), both accepted by the import gate |

Nothing was merged, committed or pushed. `origin/main` is still `fae6462e`. The session worktree is
clean at `fae6462e` and its branch carries no commit.

## The wall

`git merge-tree --write-tree fae6462e ab36b8d6` exits 1 with one conflict, in
`src/features/core/api/core/graphql/queries/agent-workspace/my-agent-workspace-control-center/my-agent-workspace-control-center.handler.ts`
(`graphql-types/response.ts` auto-merges). The hunk is mechanical: main's lint baseline reformatted the
`findOne` call directly beneath the three `instance` / `isActive` / `runtime` lines the fix rewrote, so the
two changes touch adjacent lines and git cannot pick. The resolution is to keep the fix's three lines;
the auto-merge already carries main's formatting elsewhere in the file.

Under the tree's own law that merge has no author:

1. `git.publish` is the only operator that merges, and a conflict there is `NON_FAST_FORWARD`
   (domain `remote`, routing kind `external`): a person resolves it
   (`operators/git-publish/operator.md:64-67`).
2. `backend.generate` never merges (`operators/backend-generate/operator.md:90-91`, and the Boundary at
   `:161`), so a "scope fix branch that authors the merge", the chain the person confirmed in the goal
   block, is outside the operator and was not dispatched.
3. The orchestrator may not merge either: a merge commit nobody's receipt registers is
   `SESSION_MISSING` at the publish (`operators/git-publish/validate.mjs:49`).

## Three gates that refuse a merge commit even once a person resolved the conflict

| Where | What it does | Why it is a defect |
| --- | --- | --- |
| `scripts/workspace-checkout.mjs:125` `LAWFUL_REFLOG_ENTRY = /^commit(?: \(initial\))?:/` | a source-writing branch's checkout may gain only `commit:` reflog entries between its base and its recorded commit | git writes `merge <ref>: Merge made by the 'ort' strategy.` for an auto merge and `commit (merge): <subject>` for a resolved one (measured in a scratch repository, two parents confirmed), so a merge commit made in a session checkout is refused as if it were a stash or a reset; the 2.1.0 lineage names stash, reset, force, clean, a checkout of another branch, rebase and am, never a merge |
| `operators/git-publish/validate.mjs:122` | the published head must equal the `Verified commit` | `operator.md:64-66` allows a merge commit when the target moved and the gates were re-run on the merge result; that head is never the verified commit, so the allowed path can never validate |
| `operators/git-publish/validate.mjs:49` (via `:150`) | a done producer branch in the session must list every pushed head under `commits` | the merge commit `git.publish` makes at step 6 is registered by no producer, so a merge-commit publish is always `SESSION_MISSING` |

The person's standing ruling for this situation (recorded in `20260905-005141` `brief.peers`: "merge
current main into the session branch first so the publish is a fast-forward") runs into the first gate
when an operator does it and into the third when the orchestrator does it.

## Outcome (11:16, the person's relayed answer)

No hand merge and no gate change. 3/1 was replanned under goal v1 as a `backend.generate` scope fix
re-applying the behaviour on the session branch cut from `fae6462e`: the three control-centre files
written as `ab36b8d6` carries them and passed through `eslint --fix`, which left them byte-identical to
`ab36b8d6` while `lint:check` over the whole checkout exits 0, so the baseline's reformatting of the
handler was never a lint requirement. One commit `ca60f4195f355d000bbd31e1d110d74c0c01d98c`; handler
spec 18/18. 4/1 `quality.verify` at that head: lint (overall), typecheck, three Nest builds, the full
unit lane 596 suites / 2730 tests, coverage unconfigured. 5/1 `git.publish`: `main` fast-forwarded
`fae6462e` → `ca60f419`, pushed through `pre-push` (lint:check exit 0, test:unit 596/2730,
`PINNED_AGENTOS_CHART_PATH` in backslash form), junction unlinked, worktree and branch removed. Every
branch green under both validators; the session ledger validates as done. `origin/main` carries the fix
as a new commit, not `ab36b8d6` by ancestry; the old session branch is untouched.

The three gate defects above still stand for any future merge-commit publish.

## What clears it

- A person resolves the conflict, or authorises the resolution rule above, and the tree owner takes the
  three gates through `UPDATE.md`: admit `commit (merge):` in a session checkout (and say so in the
  canon), and let `git.publish` record a merge commit whose second parent is the verified commit as the
  published head, with the re-run gate results beside it. Until then the be fix stays on
  `session/20260905-074125-nivo-environment.preflight` in `D:/Repositories/nivo-be-reach-20260905-074125`.
- The two environment facts the chain would then need are already measured: the pre-push hook's unit
  lane needs `PINNED_AGENTOS_CHART_PATH` as a Windows-native path and a `.gitmounts/data` clone in the
  checkout that pushes; the `host.deps.be` drift (@nestjs 11.2.1, pg 8.23.0, typeorm 0.3.31 against the
  lockfile) is accepted and every gate says it measured the installed tree.
