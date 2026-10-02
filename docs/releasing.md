# Build and release StarCi

This is the maintainer workflow, not a requirement for users installing a reviewed archive. Package preparation does not publish to npm or push Git. Runtime consumers receive sources only; the runtime reads them in place. See [runtime distribution](runtime-distribution.md).

## Verify source

```sh
npm ci
npm run check   # node --check on every .mjs, ops registry regen check, host contract
npm test        # node --test tests/*.spec.mjs
```

Review source changes and test failures. Do not weaken validators to produce a green release. Knowledge is authored as YAML under `knowledge/` and read directly; see [knowledge YAML](knowledge-yaml.md). The runtime bundles its YAML dependency in `engine/yaml.mjs`; retain its license notice (`engine/yaml-license.json`, THIRD_PARTY_NOTICES.md) when deliberately changing that dependency.

## Example apps: CI and the local Sonar dashboard

The root `.github/workflows/examples.yml` runs every example app (the matrix is derived from `examples/*/hfs.json` of kind app,
`scripts/checks/check-examples-ci.mjs`): typecheck (tsc over be, turbo over the fe workspaces), `starci app lint`, unit tests with coverage, the Codecov upload under the app's flag (the root
`codecov.yml`, one flag per app, 100 on the project and the patch), the be build and the fe build (turbo, the packages first) and the Sonar gate on push and pull request; a second job `images`
builds the Docker image of every be and fe app of every example (its matrix is `check-examples-ci.mjs --images`, derived from the apps of each `hfs.json`) and never pushes. Coverage is one scope: the services
and the cli commands under `be/src` (the jest preset's `COVERAGE_SOURCES`), shared by every be app, so one flag per example covers identity, order, billing and cli; the fe has no tests. The root flag, each
example's own `codecov.yml` and the complement in its `sonar-project.properties` are all rendered from the source preset by `starci runtime check --only examples-ci -- --write` (`npm run check` refuses drift);
integration and e2e start the docker stack and run only through its `workflow_dispatch` (input `layers`), because e2e runs manually
only. The coverage upload authenticates with GitHub's OIDC token (`use_oidc: true`, job permission `id-token: write`), so no repository secret exists to forget and no upload step skips silently (rule CI_UPLOAD_NOT_SILENT); the owner activates the repository on Codecov once. Before a release, run the local dashboard gate
per example app against the local SonarQube after `npm test` and a project scan:

```sh
starci gate sonar scan --cwd examples/<app> --project-gate --wait
starci gate sonar dashboard --cwd examples/<app>
```

It fails unless bugs, code smells and vulnerabilities are 0, every hotspot is reviewed and every service is at 100 coverage.

## Pre-workflow readiness

Before the owner runs a workflow on a new runtime release, run the launch smoke once on the live host, from a plain Orca shell (or the owner's chat), never from an agent:

```sh
starci release launch-smoke --app-repo <scratch app main checkout> --out <launch-smoke-output>/launch-smoke.json
```

It starts seven no-op agents on the cheapest model `modules/models/runtimes.yaml` pins, all through `orchestration worker-start`, and proves the depth Orca reports for each nesting path: `[Supervisor]` (1) -> `[Worker]` (2), and `[Kernel]` (1) -> `[Op]` (2) -> draw critic (3). It also proves the workflow worktree on the scratch app: the Kernel's worktree in `orca worktree list`, a be op and an fe op in parallel in it, a failing op preserved and reset to its checkpoint, and a finish that fast-forwards main and marks the worktree release-pending, after which the host-side controller removes it, with main byte-identical but for the two green files. Run it with the reconciler running, since its controller removes the worktree. The scratch app must be registered in Orca, and its main receives those two files and is pushed. It always stops and releases every agent it started and prints one `starci/launch-smoke@2` JSON result; exit 0 means all three paths are `ok`. Orca's Settings -> Orchestration -> Nested worker depth must be at least 3. No check or spec runs it: it starts real agents. See [host contract](host-contract.md#pre-workflow-launch-smoke) and the contract change `launch-smoke`.

## Make an archive

```sh
npm pack --json --pack-destination <release-output>
npm pack --json --pack-destination <release-output> packages/cli
```

Create that output directory first, outside the runtime and product trees. Run `npm run check && npm test` in the packing checkout yourself before packing — `npm pack` runs no verification of its own. Inspect both resulting file inventories for local configuration, secrets, `config.yaml`, product records, Git state, `node_modules`, `worktrees/` and unrelated build output. Each package's `files[]` is the authority on what its payload contains — it is an allowlist with explicit negations for generated output; keep all runtime references available after relocation.

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
