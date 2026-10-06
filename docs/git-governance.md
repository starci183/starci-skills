Task: push main fast-forward so CI runs on every main commit, and cut each release with its annotated tag and finished notes

# Git governance

How work reaches the remote, for this runtime repository and for every app that `starci app scaffold` creates (the runtime pushes main and tags; an app's CI starts on its release tag). The rules are enforced by checks, not by this page
alone: the rule ids below are the contract, and knowledge and docs cite them instead of restating them. Every git action goes through the CLI (`starci git ...`, over the
runtime's one git layer, and `starci release cut`); this page shows no raw git command. Who may do what, and which tests run when, is [source process](source-process.md).

| Rule | Code | What it refuses |
|---|---|---|
| R221 | `CI_TRIGGERS_RELEASE_ONLY` | a workflow trigger other than a push of release tags `v*`, a person dispatching it and, in the runtime's own workflows, a push to `main`; an example or an app template takes the tag and the dispatch only |
| R222 | `RELEASE_NOTES` | a release tag on HEAD whose CHANGELOG section is missing or still holds TODO, PENDING or TBD |

The release flow is `scripts/supervisor/release-cut.mjs` (`cutRelease`), exposed by the CLI as `starci release cut --tag v<version>`. It is the only code that pushes a release tag (with main), and
it uses the same git call files as the CLI's git verbs, never a git process of its own.

## The model

1. **Work starts local.** Lane branches live in worktrees. A land fast-forwards LOCAL main after the land gate and the dependent specs only; a land itself does not push.
2. **Main is pushed fast-forward.** A fast-forward push of `main` to `origin` needs no tag and starts CI. A release is main and one annotated tag `v<version>` pushed together in one atomic push, or neither moves. The pre-push gate refuses a force push, a rewind, a delete of main, a tag without its L4 record, and every other branch.
3. **One flow, in order.**
   1. Freeze: every lane of the release is on local main and every worktree is clean.
   2. One release commit: the version bump and the CHANGELOG section (generated from the land merge commits, finished by a person).
   3. Publish the packages from that commit, re-pin the examples, commit.
   4. `starci release cut --tag v<version>`: it checks the notes (R222), runs L4 once (the full row of the [test ladder](source-process.md): every spec, lint, checks, tsc, the
      example installs, proofs and images, and the Linux-parity step: the light CI jobs run once in a Linux container on this host before the push, so the first GitHub run is not the first Linux run; each step to a recorded log; a skip caused by missing infrastructure fails it), makes sure main did not move, scans the pushed range, creates the
      ANNOTATED tag on the release commit with the CHANGELOG section as its message, and pushes main and the tag atomically.
   5. Linux parity before the push: the CI jobs run locally on Linux, because every local gate runs on the author's machine and CI does not.
   6. CI runs on the main push and on the tag; the GitHub Release is made from the CHANGELOG section.
4. **CI triggers** of the runtime are a push to `main`, a push of `v*` tags and `workflow_dispatch`, nothing else (R221): no other branch, no pull request. One concurrency group per ref; a newer
   push to main cancels the older main run, a tag run is never cancelled. Codecov takes the coverage of every run; Sonar scans the runs of `main` (a main push or a dispatch of main), since the commit of a release tag is the commit the main push already scanned. The hfs app CI templates (the CI and images workflows; the e2e workflow stays manual) take a push of `v*` tags and `workflow_dispatch` only, so every scaffolded app runs CI once per release.
5. **Tags** on the remote are release tags only, annotated, and never moved or deleted. A housekeeping mark (a pre-rebase backup, a merge marker, a salvage
   snapshot) is a ref under `refs/backup/` or `refs/salvage/`, never a tag, and is never pushed as one.
6. **Release notes** are the CHANGELOG section of the tag: Added, Changed, Removed, Fixed, Known limitations, and Evidence (land shas, the L4 logs, the CI run, the
   published package versions). R222 refuses a tag over an unfinished section.
7. **Hotfix** has no release branch: the fix is the next release from main.

## Commits

Every commit message is `type(scope): summary` with one of the types `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `land` or `release`, followed by trailers:

- `Co-Authored-By:` the agent or person that wrote it, and a lane or workflow id (`Lane:` or `Workflow:`);
- a land commit also carries `Land-Verified:` (the pre-verified tip), `Specs: n/n` and `Check: n/n`, so a land states what it ran;
- a release commit is `release(<version>): ...` and its CHANGELOG section is the tag message.

## What the release flow refuses

`starci release cut` stops, pushes nothing and says why when:

- the checkout is not on `main`, or has a tracked change (nothing is stashed, reset or cleaned);
- the tag is not named, is not `v<version>`, is lightweight, sits on another commit, or already exists on the remote (a tag is never moved or re-pushed: cut the next version);
- the release notes are unfinished (R222);
- an L4 step is red or absent, or a test executed in no leg: every test must have passed on the host run or in the Linux container run, a skip that passed in the other leg is listed with the leg
  where it passed, and a skip nothing covered (missing infrastructure, a platform no leg has, any undeclared skip) fails L4, except the declared browser-conditional ones, which are listed by name;
- main moved while L4 ran, or the pushed range holds a secret;
- the remote refuses either ref (the push is atomic).

A parked remote is not a refusal: the owner may park the remote's push url (a `pushurl` that reads `DISABLED-<reason>`) so that nothing but the release can push. The release cut pushes through the remote's fetch url for its one push, moves the remote-tracking ref itself and never writes the configuration; any other push url is the owner's choice and is used as set.

L4 runs once per release. Landing runs only the dependent specs, so a red can surface at the release or in the CI run of a main push: the lands are merge commits on main, which keeps a
bisection over them cheap, and a red found after the push is fixed forward with the next commit or tag and recorded under Known limitations, never by moving a tag.

## Risks and how they are handled

- **Unpushed work lives on one disk.** Push main fast-forward often, keep lane refs in a backup namespace that no workflow triggers on, and keep the salvage snapshots; never rely on the single disk.
- **Linux-only reds after the push.** Linux parity before the push is mandatory, not optional.
- **Many small fixes mean many tags.** Tags are cheap and pre-release numbers exist; do not batch unrelated work to save a tag. A main push is not a release: only the tag is.
- **A second contributor** gets no CI feedback on a branch before it reaches main: add pull-request CI for that contributor's pull requests only, never on every branch push.
