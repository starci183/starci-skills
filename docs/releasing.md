Task: build, pack and release the runtime
# Build and release StarCi

This is the maintainer workflow, not a requirement for users installing a reviewed archive. Package preparation does not publish to npm or push Git. Runtime consumers receive sources only; the runtime reads them in place.

## Distribution: sources only

A published package ships **sources only** — the authored tree is the runtime. Install and update
copy the declared `package.json` `files[]` payload into `<host>/.claude`, preserve locally changed
or unowned files on update (unless `--force`), ensure the installed `.claude/.gitignore` carries
`/config.yaml` and `/config.json`, verify the installed tree (the doctor contract checks), and only
then record `.starci-skills.json` with the new version and file hashes. A failed copy or verify
records nothing — no manifest, no version bump. After an interrupted init or update, re-run from
the same reviewed package and confirm `doctor --quick`; keep the local modifications update
reported and use `--force` only after backup and review. The operator flow is
[installation](installation.md).

## Verify source

```sh
starci npm ci
starci check run --level L2
starci runtime verify --base <ref>
```

`starci runtime verify` joins the runtime check, the package clean-test of the packages the change touches and the scaffold e2e on one commit, one receipt; the runtime has no specs of its own (owner ruling `no-runtime-specs`). The release cut runs every package suite and the scaffold e2e again.

Review source changes and test failures. Do not weaken validators to produce a green release. Knowledge is authored as YAML under `knowledge/` and read directly; see [knowledge YAML](knowledge-yaml.md). The runtime bundles its YAML dependency in `engine/yaml.mjs`; retain its license notice (`engine/yaml-license.yaml`, THIRD_PARTY_NOTICES.md) when deliberately changing that dependency.

## Example apps: CI and the local Sonar dashboard

The root `.github/workflows/examples.yml` runs every example app (the matrix is derived from `examples/*/hfs.json` of kind app,
`scripts/checks/check-examples-ci.mjs`): typecheck (tsc over be, turbo over the fe workspaces), `starci app lint`, unit tests with coverage, the Codecov upload under the app's flag (the example's
`codecov.yml`, the measured roots held at 100 on the project and the patch plus one component per service app and one `platform`, each at 100), the be build and the fe build (turbo, the packages first) and the Sonar gate on push and pull request; a second job `images`
builds the Docker image of every be and fe app of every example (its matrix is `check-examples-ci.mjs --images`, derived from the apps of each `hfs.json`) and never pushes. Coverage is one scope: the files of
the `ruleParams.be.logicRoles` roles inside the `coverage: required` slots (the logic of `be/src/modules/**`), derived once from the slot manifest by `scripts/hfs/coverage-scope.mjs` and shared by every be
app, so the one scope covers every service; the fe has no tests. Each example's `codecov.yml`, its `be/jest.config.js` and the complement
in its `sonar-project.properties` are all rendered from the one derivation by `starci runtime check --only examples-ci -- --write` (`starci runtime check` refuses drift, R204);
integration and e2e start the docker stack and run only through its `workflow_dispatch` (input `layers`), because e2e runs manually
only. The coverage upload authenticates with GitHub's OIDC token (`use_oidc: true`, job permission `id-token: write`), so no repository secret exists to forget and no upload step skips silently (rule CI_UPLOAD_NOT_SILENT); the owner activates the repository on Codecov once. Before a release, run the local dashboard gate
per example app against the local SonarQube after the app's unit run (`starci gate unit --root examples/<app>`) and a project scan:

```sh
starci gate sonar scan --cwd examples/<app> --project-gate --wait
starci gate sonar dashboard --cwd examples/<app>
```

It fails unless bugs, code smells and vulnerabilities are 0, every hotspot is reviewed and every measured file of the coverage scope is at 100.

The L4 Sonar proof of `starci release cut` analyses the three examples on SonarCloud (`scripts/supervisor/release-sonarcloud.mjs`, `release-l4-sonar.mjs`): the one `SONAR_TOKEN` of the runtime's untracked `.claude/secret.env`, read through `engine/secrets.mjs` and never printed, and the organization key of `config.yaml` `sonar.organization` (the env `SONAR_ORGANIZATION` wins; it is configuration, not a secret), the same names the runtime's own `ci.yml` and `examples.yml` read as repository secret and variable. The project key is `<organization>_<key the example declares>` (`starci-example-<name>`); a project that does not exist is created with the token (idempotent), its first analysis becomes its main branch, and every later proof analyses the branch `release-proof`, so a proof made before the release push never lands in the main history. The bar is the runtime's own, not a server-side gate (a custom gate may not exist on the SonarCloud plan): the scan row passes when SonarCloud processed the analysis, and the dashboard row applies `knowledge/sonar-gate.yaml` to the measures read from the API (SonarCloud tokens are user tokens, so the per-file coverage read that SonarQube refuses to an analysis token works). The cut needs network and uploads the example sources to SonarCloud (the repository is public); `starci release cut`, also with `--plan`, refuses in seconds, before any row runs, when `SONAR_TOKEN` or the organization (`config.yaml` `sonar.organization`) is absent, SonarCloud rejects the token or the organization, or the API is unreachable.

## The release cut: what runs together, and what a second cut reuses

The L4 rows of `starci release cut` are a schedule, not a line (`scripts/supervisor/release-l4-schedule.mjs`, `release-l4-graph.mjs`; the numbers are `modules/supervisor/release-cut.yaml`). The installs and the test-world build run together; the Linux parity container starts at once and runs beside everything (it works on its own copy of HEAD inside Docker); the root rows (the package clean-test, the scaffold e2e and the runtime check) keep the machine, one after another; when the checks row has ended, the example apps' row chains run together, each app's own rows in order, and each app's SonarCloud proof starts when its rows have ended, the three proofs together. The number of app chains running together is the declared `pools.apps`, lowered to the free logical threads and the free RAM above the reserve of `modules/supervisor/test-concurrency.yaml` (`appChain` states what one chain needs), never below one. Every row keeps its own log and verdict, and a red row cancels nothing: the result lists every red row of the run. A row that throws (a bug, not a red result) stops new rows from starting, lets the running ones finish and is raised.

A re-cut after a fix that touches only the runtime re-runs the three root rows and the Linux parity container, and reuses every example row.

A cut that resumes. Each cut leaves a ledger beside the L4 record (`<git common dir>/starci-release/<sha>.l4-rows.json`): its green rows, each with a digest of what the row depends on (its class, its command and git's blob ids of its declared input set at that commit). The next cut decides row by row, and `--plan` prints the decision with its reason:

- `carry`: the row is green in the ledger of this very commit (an env-only red row re-run alone, or a plain second cut): nothing runs;
- `reuse`: another commit's ledger holds the row green with the identical digest and its class may cross commits: nothing runs, and the record of the final commit lists the row with `reusedFrom`, the commit that proved it;
- `run`: everything else. When in doubt a row runs.

Input sets (`reuse.classes` in the yaml): an example app's rows and its Sonar proof depend on `examples/<app>/`, the example index, the root manifest and lockfile and the two helpers the row scripts call; `test:packages`, `test:e2e` and `check` on the whole tree minus `examples/` and `docs/`; the Linux parity on the whole tree. The installs and the test-world build always run. **The three rows the pre-push gate requires (`npm run test:packages`, `npm run test:e2e`, `npm run check`) are never reused from another commit**, even when their input set is identical: the gate (`scripts/guards/release-definition.mjs`) counts a required row only when the record shows it RAN on the exact pushed commit, and a row marked `reusedFrom` does not count. So a re-cut after a fix always re-runs the root rows and the Linux container, and reuses the example apps that the fix did not touch.

`starci release cut --no-reuse` runs every row. `starci release cut --tag <v*> --rows "<row>,<row>"` is for an env-only red row (SonarCloud unreachable): it re-runs the named rows alone on the SAME commit and completes the record when every other row is green there; it refuses before running anything (`rows-unknown`, `rows-incomplete`) when a name is not a row of the plan or another row is not green on this commit. Names are the ones `--plan` lists.

## Where the suite runs

`config.yaml` `release.suite` (`engine/release-config.mjs`, [config format](config-format.md)) says who judges the Linux parity of a release. Two modes, and the choice is the owner's, recorded:

- **`local`** (the shipped default). `starci release cut` runs the root rows and the Linux parity container, and the pre-push gate (`scripts/guards/release-definition.mjs`) refuses a push of main unless the release record of that exact commit holds green the package clean-test, the scaffold e2e and the checks rows RUN on it.
- **`ci`** (owner ruling 2026-10-09, `modules/kernel/owner-rulings.yaml` `release-suite-ci`: "add to config.yaml a setting 'full test: none' so the full test is never applied locally and it is pushed to git, letting Codecov handle it, to save time"). The value is `ci`, not `none`: the GitHub `ci` workflow judges the Linux parity.

Under `ci` the cut plans **no `linux-parity` row** (`--plan` lists it as `delegated`, reason "delegated to CI", and prints `suiteMode: ci`). It still runs, locally, the same root rows as `local` (the package clean-test, the scaffold e2e and the checks) and the example apps' rows and SonarCloud proofs; the runtime has no spec suite to delegate (owner ruling `no-runtime-specs`).

**The record and the gate.** The release record of a `ci` cut says `suite: ci` and lists `linux-parity` under `delegated`, never in the green rows. The pre-push gate accepts it only when the checked-out `config.yaml` says `release.suite: ci` too (`RELEASE_SUITE_MODE` otherwise: a record cannot claim the mode by itself), and in both modes it requires the package clean-test, the scaffold e2e and the checks RUN on that exact commit.

**The trade the owner accepted (before alpha.22).** A release could reach GitHub, and its tag, before the Linux parity had run anywhere, and a red CI was fixed forward with the next pre-release. Since alpha.22 the candidate CI below judges the exact release sha on GitHub before main or the tag move. The verdict comes back through `starci release ci-status [--tag v...] [--wait]` (`scripts/supervisor/release-ci-status.mjs`; reads the `ci` workflow run for the commit and the Codecov and Sonar checks through `scripts/api/gh/**`): the cut prints the command after the push; a red run of a `suite: ci` release is recorded once as the runtime defect `runtime-defect:release-ci-red-<tag>` for Debug (`starci supervisor actions record`), and `starci debug digest` and `starci reconciler up --check` show "last release CI".

## The candidate CI

OWNER RULING `candidate-ci` (2026-10-18, `modules/kernel/owner-rulings.yaml`): "never again have main receive a release whose CI is red, with the owner confirming afterwards." After the suite, the main-moved check and the secret scan, `starci release cut` pushes the exact release commit to its candidate ref `refs/heads/release/candidate-<version>` (`scripts/supervisor/release-candidate.mjs`; the pre-push hook names that namespace as open) and waits for every workflow listed in `candidate.workflows` of `modules/supervisor/release-cut.yaml` (`ci`: check + test; `examples`: every example app's CI shape) to finish its run of that sha, polling `gh` every `pollSeconds` for up to `waitMinutes`. The host lock is held only for the local rows and for the final push: it is released while the candidate CI runs, so other work on the host (an app install, another lane) proceeds, and the cut checks again that the checkout has not moved before it tags and pushes. To predict the result while GitHub runs, an app runs its own rendered CI locally with `starci app ci local`.

- Green: the annotated tag is created (only now, so a red candidate leaves no tag and the same version can be cut again on the fix) and main and the tag move in the one atomic push. The release record logs the candidate verdict, and the CI record of the sha is written green.
- Red: `RELEASE_CANDIDATE_CI_RED` names the run URLs and every failing job and step; nothing reaches main. The candidate ref stays for diagnosis; the next cut of the same version force-moves only the candidate ref, never main.
- No run within `graceMinutes` (a workflow that does not trigger on `release/candidate-*`), or no end within `waitMinutes`: `RELEASE_CANDIDATE_CI_TIMEOUT`. GitHub unreadable to the end: `RELEASE_CI_UNKNOWN`. Nothing reaches main.
- There is no override: a red candidate never passes; fix, commit and cut again.

The latest run on main no longer gates a cut: a red main (alpha.21's) blocks nothing before the next release, whose own candidate run decides. After a successful cut the candidate ref is left on the remote, naming the released sha. Apps follow the same flow through `starci app release push --execute` (`packages/hfs/release/candidate-ci.mjs`: the managed `ci.yml` triggers on `release/candidate-*`, and `starci app release gate` no longer reads the default-branch CI).

## The runtime itself: Sonar, no coverage

The runtime has no specs of its own (owner ruling `no-runtime-specs`, 2026-10-17), so it measures no coverage: Codecov carries only the example flags, and the root `codecov.yml` has no runtime flag. The scope SonarCloud analyses is ONE list, `scripts/hfs/runtime-coverage-scope.mjs`, derived from the runtime slot manifest; it renders the root `sonar-project.properties` (sources and exclusions, no lcov path, no organization or key), and `starci runtime check --only examples-ci -- --write` renders it and the check refuses drift.

In `.github/workflows/ci.yml` the runs of the branch main (a main push, a dispatch of main) scan the runtime on SonarCloud (`https://sonarcloud.io`, fixed in that job) with the full git history, wait for the quality gate (up to an hour) and fail the job on a red gate; a tag run does not scan, since SonarCloud would open a branch named after the tag and the tagged commit is the one the main push scanned. The scan runs only where all three repository settings exist; otherwise the job prints a "Sonar skipped" notice naming each missing one.

The runtime goes to SonarCloud; apps and examples go to the host's local SonarQube in `ext/sonar`. The owner configures once: the Codecov app and OIDC for the repository (for the example uploads), and the repository settings `secrets.SONAR_TOKEN` (a SonarCloud token), `vars.SONAR_ORGANIZATION` (the organization key) and `vars.SONAR_PROJECT_KEY` (the project key, normally `<organization>_<repository>`); on SonarCloud the repository is imported with Automatic Analysis turned off, since the analysis comes from CI.

The runtime's own `dashboard` gate is not used: it holds a per-file coverage of 100 that only the example apps are held to.

## Pre-workflow readiness

Owner ruling (2026-10-17): Orca is open-source and tested upstream, so the runtime keeps no Orca test and no Orca release dependency; it keeps its Orca integration code. A release cut needs no Orca terminal, no reachable Orca and no fresh provider quota, and no launch smoke runs before a workflow.

## Make an archive

`starci release cut` creates the reviewed release artifacts. Ad hoc package archive creation is owner-only.

Create the output directory first, outside the runtime and product trees. For an owner-approved ad hoc archive, run `starci check run --level L2` and `starci runtime verify --base <ref>` in the packing checkout before creating it — archive creation performs no verification of its own. Inspect both resulting file inventories for local configuration, secrets, `config.yaml`, product records, Git state, `node_modules`, `worktrees/` and unrelated build output. Each package's `files[]` is the authority on what its payload contains — it is an allowlist with explicit negations for generated output; keep all runtime references available after relocation.

Test both **archives**, not only the source checkout:

```sh
npx --yes --package=<cli-archive>.tgz starci --help
npx --yes --package=<cli-archive>.tgz starci runtime install --cwd <isolated-host>
npx --yes --package=<cli-archive>.tgz starci runtime doctor --cwd <isolated-host> --quick
```

Also verify an update preserving custom host instructions and a seeded `config.yaml`. Record both archive hashes and the test results with the handoff. Do not test installation against an active user's runtime.

## Publication is a separate approval

The intended package is `starci`. A registry lookup returning not-found is not proof of namespace ownership. Before any publish, the maintainer must confirm authenticated npm account rights, name/version availability, archive contents, license ownership and intended prerelease dist-tag. Require explicit publication authority, then publish the exact reviewed archive. Do not expose tokens in logs or source. Update README release status only after registry verification succeeds.

Never publish unrelated dirty changes, silently retag a stable release as a pre-release, or assume the previous `@starci/skills` package redirects users. Announce the naming transition and upgrade limits in the release notes.

## Coverage uploads must report failure {#r202}

In lite and full, `CI_UPLOAD_NOT_SILENT` refuses a Codecov upload without
`use_oidc: true`, job or workflow `permissions: id-token: write`, and
`fail_ci_if_error: true`. Remove `continue-on-error: true` and any upload condition
that reads a secret or `CODECOV_TOKEN`. These requirements apply to root, example
and managed template workflows so missing credentials cannot silently skip an upload.
