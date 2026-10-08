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
starci test run --level L2 --against <ref>
```

During development the same selection is `starci test affected --run`; the whole suite runs once on the merged tree and once inside the release cut.

Review source changes and test failures. Do not weaken validators to produce a green release. Knowledge is authored as YAML under `knowledge/` and read directly; see [knowledge YAML](knowledge-yaml.md). The runtime bundles its YAML dependency in `engine/yaml.mjs`; retain its license notice (`engine/yaml-license.json`, THIRD_PARTY_NOTICES.md) when deliberately changing that dependency.

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

The L4 Sonar proof of `starci release cut` analyses the three examples on SonarCloud (`scripts/supervisor/release-sonarcloud.mjs`, `release-l4-sonar.mjs`): the one `SONAR_TOKEN` of the runtime's untracked `.claude/secret.env`, read through `engine/secrets.mjs` and never printed, and the organization key of `config.yaml` `sonar.organization` (the env `SONAR_ORGANIZATION` wins; it is configuration, not a secret), the same names the runtime's own `ci.yml` and `examples.yml` read as repository secret and variable. The project key is `<organization>_<key the example declares>` (`starci-example-<name>`); a project that does not exist is created with the token (idempotent), its first analysis becomes its main branch, and every later proof analyses the branch `release-proof`, so a proof made before the release push never lands in the main history. The bar is the runtime's own, not a server-side gate (a custom gate may not exist on the SonarCloud plan): the scan row passes when SonarCloud processed the analysis, and the dashboard row applies `knowledge/sonar-gate.yaml` to the measures read from the API (SonarCloud tokens are user tokens, so the per-file coverage read that SonarQube refuses to an analysis token works). The cut needs network and uploads the example sources to SonarCloud (the repository is public); `starci release cut`, also with `--plan`, refuses in seconds, before the suite, when `SONAR_TOKEN` or the organization (`config.yaml` `sonar.organization`) is absent, SonarCloud rejects the token or the organization, or the API is unreachable.

## The release cut: what runs together, and what a second cut reuses

The L4 rows of `starci release cut` are a schedule, not a line (`scripts/supervisor/release-l4-schedule.mjs`, `release-l4-graph.mjs`; the numbers are `modules/supervisor/release-cut.yaml`). The installs and the test-world build run together; the Linux parity container starts at once and runs beside everything (it works on its own copy of HEAD inside Docker); the root rows (`npm test`, `npm run test:packages`, `npm run check`) keep the machine, one after another; when the suite has ended, the example apps' row chains run together, each app's own rows in order, and each app's SonarCloud proof starts when its rows have ended, the three proofs together. The spec leg of the parity container (the spec files of the tests the Windows host skipped, run with zsh and fish installed in a second container) starts when the suite has ended. The number of app chains running together is the declared `pools.apps`, lowered to the free logical threads and the free RAM above the reserve of `modules/supervisor/test-concurrency.yaml` (`appChain` states what one chain needs), never below one. Every row keeps its own log and verdict, and a red row cancels nothing: the result lists every red row of the run. A row that throws (a bug, not a red result) stops new rows from starting, lets the running ones finish and is raised.

Measured on the rows of the second 1.0.0-alpha.7 cut (4238 s of row time, strictly in sequence): a full cut under this schedule is about 1800 s when nothing else slows the chains (prep 35 s, the suite 855 s, then the longest app chain with its proof, ecommerce-app, 922 s; the packages suites and the checks, 409 s, and the parity container, 1484 s, end inside that window) and up to about 2200 s when the chains and those root rows contend for the machine. A re-cut after a fix that touches only the runtime is about 1500 s: prep 35 s and the three root rows 1264 s run beside the parity container (1484 s, the longest), and every example row is reused.

A cut that resumes. Each cut leaves a ledger beside the L4 record (`<git common dir>/starci-release/<sha>.l4-rows.json`): its green rows, each with a digest of what the row depends on (its class, its command and git's blob ids of its declared input set at that commit). The next cut decides row by row, and `--plan` prints the decision with its reason:

- `carry`: the row is green in the ledger of this very commit (an env-only red row re-run alone, or a plain second cut): nothing runs;
- `reuse`: another commit's ledger holds the row green with the identical digest and its class may cross commits: nothing runs, and the record of the final commit lists the row with `reusedFrom`, the commit that proved it;
- `run`: everything else. When in doubt a row runs.

Input sets (`reuse.classes` in the yaml): an example app's rows and its Sonar proof depend on `examples/<app>/`, the example index, the root manifest and lockfile and the two helpers the row scripts call; the root suite, `test:packages` and `check` on the whole tree minus `examples/` and `docs/`; the Linux parity on the whole tree. The installs and the test-world build always run. **The three rows the pre-push gate requires (`npm test`, `npm run test:packages`, `npm run check`) are never reused from another commit**, even when their input set is identical: the gate (`scripts/guards/release-definition.mjs`) counts a required row only when the record shows it RAN on the exact pushed commit, and a row marked `reusedFrom` does not count. So a re-cut after a fix always re-runs the root rows and the Linux container, and reuses the example apps that the fix did not touch.

`starci release cut --no-reuse` runs every row. `starci release cut --tag <v*> --rows "<row>,<row>"` is for an env-only red row (a live-Orca smoke refused for stale quota, SonarCloud unreachable): it re-runs the named rows alone on the SAME commit and completes the record when every other row is green there; it refuses before running anything (`rows-unknown`, `rows-incomplete`) when a name is not a row of the plan or another row is not green on this commit. Names are the ones `--plan` lists.

## The runtime itself: coverage and Sonar

The runtime measures its own first-party source too. The scope is ONE list, `scripts/hfs/runtime-coverage-scope.mjs`: `engine/`, `scripts/`, `packages/cli/`, `ui/api/` and the `ui/*.mjs` entry files, never the specs, `node_modules`, the generated `packages/*/runtime/` copies, `examples/` (which keep their own flags and Sonar projects) or the vendored `engine/yaml.mjs` bundle. Three things are rendered from it and nothing is typed twice:
`scripts/gates/runtime-coverage.mjs` (the CI coverage step: the same suite and `tests/setup/` isolation as the L4 suite, under Node's built-in coverage, writing the git-ignored `coverage/lcov.info`), the `runtime` flag of `codecov.yml`, and the root `sonar-project.properties` (the SonarCloud project definition: sources, tests, exclusions and the lcov path, with no organization or key); `starci runtime check --only examples-ci -- --write` renders the last two and the check refuses drift.
The `runtime` flag has never been measured, so its project and patch statuses are `informational: true` (never red) until a baseline exists; the overall Codecov statuses read the example flags only.

In `.github/workflows/ci.yml` the coverage run replaces the plain test step (one run, never two). Every run (a push to main, a push of a `v*` tag, a manual dispatch) uploads `coverage/lcov.info` under flag `runtime` through OIDC. The runs of the branch main (a main push, a dispatch of main) also scan the runtime on SonarCloud (`https://sonarcloud.io`, fixed in that job) with the full git history, wait for the quality gate (up to an hour) and fail the job on a red gate; a tag run does not scan, since SonarCloud would open a branch named after the tag and the tagged commit is the one the main push scanned. The scan runs only where all three repository settings exist; otherwise the job prints a "Sonar skipped" notice naming each missing one.

The runtime goes to SonarCloud; apps and examples go to the host's local SonarQube in `ext/sonar`. The owner configures once: the Codecov app and OIDC for the repository, and the repository settings `secrets.SONAR_TOKEN` (a SonarCloud token), `vars.SONAR_ORGANIZATION` (the organization key) and `vars.SONAR_PROJECT_KEY` (the project key, normally `<organization>_<repository>`); on SonarCloud the repository is imported with Automatic Analysis turned off, since the analysis comes from CI.

The runtime's own `dashboard` gate is not used: it holds a per-file coverage of 100 that only the example apps are held to.

## Pre-workflow readiness

Before the owner runs a workflow on a new runtime release, run the launch smoke once on the live host, from a plain Orca shell (or the owner's chat), never from an agent:

```sh
starci release launch-smoke --app-repo <scratch app main checkout> --out <launch-smoke-output>/launch-smoke.json
```

It starts seven no-op agents on the cheapest model `modules/models/runtimes.yaml` pins, all through `orchestration worker-start`, and proves the depth Orca reports for each nesting path: `[Supervisor]` (1) -> `[Worker]` (2), and `[Kernel]` (1) -> `[Op]` (2) -> draw critic (3). It also proves the workflow worktree on the scratch app: the Kernel's worktree in `orca worktree list`, a be op and an fe op in parallel in it, a failing op preserved and reset to its checkpoint, and a finish that fast-forwards main and marks the worktree release-pending, after which the host-side controller removes it, with main byte-identical but for the two green files. Run it with the reconciler running, since its controller removes the worktree. The scratch app must be registered in Orca, and its main receives those two files and is pushed. It always stops and releases every agent it started and prints one `starci/launch-smoke@2` JSON result; exit 0 means all three paths are `ok`. Orca's Settings -> Orchestration -> Nested worker depth must be at least 3. No check or spec runs it: it starts real agents. See [host contract](host-contract.md#pre-workflow-launch-smoke) and the contract change `launch-smoke`.

## Make an archive

`starci release cut` creates the reviewed release artifacts. Ad hoc package archive creation is owner-only.

Create the output directory first, outside the runtime and product trees. For an owner-approved ad hoc archive, run `starci check run --level L2` and `starci test run --level L2 --against <ref>` in the packing checkout before creating it — archive creation performs no verification of its own. Inspect both resulting file inventories for local configuration, secrets, `config.yaml`, product records, Git state, `node_modules`, `worktrees/` and unrelated build output. Each package's `files[]` is the authority on what its payload contains — it is an allowlist with explicit negations for generated output; keep all runtime references available after relocation.

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
