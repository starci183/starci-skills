# Git governance

How work reaches the remote, for this runtime repository and for every app that `starci app scaffold` creates. The rules are enforced by checks, not by this page
alone: the rule ids below are the contract, and knowledge and docs cite them instead of restating them.

| Rule | Code | What it refuses |
|---|---|---|
| R221 | `CI_TRIGGERS_RELEASE_ONLY` | a workflow trigger other than a push of release tags `v*` and a person dispatching it |
| R222 | `RELEASE_NOTES` | a release tag on HEAD whose CHANGELOG section is missing or still holds TODO, PENDING or TBD |

Who may do what, and which tests run when, is [source process](source-process.md). The release flow itself is `scripts/supervisor/release-cut.mjs` (`cutRelease`), exposed by the CLI as `starci release cut`. It is the only code that pushes main.

## The model

1. **Work stays local.** Lane branches live in worktrees. A land fast-forwards LOCAL main after the land gate and the dependent specs only; a land never pushes.
2. **A release is the only push.** One push is one release: main and one annotated tag `v<version>` move together, or neither moves (`git push --atomic`).
3. **One flow, in order.**
   1. Freeze: every lane of the release is on local main and every worktree is clean.
   2. One release commit: the version bump and the CHANGELOG section (generated from the land merge commits, finished by a person).
   3. Publish the packages from that commit, re-pin the examples, commit.
   4. The full suite once, `npm run check`, and the example proofs (images built and started, Sonar at zero, coverage at its scope).
   5. Linux parity before the push: the CI jobs run locally on Linux, because every local gate runs on the author's machine and CI does not.
   6. The annotated tag on the release commit; its message is the CHANGELOG section.
   7. The atomic push of main and the tag. CI runs once, on that tag.
4. **CI triggers** are a push of `v*` tags and `workflow_dispatch`, nothing else (R221): no branch push, no pull request. One concurrency group per ref. Codecov and
   Sonar upload only in the tag run. The hfs app CI templates carry the same triggers, so every scaffolded app inherits them.
5. **Tags** on the remote are release tags only, annotated, and never moved or deleted. A housekeeping mark (a pre-rebase backup, a merge marker, a salvage
   snapshot) is a ref under `refs/backup/` or `refs/salvage/`, never a tag, and is never pushed as one.
6. **Release notes** are the CHANGELOG section of the tag: Added, Changed, Removed, Fixed, Known limitations, and Evidence (land shas, the full-suite log, the CI run, the
   published package versions). R222 refuses a tag over an unfinished section.
7. **Hotfix** has no release branch: the fix is the next release from main.

## What the release flow refuses

`cutRelease` stops, pushes nothing and says why when:

- the checkout is not on `main`, or has a tracked change (nothing is stashed, reset or cleaned);
- HEAD carries no `v*` tag, more than one, a lightweight tag, or any non-release tag;
- the tag already exists on the remote (a tag is never moved or re-pushed: cut the next version);
- the release notes are unfinished (R222);
- the full suite or `npm run check` is red (the log paths are in the result), or main moved while they ran;
- the pushed range holds a secret;
- the remote refuses either ref (the push is atomic).

The suite runs once per release. Landing runs only the dependent specs, so a red can surface at the release: the lands are merge commits on local main, which keeps a
bisection over them cheap, and a red found after the push is fixed forward with the next tag and recorded under Known limitations, never by moving a tag.

## Risks and how they are handled

- **Unpushed work lives on one disk.** Push lane and main refs to a backup namespace that no workflow triggers on, and keep the salvage snapshots; never rely on the single disk.
- **Linux-only reds after the push.** Linux parity before the push is mandatory, not optional.
- **Many small fixes mean many tags.** Tags are cheap and pre-release numbers exist; do not batch unrelated work to save a tag.
- **A second contributor** gets no CI feedback on branches under tag-only CI: add pull-request CI for that contributor's pull requests only, still never on every push.
