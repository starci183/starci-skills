Task: keep the runtime's remote main still between releases, and cut each release with its annotated tag, finished notes and a green-rows receipt of the exact commit

# Git governance

How work reaches the remote, for this runtime repository and for every app that `starci app scaffold` creates (the runtime pushes main and tags only with a release; an app's CI starts on its release tag). The rules are enforced by checks, not by this page
alone: the rule ids below are the contract, and knowledge and docs cite them instead of restating them. Every git action goes through the CLI (`starci git ...`, over the
runtime's one git layer, and `starci release cut`); this page shows no raw git command. Who may do what, and which tests run when, is [source process](source-process.md).

| Rule | Code | What it refuses |
|---|---|---|
| R221 | `CI_TRIGGERS_RELEASE_ONLY` | a workflow trigger other than a push of release tags `v*`, of release candidate branches `release/candidate-*`, a person dispatching it and, in the runtime's own workflows, a push to `main`; an example or an app template takes the tag, the candidate and the dispatch only; a `ci.yml` without the candidate trigger |
| R222 | `RELEASE_NOTES` | a release tag on HEAD whose CHANGELOG section is missing or still holds TODO, PENDING or TBD |

The release flow is `scripts/supervisor/release-cut.mjs` (`cutRelease`), exposed by the CLI as `starci release cut --tag v<version>`. It is the only way the remote main of the runtime and a release tag move (the pre-push hook of the runtime repository refuses every other push of them), and
it uses the same git call files as the CLI's git verbs, never a git process of its own.

## The model

1. **Work starts local.** Lane branches live in worktrees. A land fast-forwards LOCAL main after the land gate and the verify receipt (check, package clean-test, scaffold e2e) only; a land never pushes, and nobody pushes main to obtain a CI or SonarCloud reading.
2. **A push of the runtime main is a release.** The remote `main` and the `v*` tags move once per release, in one atomic push of main and one annotated tag `v<version>`, or neither moves. The installed pre-push hook (`scripts/guards/release-push-gate.mjs`) refuses a push that deletes main, a push that is not a fast-forward, and a push of main or of a `v*` tag whose commit is not a release commit. A release commit satisfies the release definition (`scripts/guards/release-definition.mjs`, the code `starci release cut` also runs): (a) `package.json` `version` differs from the version at the remote main's head; (b) the tag is `v<version>`, annotated, on that commit; (c) `CHANGELOG.md` has a dated heading `## [<version>] — YYYY-MM-DD` with no TODO, PENDING, TBD or in-preparation mark (R222); (d) the L4 record of exactly that commit (`<git common dir>/starci-release/<sha>.l4.json`, written by the cut) names the tag and holds a green row, RUN on that commit, for each of the package clean-test, the scaffold e2e and the checks (`RECEIPT_STEPS` in the definition names the rows). The refusal names what is missing and the command that produces it. There is no bypass switch. Any other ref (a lane branch, `refs/backup/*`) is not the hook's business. The product repositories the Supervisor pushes through `push-mains` are outside this rule: they keep their own hooks and cadence.
3. **One flow, in order.**
   1. Freeze: every lane of the release is on local main and every worktree is clean.
   2. One release commit: the version bump and the CHANGELOG section (generated from the land merge commits, finished by a person).
   3. Publish the packages from that commit, re-pin the examples, commit.
   4. `starci release cut --tag v<version>` (`--plan` first: it reports what the cut would run and require, and runs, tags and pushes nothing): it checks the notes (R222) and the release definition as far as it holds before the rows, runs L4 once (the full row of the [test ladder](source-process.md): the packages suites, the scaffold e2e, lint, checks, tsc, the
      example installs, proofs and images, and the Linux-parity step: the light CI jobs run once in a Linux container on this host before the push, so the first GitHub run is not the first Linux run; each step to a recorded log; a skip caused by missing infrastructure fails it), makes sure main did not move, scans the pushed range, pushes the release commit to its CANDIDATE ref
      `refs/heads/release/candidate-<version>` and waits for the `ci` and `examples` workflow runs of that exact sha (OWNER RULING candidate-ci, 2026-10-18: never again does main
      receive a release whose CI is red), and only when they are green creates the ANNOTATED tag on the release commit with the CHANGELOG section as its message and pushes main
      and the tag atomically. A red candidate names its failing jobs and keeps its ref for diagnosis; a re-cut of the same version force-moves only the candidate ref, never main.
      There is no override of a red candidate. After a cut the candidate ref is left on the remote.
   5. Linux parity before the push: the CI jobs run locally on Linux, because every local gate runs on the author's machine and CI does not.
   6. CI runs on the release push of main and on the tag; the `github-release` job of `ci.yml` makes the GitHub Release from the CHANGELOG section (`starci release notes --tag <v*>`), marked a pre-release when the version has a pre-release part.
4. **CI triggers** of the runtime are a push to `main`, a push of a release candidate ref `release/candidate-*`, a push of `v*` tags and `workflow_dispatch`, nothing else (R221): no other branch, no pull request; every `ci.yml` (and the runtime's `examples.yml`) must run on the candidate refs. One concurrency group per ref; a newer
   push to main cancels the older main run, a tag run is never cancelled. Codecov takes the coverage of every run; Sonar scans the runs of `main` (a main push or a dispatch of main), since the commit of a release tag is the commit the main push already scanned. The hfs app CI templates (the CI and images workflows; the e2e workflow stays manual) take a push of `v*` tags and `workflow_dispatch`, and the CI workflow also a push of `release/candidate-*`: `starci app release push` sends the release sha there first and moves the branch and the tag only when that run is green.
5. **Tags** on the remote are release tags only, annotated, and never moved or deleted. A housekeeping mark (a pre-rebase backup, a merge marker, a salvage
   snapshot) is a ref under `refs/backup/` or `refs/salvage/`, never a tag, and is never pushed as one.
6. **Release notes** are the CHANGELOG section of the tag: Added, Changed, Removed, Fixed, Known limitations, and Evidence (land shas, the L4 logs, the CI run, the
   published package versions). R222 refuses a tag over an unfinished section.
7. **Hotfix** has no release branch: the fix is the next release from main.

## Commits

Every commit message is `type(scope): summary` with one of the types `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `land` or `release`, followed by trailers:

- `Co-Authored-By:` the agent or person that wrote it, and a lane or workflow id (`Lane:` or `Workflow:`);
- a land commit also carries `Land-Verified:` (the pre-verified tip), `Check: n/n` and `Tests: packages g/t, e2e p/t <base>..<tip>`, so a land states what it ran;
- a release commit is `release(<version>): ...` and its CHANGELOG section is the tag message.

## What the release flow refuses

`starci release cut` stops, pushes nothing and says why when:

- the checkout is not on `main`, or has a tracked change (nothing is stashed, reset or cleaned);
- the tag is not named, is not `v<version>`, is lightweight, sits on another commit, or already exists on the remote (a tag is never moved or re-pushed: cut the next version);
- the release notes are unfinished (R222), or the version has not moved past the version at the remote main's head;
- an L4 step is red or absent, or a test executed in no leg: every test must have passed on the host run or in the Linux container run, a skip that passed in the other leg is listed with the leg
  where it passed, and a skip nothing covered (missing infrastructure, a platform no leg has, any undeclared skip) fails L4, except the declared browser-conditional ones, which are listed by name;
- main moved while L4 ran, or the pushed range holds a secret;
- the candidate CI of the release sha is red (`RELEASE_CANDIDATE_CI_RED`, with the failing jobs and steps), did not start or end in time (`RELEASE_CANDIDATE_CI_TIMEOUT`), or GitHub cannot be read (`RELEASE_CI_UNKNOWN`);
- the remote refuses either ref (the push is atomic).

A parked remote is not a refusal: the owner may park the remote's push url (a `pushurl` that reads `DISABLED-<reason>`) so that nothing but the release can push. The release cut pushes through the remote's fetch url for its one push, moves the remote-tracking ref itself and never writes the configuration; any other push url is the owner's choice and is used as set.

L4 runs once per release, on the exact commit that is pushed. Landing runs only the verify receipt's proofs, so a red surfaces at the release cut, before anything leaves the machine, or in the CI run of the release push: the lands are merge commits on main, which keeps a
bisection over them cheap, and a red found after the push is fixed forward with the next commit or tag and recorded under Known limitations, never by moving a tag.

## Risks and how they are handled

- **Unpushed work lives on one disk.** Local main is unpushed between releases by design: keep lane refs in a backup namespace that no workflow triggers on (`refs/backup/*`, which the hook does not touch), and keep the salvage snapshots.
- **Linux-only reds after the push.** Linux parity before the push is mandatory, not optional.
- **Many small fixes mean many tags.** Tags are cheap and pre-release numbers exist; do not batch unrelated work to save a tag. A push of main is a release: the hook allows no other.
- **A second contributor** gets no CI feedback on a branch before it reaches main: add pull-request CI for that contributor's pull requests only, never on every branch push.

## R221

`CI_TRIGGERS_RELEASE_ONLY` checks the tracked workflow trigger declarations in both editions. App workflows and the managed CI templates accept release tags `v*`, the release candidate branches `release/candidate-*` and manual dispatch; another branch trigger or a schedule produces the finding. Only the runtime repository's root workflows may also declare a push to `main`. Every `ci.yml`, and the runtime's `examples.yml`, must name `release/candidate-*`: the release flows wait for that run of the release sha. The edition-specific proof exercises refused app triggers and an accepted release-tag workflow through the runtime checker.

## R222

`RELEASE_NOTES` checks each release tag that points at HEAD against its matching `CHANGELOG.md` section in both editions. A missing section or an unfinished marker in that section produces the finding. A finished tagged section passes even when the next version is still in preparation. Tags and finished release prose are authored during the release process, so this evidence is not generated by the app scaffold.
