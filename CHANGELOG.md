# Changelog

All notable changes to StarCi are documented here. The project is pre-publication on the
`1.0.0-alpha.N` line: contracts are provisional until every S* row in
`docs/goal.md` holds with fresh evidence, then `1.0.0` freezes them.
`package.json` `version` is the only version authority.

## [1.0.0-alpha.4] — in preparation

- Lane C1-TESTWORLD2: `@starci/test-world` 1.2.0. The event bus is real Apache Kafka in KRaft mode: one digest-pinned image (`apache/kafka:4.2.2@sha256:1213eb39...`, shared with the ecommerce stack), never faked; a broker listener and toxiproxy proxy per data slot, slot-prefixed topics, consumer groups and client ids, a per-file reset to the high watermark and a prefix-only teardown. Postgres contexts may start as schemas of one database (a schema and a login role per context; reset and outages act on the context alone). Contract change `test-world-kafka-kraft`.
- Lane RELOPS: one release gate. `npm run release:check` (scripts/gates/release-check.mjs) prints GREEN only when every proof of the readiness checklist holds: the publish plan against the registry (nothing left to publish, no drift), the canon pins, the fresh app installs, the package clean proofs, `npm run check`, the full spec run, an intact checkout and, with `--final`, a dated CHANGELOG section on main. It never publishes; `scripts/gates/release-publish.mjs` (`npm run release:publish`) prints the plan and publishes only with `--publish --npm-user <name>`, leaves first and the canon-bundling packages last. The Sonar gate is renamed `starci-quality`: the next scan creates it on an existing server and moves the project onto it. `allocation.gc.laneCap` keeps the registered lane worktrees under a cap (the longest idle clean lanes go, their branches stay), and the lane sweep removes link-holding lanes link-safely. `docs/goal.md` replaces `docs/opensource-goal.md`.
- Known limitation (lane ORCA, smoke E6 on Orca 1.4.209): a worker that has sent worker_done cannot be woken by a message. `orchestration send --to dispatch:<id>` answers `dispatch_inactive` ("Dispatch <id> is completed; its worker will never read that mailbox. Send to run:<id> instead, or start a new Dispatch for follow-up work."). The runtime's wake paths (`terminal send` with Enter, wake-delivery, nudge) stay; a follow-up that is real work is a new Dispatch.

- Lane C0-TESTWORLD (alpha.4 item 2.9): world spec files run in parallel. `@starci/test-world` 1.1.0 provisions per-worker data slots (N = min(jest maxWorkers, the declaration's `workers`, default 2)); each slot is a complete run of its own namespace `<ns>_w<k>`: its own Postgres database per connection, Keycloak realm, leased Redis DB, MinIO/Qdrant/Kafka/k3d prefixes, fakes host, toxiproxy proxies and outage lock. `@starci/jest-preset` 2.2.4's world runner runs up to min(--maxWorkers, slots) files at once, each in a fresh process bound to one slot (`STARCI_TEST_WORLD_SLOT`). The two are pinned together on state protocol 2 with no fallback (`JEST_PRESET_WORLD_PAIR_MISMATCH`, `TEST_WORLD_PAIR_MISMATCH`). This lifts the TW2 limitation "one file at a time". The e2e and integration verify prompts and the test-world-run gate describe the runner accordingly. Contract change `test-world-worker-slots`.
- Lane C0-KGUARD2: an install through a linked node_modules is refused for every caller, guard file or not (the third junction wipe emptied main's packages/grammar/node_modules). The command guard reads npm, pnpm and yarn install families, resolves the package root from the cwd, --prefix, -C/--dir and --cwd through cmd, PowerShell and bash wrappers, and checks the root's node_modules, any node_modules around it and the workspace root's (DEPS_THROUGH_LINK: unlink it first and install for real). The Kernel may no longer run  (KERNEL_ORCA_CHECK): its --ack consumed deliveries before the ledger recorded them. Contract change install-through-link.
- Lane C0-XSCRIPT: a worker's output is read by Dispatch through Orca's `worker-read --source auto` (`scripts/api/orca/worker-read.mjs`: one page, or every page by cursor; `source_changed` restarts once; `contentComplete` and `clipping` are kept). `api observe` returns `output` in place of the `screen` tail (the turn state is still classified from the frame), and attempt, final and Kernel/Supervisor seat transcripts are read by Dispatch, each stored with a header that carries the completeness verdict; the blob store and `redact.mjs` stay the sink. The terminal scrollback scrape and the capture inside `close-op-terminal` and `quit-agent` are deleted. WRAP adapters name their deep-map row, and `docs/orca-boundary.md` records every KEEP and WRAP row and the worker-handle census. Contract change `worker-output-by-dispatch`.
- Lane C0-CANON: the core stops contradicting the zero-smell bar of the examples. `starci-fe/public-component-signature` accepts a component with no parameter (FE-TYPING-6 no longer teaches `void props`); `@starci/grammar` gains the semantic primitives `Region` (section), `NavLandmark` (nav), `List` and `ListItem` (ul, ol, li) and `no-raw-structural-element` names them; `FE_SWR_KEY_IDENTITY` reads `&&` and `||` gates; FE-I18N-1 teaches the request locale through `next/root-params` (`experimental.rootParams`) because next-intl 4.13 deprecates `requestLocale` and nothing stable replaces it; the managed fe scripts (`dev:fe`, `start:<app>`, `build:fe`) run `next` from the app directory so next-intl finds its request config, and a template spec builds the skeleton with `build:fe`; the fe skeleton is born with all of it. Contract changes `fe-public-component-signature-zero-params`, `fe-no-raw-structural-element-region-list`, `fe-swr-key-identity-and-or`, `fe-i18n-root-params-request-locale`, `hfs-fe-scripts-run-in-app-dir`. Versions are bumped by the C0 batch republish.
- The land gate selects specs by dependency: `scripts/lib/spec-deps.mjs` follows each spec's relative imports transitively (TypeScript scanner, so imports in strings or comments are never followed), and `land.mjs` `touching` mode adds every spec whose import graph reaches a changed file. A clash between two lanes (one changes a module another lane's spec relies on) is refused at land time. The full spec run before a tag stays. Spec: `tests/spec-deps.spec.mjs`.
- Lane C0-MAILC: worker questions reach the ledger through Orca's consuming `orchestration check` instead of the whole-host inbox read. The new `scripts/api/orca/orch-check.mjs` drains each workflow Run, naming the Kernel terminal. Every message of a Delivery is written into the ledger in one transaction, and the Delivery is acknowledged only after that commit. Questions and escalations become worker-question rows. Other types become `orchestration-message` events, and `worker_done` is handed to settlement. Heartbeats are counted. `api status`, `questions`, `messages` and `reply` drain first and then read only the ledger. `orch-inbox.mjs`, the `inbox` call and the heartbeat filter are deleted. The draw critic waits through the check of its own Run, and the launch smoke reads `worker_done` from the settled Dispatch. Smoke E2 passed live on Orca 1.4.209. Contract change `orca-mailbox-consuming-check`.
- R113 `FE_GRAPHQL_CONTRACT` (error, hfs check): every GraphQL operation a front end keeps in a `.graphql` file is validated against the back end's contract snapshot (`be/contracts/<service>/schema.graphql`) that serves its first root field, by a dependency-free GraphQL reader. Both examples' front ends were written against an older back end and now send what it serves (the shop also verifies and revokes sessions through the identity GraphQL doors and maps the backends' own refusal codes). Specs in `tests/hfs-repo-scripts-rules.spec.mjs`. Contract change `hfs-fe-graphql-contract`.
- Lane C0-SONARPROV: `sonar-local.mjs ensure-project --with-token` (and a re-mint of a rejected token) works for the example apps, whose declared analysis credential lives in `ext/sonar/secrets`: that is a managed custody, so the runtime seals the minted token there itself (`sops --encrypt` to the one recipient the directory's sealed members share, 0600 temp file, never argv, `.enc` only). A custody directory with no such recipient, or any other unmanaged location, is refused with a clear reason and the minted token is revoked. Specs cover both. `ext/sonar/README.md` and `secrets/KEYS.md` describe it.
- The land gate selects specs by dependency: `scripts/lib/spec-deps.mjs` follows each spec's relative imports transitively (TypeScript scanner, so imports in strings or comments are never followed), and `land.mjs` `touching` mode adds every spec whose import graph reaches a changed file. A clash between two lanes (one changes a module another lane's spec relies on) is refused at land time. The full spec run before a tag stays. Spec: `tests/spec-deps.spec.mjs`.
- Lane C0-SONAR3: Sonar's coverage scope works. SonarQube has no `sonar.coverage.inclusions`, so it was ignored and overall coverage read 65.8% and 45.2% on the examples while every service was at 100.
  - hfs sync renders `sonar.coverage.exclusions` as the complement of the services, derived from the slot manifest and the preset's coverage sources.
  - The runtime's `coverageScopeOf`/`coverageTargetOf` read the scope the way Sonar computes it.
  - A spec proves every executable be file of both examples is a service or excluded, never both and never neither, and that Sonar and Codecov describe one file set.
  - Re-scanned, both examples read 100% overall coverage and 0 bugs.
  - The examples declare their own analysis credential: PROJECT_ANALYSIS_TOKENs sealed in `ext/sonar/secrets`, chosen by the credential that names the project, else the one credential whose purpose is analysis.
  - The FE route-slot name of `error.tsx` is `ErrorBoundary` (Sonar S2137).
  - Contract change `sonar-coverage-exclusions`.
- Batch 3 republish: eslint-canon-be 3.0.7, eslint-canon-fe 8.0.7 and hfs 4.0.7 carry the runtime layer move (test-secrets onto api/sops/decrypt). Profiles are rebound.
- Lane C0-ORPHAN2: orphan worktrees after a crash are found in Orca's `worktree ps`, the GC's source of truth. Every Orca tree the runtime creates carries an ownership stamp (`--comment starci:<kind>:<slot>`); the [Worker] staging kind is stamped too, for when it moves to Orca. A stamped tree with no registry row is adopted while its owner lives, or its work is preserved to `preserved/orphan/<id>` and it is removed link-safely once its owner ended; each case logs an incident. An unstamped tree is never touched. A workflow tree's live terminals come from ps `liveTerminalCount`, and core-watch's WORKTREE fact reads ps. Live specs remove the repositories they register through `project setup-delete`, and the three leaked `fake-main` registrations are removed. Contract change `orca-orphan-worktrees`.
- Lane C0-KDEPTH: the runtime knows Orca's worker depth limit. `config.yaml` gains `orca.maxWorkerDepth` (validated, default 4, which must equal the Orca app's depth setting; Orca exposes no read of it). A launch whose nesting would exceed it is refused before worker-start with the new code `worker-depth-exceeded` (the parent is the launching terminal's own Dispatch, read from Orca's worker-list, so a Kernel started from a worker nests under it; startAgent before its Run and Task, api dispatch before the op's Task with no try spent, the draw critic under its op). `start --check` reports the configured value and, with `STARCI_ORCA_LIVE=1`, compares it with a measured no-op probe whose workers are all released. Contract change `worker-depth-limit`.
- Batch 2 republish: eslint-canon-be 3.0.6, eslint-canon-fe 8.0.6 and hfs 4.0.6 carry the runtime api layer (scripts/api/<system>), R112 integration specs with the dead-exports pairing, and the new pins (test-world 1.0.5, jest-preset 2.2.2). Profiles are rebound.
- Lane C0-SONAR2: the example apps run in the runtime repository's CI through ONE root workflow, `.github/workflows/examples.yml`, whose job matrix is derived from `examples/*/hfs.json` of kind app (`scripts/checks/examples-ci.mjs --matrix`). On push and pull request it runs typecheck, `hfs lint`, unit tests with coverage, the Codecov upload under the app's flag (skipped with a log notice without `CODECOV_TOKEN`), the front-end build and the Sonar gate where a server is configured. Integration and e2e start the docker stack and run only on `workflow_dispatch` (input `layers`): e2e is manual only. A root `codecov.yml` holds one flag per app over the same coverage scope as the app's own Sonar inclusions, 100 on the project and the patch. `example-unit.yml`, `todo-app-example.yml` and `todo-app-live-e2e.yml` are folded in and deleted. `npm run check` refuses a hand-written matrix, a per-example root workflow, an automatic integration or e2e step and a stale `codecov.yml`. The owner adds `CODECOV_TOKEN` once to this repository; each product monorepo adds its own. Contract change `examples-root-ci`.
- Lane C0 LAYER-1: the runtime's own source is layered. `scripts/api/<system>/` is the only place an external system (git, npm/npx, orca, sonar, docker) is started, `scripts/lib/` starts no process at all, and `scripts/checks/check-layers.mjs` (in `npm run check`) enforces both from the rule set `modules/kernel/runtime-layers.yaml` with the TypeScript AST; its exceptions live in one reviewed file, `modules/kernel/runtime-layers.allow.yaml` (temporary LAYER-2/LAYER-3 entries name their lane). The git spawn moved to `scripts/api/git/lib.mjs`; `scripts/lib/worktrees.mjs` was split into `scripts/lib/worktree-registry.mjs`, `scripts/api/git/worktree-*.mjs` and `scripts/api/orca/worktree-*.mjs`; process, npm, sops and fs calls moved to `scripts/api/{process,npm,sops,fs}/`. See `docs/runtime-layers.md`; contract change `runtime-api-layers`.
- Lane C0-WLIST: worker accounting comes from Orca's `orchestration worker-list` (new `scripts/api/orca/worker-list.mjs`, paged past 100 rows). The GC "agents" collector releases each reclaimable worker of the runtime's Runs per Orca's literal `nextAction` (never an `unverifiable` or `release_unknown` row: `WORKER_RELEASE_REFUSED`; the unverifiable ones go to the owner as one incident listing handle, Run and age; `WORKER_RELEASE_FAILED`, `WORKER_LIST_UNAVAILABLE`), and the reconciler GC events do the same per entity. Worker terminals are no longer identified by tab title or screen, so the title rules are deleted. The lane owner is an active worker on the lane's worktree, and check-orca-tree counts Orca's workers of the ledger's Runs (`--workers`). `TERMINAL_COUNT_DRIFT` is measured against Orca's active workers. machine.sqlite `0004-terminals-shells-only` keeps only shell sightings in `terminals`. Contract change `worker-accounting-orca-worker-list`.
- Lane C0 SETTLED (Orca deep map REPLACE #9, guarded by smoke E3): an op settles its own Orca Task and Dispatch. `api report`, in the op's pane, sends exactly one `worker_done` (new `scripts/api/orca/send.mjs`, replay request) after the report row committed and before the settler starts; settle, the failed-no-report settle and `reconcile --release-worker` only release (worker-stop only for a Dispatch that did not settle itself, its state kept as `managedWorker.dispatch`). The runtime never issues `task-update` for an op Task: `closeOperationTask`, `taskClosed`, finish/archive `tasksClosed`, `staleTasks`, `api reconcile --orca-tasks` and the GC `tasks` collector are deleted. New code `worker-done-unsent`. Contract change `op-worker-done-settles`.
- Lane C0 Lane A (Orca deep map RR1, W1): Orca's own launch and idempotency, nothing parallel. Every agent starts with `worker-start --spec`, which files its Task in the same call (no `task-create`, so a failed start leaves no orphan Task), and its terminal comes from the start receipt (`result.worker.agentTerminalHandle`) or `worker-show` (no `dispatch-show`); both wrappers are deleted. `calls.yaml` idempotency is now enforced: every mutation declares `replay` (`none`, `reissue` or `request`); `run-create`, `run-use` and `worker-start` carry `--retry-request` derived from the caller's ledger identity from their first issue, and a lost receipt is settled by `request-show` and one replay, never a blind second Run, rebind or worker. Contract change `worker-start-spec`.
- Batch 1 republish: eslint-canon-be 3.0.5, eslint-canon-fe 8.0.5 and hfs 4.0.5 carry the workflow-worktree slots text, the services-only coverage gate and the new pins. @starci/heroicons is pinned (0.3.1) as an icon source eslint-canon-fe admits. Profiles are rebound.
- WFWT (lanes A, B, C under C0): one worktree per Kernel workflow replaces the per-op worktree lifecycle and the per-op landing, with no legacy. Orca creates the workflow worktree before the Kernel starts (`orca worktree create --name wf-<id> --base-branch main --setup run`, a real `npm ci`, no `node_modules` junctions), and the Kernel starts in it with `worker-start --worktree <path>`; the workflow branch is Orca's `wf-<id>`, read from the registry; every op runs in it, serially per side and in parallel across `be/` and `fe/`. Ops never commit: a green op is a checkpoint commit the runtime makes on `wf-<id>`, and its gate is measured against the previous checkpoint; a failed op is preserved to `preserved/<id>/<op>` and the worktree reset to the last checkpoint. Main moves only at the workflow's finish: full gate, merge guard, `review.verify` of the exact head, rebase, fast-forward and push. The worktree is then `release-pending`, and the host-side controller removes it once its terminals are released. Inside the workflow worktree the command guard refuses every history or ref change (`WORKFLOW_HISTORY_CHANGE`). The launch smoke (`starci/launch-smoke@2`, `--app-repo <scratch app>`) gains the path `workflow-worktree`, Contract change `workflow-worktree`.
- Lane C0-WSTAGE: a `[Worker]` staging checkout (and the Supervisor's own `workers.mjs stage --self` lane) is an Orca worktree. The runtime creates it with `orca worktree create --name sup-<job> --comment starci:supervisor-staging:sup-<job>;sup=<job>`; the registry kind `supervisor-staging` is keyed by Orca's worktree id. The job records the path, branch, base and Orca id that Orca reported, and the land gate, the GCs and the reports read those recorded values. Removal is the link-safe Orca path: links unlinked, `orca worktree rm`, the row closed, then the branch deleted or kept. The git staging path, `stagingPathOf`, `branchOf`, `stagingRoot` and the GC's `sup/*` branch and path patterns are deleted. `check-worktree-add` fails a `createScratchWorktree` call that names an Orca kind. New codes `WORKER_STAGING_CREATE_FAILED` and `WORKER_STAGING_REMOVE_FAILED`. Contract change `wstage-worker-staging-orca`.
- Lane C0-SONAR (owner 2026-10-01): Sonar and Codecov judge coverage, scoped to the back end's services only, from one scope. Contract change `sonar-services-coverage`; it reverses "Sonar has no coverage" and "Codecov stays removed".
  - `@starci/jest-preset` 2.2.2 writes `coverage/lcov.info` (reporters `text-summary`, `text`, `lcov`); coverage is still collected from `src/**/*.service.ts` only at per-file 100.
  - `hfs sync` renders the one scope, the preset's `COVERAGE_SOURCES` under `be/`, into the managed `sonar-project.properties` (`sonar.javascript.lcov.reportPaths=be/coverage/lcov.info`, `sonar.coverage.inclusions=be/src/**/*.service.ts`) and a new managed `codecov.yml` (project and patch at 100, `fe/**` ignored); the managed CI uploads the lcov with the `CODECOV_TOKEN` secret, which the owner adds per repository. A spec proves the two files agree.
  - `knowledge/sonar-gate.yaml` holds coverage 100 on new code and overall (per file) and every hotspot reviewed. The runtime judges each service on its own measure (`judgeCoverage`, `judgeDashboard` in `scripts/checks/sonar-gate.mjs`): one service below 100 fails and a non-service file is never part of the measure. `sonar-local.mjs scan` measures the slice's services with a unit run before the scanner (not while `specs.unit` is off); the new `sonar-local.mjs dashboard` prints a project's bugs, code smells, vulnerabilities, hotspots reviewed and per-service coverage and fails unless all are at the gate.
  - hfs and the canons are bumped in C0's batch: their bundled `knowledge/sonar-gate.yaml` and `knowledge/hfs/slots.yaml` changed (hfs also `modules/kernel/failure-codes.yaml`, `sync/index.mjs`, `sync/managed.mjs` and the templates). The examples are re-rendered.
- The per-service coverage law is proven by running jest: `packages/jest-preset/coverage-per-service.test.mjs` builds a fixture app with a fully covered 40-method service and a one-method service that misses one branch. The run fails on the small service although the average is far above 99, and passes when both reach 100. Enforcement lives in the preset (`coverageThreshold` keyed by the `./src/**/*.service.ts` glob, applied per file) and in `scripts/checks/unit-run.mjs` (`coverage-below` for any single service).
- R112 `BE_INTEGRATION_SPEC_MISSING` (error, hfs check): every back-end integration (`src/modules/integrations/<provider>/` with `<provider>.config.ts`) has an integration spec in `src/tests/integration/<provider>/` that, read as a syntax tree, registers the integration's own module through `useTestWorld({ modules })`, references its ErrorCode enum and drives an outage through the world. `dead-exports` counts such a spec as a consumer of its own provider's exports only. Specs in `tests/hfs-repo-scripts-rules.spec.mjs` and `packages/eslint/be/project-graph.tiers.test.mjs`. Contract change `hfs-integration-specs`.
- `@starci/test-world` 1.0.5: `useTestWorld({ modules, apps })` boots real peer apps beside the modules (`w.apps.<peer>.url` wired), `world.apps.<name>.during(fn)` is the outage of a peer app under the run's outage lock, and `w.keycloak.clientSecret(client)` answers the secret the realm import generated for a confidential client. The bundled canon-pins copies pin it; their republish is batched.
- `@starci/test-world` 1.0.4: `world.resolve(token)` and `scope.resolve(token)` take any Nest provider token (a class, a string or a symbol), so a modules spec resolves an integration client bound to a symbol through the world. The bundled canon-pins copies of hfs and the canons now pin it; their republish is batched.
- Lane C0-SMOKE: the pre-workflow launch smoke `scripts/kernel/launch-smoke.mjs` (`starci/launch-smoke@1`) proves on the live host that `[Supervisor]` -> `[Worker]` (depth 2) and `[Kernel]` -> `[Op]` -> draw critic (depth 3) start through worker-start; every no-op agent runs the cheapest pinned model and is always released. The draw critic is now placed on a runtime worktree detached at the empty tree, because Orca refuses a bare temp directory (`selector_not_found`). New `worker-read` wrapper. Contract change `launch-smoke`; the smoke is a step of the pre-workflow readiness in docs/releasing.md.
- Lane C0-SUPV: agent guidance no longer contradicts the command guard. `modules/supervisor/supervise.yaml` told the Supervisor to open lanes with a raw `git worktree add`; it now uses its own staged lane (`workers.mjs stage --self`, removed by its `land.mjs --commit` land). `skills/claude-debug` and `skills/push-git` create lanes the same way and start workers through worker-start, and `docs/verify-proof.md` describes the runtime's own worktree API calls. The new `scripts/checks/check-guidance-commands.mjs` (`RT_GUIDANCE_REFUSED_COMMAND`, in `npm run check`) runs every command that module YAML, module prompts and skills tell an agent to run through the guard's own `commandVerdict`. Commands shown under a prohibition, or in a runtime-internal or incident description, pass. Contract change `guidance-matches-command-guard`.
- Lane C0-KGUARD: the Kernel has a guard file. `scripts/kernel/start-workflow.mjs` writes it a job guard of role `kernel` through `guardLaunch` (`kernel-<workflow>`, no owned path, its `workflowWorktree`) and binds it to the Kernel's Orca terminal as worker-start names it, so the PreToolUse command guard refuses the Kernel's raw git history changes in the workflow worktree (WORKFLOW_HISTORY_CHANGE), `git worktree add`, recursive deletes, kills by name and raw agent launches, while its `node api.mjs <verb>` calls pass. The history hook (v6) skips a kernel guard, because the runtime's own git under the Kernel's api calls inherits its terminal. A guard that could not be put in place rides on `kernel-booted` `guard` as the new code `kernel-guard-unbound`. Contract change `kernel-guard-file`.
- Fixed: the write-family guard switched itself off for business.decide and architecture.decide once lane OPS2 gave them a `STARCI_JOB_SCRATCH/read-digest.json` write. A job-scratch write, like an evidence write, is not a Work record and never disables the guard (`scripts/kernel/write-families.mjs`; tests/write-families.spec.mjs is green again). The jest-preset lockfile is registered in json-exceptions.
- eslint-canon-be 3.0.4, eslint-canon-fe 8.0.4 and hfs 4.0.4 republish because their bundled `canon-pins.yaml` pins test-world 1.0.3; the profiles are rebound. No rule or command changed.
- The canon content digest covers the bundled YAML data too: the include list is `**/*.yaml` plus the earlier mjs/json/md/ts. Before, an edit to a canon's runtime/ `canon-pins.yaml` or `slots.yaml` changed its published content while the binding still read as valid. Grammar 0.8.1, tsconfig 2.0.1 and jest-preset 2.2.1 republish because their packed `package.json` changed (lane PKGT's declared devDependencies), even with no source change.
- Lane C0-CRITIC: the draw loop's independent critic is an Orca worker. `scripts/work/draw-critic.mjs` starts it through `startAgent` (worker-start `--agent`, `--model` and `--effort` from `allocation.drawLoop.critic`) in a clean directory, waits for its `worker_done` through the orchestration commands within `timeoutMs`, reads `verdict.json` and releases the worker. A timeout, a refusal or a missing verdict is a typed `outcome` with no beauty. The `codex exec` / `claude -p` child process and its shell shim are gone. The new `check-host-boundary.mjs` rule `agent-cli-spawn` (`AGENT_CLI_SPAWN`) reads runtime code with the TypeScript AST and refuses a `node:child_process` spawn of an agent CLI. Contract change `draw-critic-worker-start`.
- Lane OPS2: every op whose job touches a runtime mechanism now uses it, and settle enforces the mandatory ones. `knowledge/op-gate.yaml` gains `proofs` and `opProofs`. Each listed op attaches the document of each mechanism it owes. `api settle` re-reads every document itself (`scripts/kernel/gate-settle.mjs` `judgeJobProofs`, runtime check `op-proof`) and refuses a done that lacks one, is red or could not run. There are 22 new settle codes. Contract change `op-mechanism-proofs`; a leg admitted earlier settles on its old contract.
  - `e2e.verify` and `integration.verify` run on `@starci/test-world`. The new `scripts/checks/test-world-run.mjs` (`starci/test-world-run@1`) checks the preset's world runner and the `defineTestWorld` declaration. It requires `useTestWorld({ apps })` for e2e, `useTestWorld({ modules })` for integration and `useSandbox` for the live contract run, forbids hand-rolled docker, DataSource, `process.env` or sleeps in a spec, counts the outage calls and requires a green run with nothing skipped.
  - `unit.verify` runs `scripts/checks/unit-run.mjs` (`starci/unit-run@1`): every service is held at 100 on each metric with its spec beside it, built by `Test.createTestingModule` over the `@starci/jest-preset` kit.
  - `security.verify` runs the security canon (R41, R42, R44, R49, R71, R90, R107) through `hfs lint`. It must carry every such finding by rule in `starci/security-findings@1`.
  - `interface.audit` lints the audited `fe/` files. `interface.draw` and `interface.asset` lint every file they produce, with a FIX loop.
  - `review.verify` runs `gate.mjs` read-only over the reviewed range, merge guard included, in its code modes. It classifies every defect as business or non-business (`starci/review-defects@1`). A non-business defect that no check caught records a `missingCheck` for .claude.
  - `release.deliver` attaches `scripts/checks/release-proof.mjs` (`starci/release-proof@1`) before a publish or a deploy: release-app-installs, check-canon-pins with the content digest, the merge guard over the release range and `npm run check`. None may be skipped.
  - `docs.author`, `knowledge.repair` and `work.author` READ with a digest and pass the new document gate, `gate.mjs --profile docs` (doc-language, check-work-surfaces, check-work-deep, check-example-work, check-contract-cites, check-json-exceptions).
  - `architecture.decide`, `business.decide`, `scope.define`, `scope.finish`, `decision.prepare` and `brand.decide` READ the knowledge and hfs slots their decision cites (`read-digest.mjs --knowledge`) and attach the digest.
  - `workspace.manage`, `runtime.operate` and `scope.finish` act on worktrees only through `scripts/lib/worktrees.mjs` and launch agents only through worker-start. The uat ops run on the app's real dev stack. The scaffold ops scaffold through `hfs scaffold app` and `hfs sync --write`. `test.author` maps each assertion to its test layer.
  - Specs: `tests/op-mechanism-proofs.spec.mjs`, one per refusal.

- Lane BOUND: `gate.mjs` type-checks a project only inside its app root (hfs.json of kind app, else the nearest lockfile root). Both tsc programs and the installed-canon lookup ignore any enclosing repository's node_modules, so an import the app does not install is TS2307. An app root with no install is `GATE_INSTALL_MISSING` (exit 2, never measured). The ESLint typed project service is not bounded; the contract change says why. Contract change `gate-tsc-app-root-bound`.
- Lane ROOT (owner correction): `.starcistacks/` and `.sops.yaml` live at the app root, beside `fe/`, `be/` and `.starciwork`, never under `be/`. Contract change `starcistacks-app-root`.
  - hfs 4.0.2, eslint-canon-be 3.0.2, eslint-canon-fe 8.0.2 (their bundled slots, canon-pins and failure codes change), `@starci/test-world` 1.0.2, then 1.0.3 (the globalSetup resolves the path aliases of the tests tsconfig through its `extends` chain exactly as TypeScript does). The code-patterns binding of the bumped canons is the owner's (publish, then rebind); until then `npm run check` reports `CANON_BINDING_DIGEST` for them.
  - Slots `app.starcistacks` and `app.sops` replace `be.starcistacks` and `be.sops`; a side holding `.starcistacks/` or `.sops.yaml` is `HFS_FORBIDDEN_PRESENT` (repo.side-root-forbidden), and the machine reports `HFS_STACKS_IN_SIDE` for either side (it replaces `HFS_STACKS_IN_FE`).
  - `custody.sealed` is `.starcistacks/<env>/secrets/<slug>.enc`, app-relative (schema pattern, `SEALED_LOCATION_RE`, check-example-work); the side form `be/.starcistacks/...` is refused by name (`SEALED_CUSTODY_LOCATION`, `HFS_IDENTITY_CUSTODY`).
  - The managed `.gitignore` block carries the custody rules; the scaffold writes `.starcistacks/application-stacks.yaml` and `.sops.yaml` at the root; R47 `test-world-files`, R84 `connection-map`, the Sonar key and `hfs work-hygiene` read the root tree.
  - The examples moved with `git mv` (`examples/todo-app/.starcistacks`, `examples/ecommerce-app/.starcistacks`, both `.sops.yaml`); their world setup, Keycloak realm path, port projection readers and records point at the root.
- eslint-canon-be 3.0.1 and eslint-canon-fe 8.0.1 republish the canons, because their bundled `canon-pins.yaml` copy now pins hfs 4.0.1. No rule changed.
- `check-doc-language` judges only the repository's documents: tracked files and untracked files git does not ignore. The owner's git-ignored local `config.yaml` is not a repository document, and judging it made `npm run check` red only in the main checkout. Outside a git work tree every file is judged. Spec in `tests/architecture-doc-language.spec.mjs`.
- Lane DIGEST: the canon content digest is verified again (its only verifier went with `check-scoped-lint.mjs` in b0436ee93). Contract change `canon-content-digest`.
  - One helper, `scripts/lib/canon-digest.mjs`, hashes a canon by the profile's `canon.contentDigest` policy and reproduces the bound canon-be and canon-fe values from the npm pack list; an unknown algorithm or framing, a malformed policy, a symlink and a missing file are refused with typed codes.
  - `npm run check` (`check-canon-pins.mjs`) fails a profile whose `canon.version` differs from the canon's package.json or pin (`CANON_BINDING_VERSION`) or whose published file set digests to another value (`CANON_BINDING_DIGEST`): any change to a published canon file, including the copies bundled into its `runtime/` folder (canon-pins, failure codes, slots), needs a version bump, a republish and a rebinding.
  - `gate.mjs` judges the canon each side of the app installed: another version or digest blocks (`canon/installed-canon-mismatch`, exit 1); a canon that is not installed is exit 2 (`CANON_INSTALL_MISSING`), never a pass.
- `@starci/test-world` 1.0.1 adds two capabilities:
  - `world.keycloak.events(personId)` and `sessions(personId)` read the user events (LOGIN, LOGOUT, ...) and the live sessions that the repository realm stored, through the admin API. The admin credentials stay inside the library.
  - `world.infra.postgresql.connection(name)` takes ONE connection's database down while the other connections keep serving, under the run's outage lock, and `world.interruptDatabase(fn, connection?)` passes that connection on.
- Lane TW2: `@starci/test-world` 1.0.0 (the shared e2e library, with the run's outage lock that every outage call takes itself) and `@starci/jest-preset` 2.2.0. The integration, e2e and contract projects run on the preset's world runner: each spec file runs in a fresh worker process, so no process-global framework registry such as `@nestjs/graphql`'s type metadata leaks between files. The runner enforces ONE FILE AT A TIME, because every file shares the run's data and the test world resets it when a file boots. Contract changes `test-world-library` and `jest-preset-world-runner`.
  - Known limitation, lifted in alpha.4 by C0-TESTWORLD: world files cannot run in parallel until each worker has its own data namespace (a database schema, a Keycloak realm prefix, a Redis key prefix and its own fakes).
- A scaffold proof never passes by skipping. `tests/hfs-scaffold-app.spec.mjs` prints `SKIPPED: no installs - <proof>: <reason>` when it has no installs. With `STARCI_REQUIRE_APP_INSTALLS=1` a missing install fails the test instead. `scripts/checks/release-app-installs.mjs` does the following, and CI runs it as its own step:
  1. scaffolds `release-app`;
  2. installs it from the npm registry;
  3. runs the spec with installs required, so the lint, typecheck and api boot proofs run against fresh published packages.
- Lane SHAPE: gaps the merged examples exposed are closed, each with a violating and a passing spec.
  - New rule R111 `HFS_PEER_INTEGRATION_MISSING`: the app root package.json declares the runtime peer of every driver integration pair of the data catalog `knowledge/hfs/peer-integrations.yaml` (`@nestjs/apollo` on `@nestjs/platform-express` 11 requires `@as-integrations/express5`); the scaffold spec builds the scaffolded be api with `build:be` and boots it with `start:api`.
  - `BE_SOURCE_FORM` admits `be/src/tests/world/fakes/<provider>/server.ts` through the slot manifest (be.tests.world allows the literal entry), the path `test-world-files` already accepted.
  - The managed `typecheck` of an app with fe packages builds them before it type-checks the fe apps; the scaffold writes `workspace.yaml` with the `be`/`fe` sides, validated against `work/workspace@1`.
  - R105 judges the `.starciwork` records of the `be` and `fe` sides from the app root.
  - The Work checks resolve a record's `repository` only as a declared side: the two-repository binding fallback of `repoRootFor`, `check-evidence-binding --repo` and `PROOF_COMMAND_AMBIGUOUS` are deleted, and the Work fixtures use the app shape. Contract change `hfs-peer-integrations`.
- A product is one app repository (hfs 4.0.1, slot and rule manifests at 2.0.0, `@starci/eslint-canon-be` 3.0.0, `@starci/eslint-canon-fe` 8.0.0; package changelogs under `packages/hfs`, `packages/eslint/be` and `packages/eslint/fe`). The app root holds:
  - the one `package.json` (every dependency and script of both sides; npm workspaces only for the sides' `packages/*`), the one lockfile and `node_modules`;
  - `hfs.json` of kind `app`: `{ hfs: 2, kind: "app", project, sides: { be: { apps, optionalSlots, connections }, fe: { apps, optionalSlots, reads: ["be/contracts/"] } } }`;
  - README, CI, `.husky`, `scripts/` and `.starciwork` (slots of profile `app`).
  `be/` and `fe/` hold what the standalone repository roots held except `package.json` and the lockfile. Every check, canon rule and machine check judges a side with its folder as the root, and nothing crosses sides except the declared reads. `hfs lint`, `hfs check` and `hfs sync` run at the app root:
  - `hfs lint` runs ESLint per side with that side's canon, stylelint over `fe/` and the app check, into one report and one Sonar import;
  - every finding path and every path a finding message names is app-relative (`be/...`, `fe/...`).
  `hfs scaffold app <name>` writes the shape and resolves its real lockfile with npm (`npm install --package-lock-only`; 4.0.1, the 4.0.0 root-only stub lock was refused by `npm ci`; a failed step is `HFS_SCAFFOLD_LOCK_FAILED` and leaves no app); its spec lints it with 0 findings and type-checks it with the scaffold's own `typecheck` script. Deleted, with no alias:
  - the standalone be and fe repository kinds (`profile`, `stacks`) and a pre-4 `hfs.json`;
  - `hfs sync --init` and `HFS_SYNC_SKELETON_MISSING`;
  - the front-end contract copy and its hash comparison;
  - `check-canon-pins --side`.
  One version per dependency: a conflict between the sides takes its canon pin, otherwise the higher (`graphql` 16.14.2 pinned). Fixed with it:
  - the machine gives each file to the deepest tsconfig project that holds it, so an app's `@/` alias resolves (the `route-files-thin` "0 feature owners" false positive);
  - a route file binding a declaration to a Next.js segment export (`generateMetadata`, ...) is not an `HFS_ALIAS_REEXPORT`.
  Contract change `hfs-app-monorepo`.
- The runtime's examples are apps of the hfs 4 shape. `examples/todo-app-backend` and `examples/todo-app-frontend` became
  `examples/todo-app`, and `examples/ecommerce-app-be` and `examples/ecommerce-app-fe` became `examples/ecommerce-app`.
  Each app has its back end in `be/` and its front end in `fe/`, and its root holds:
  - one `package.json` and lockfile for both sides, with every dependency at its canon pin and the choices recorded in `knowledge/hfs/canon-pins.yaml`;
  - the `hfs.json` of kind `app`;
  - the managed root files;
  - the `.starciwork`.
  The old folders are deleted with no aliases. Implementation records name the side their code lives in (`impl/be`, `impl/fe`, `repository: be|fe`), and every owner path is app-relative (`be/...`, `fe/...`). Each test world runs the services its stack declares for real: Postgres and the cache's Redis in ecommerce-app, and Postgres and Keycloak in todo-app, importing the repository's `realm-todo.json` with user and admin events on. `world.infra.<service>` drives their outages, and only external providers stay faked. Both sides of each app type-check, and the unit suites stay green. The examples gate `scripts/checks/check-example-architecture.mjs` now runs `hfs lint`, because the machine's source rules sit on the lint surface. Every reference moved with the folders:
  - specs, including `tests/canon-packed-load.spec.mjs`;
  - CI workflows;
  - docs and knowledge;
  - `modules/schemas/json-exceptions.yaml`;
  - `packages/fe-kit/scripts/link-peers.mjs`.

- The orphaned code-pattern checkers are settled. `scripts/checks/code-patterns/` lost its runner when `check-scoped-lint` was removed; the folder, its 8 docs, 11 specs and 24 failure codes are deleted and listed in `modules/kernel/retired-paths.yaml`. The 24 codes went three ways:
  - 15 were already enforced by a canon rule or an hfs check (R38, R39, R43, R47, R49, R51, R53, R56, R65, R85, R89, R90, R102, base-props-atom);
  - 2 were contradicted by the convention (import formatting belongs to Prettier; the test-title verb list);
  - 4 were inexact, deleted with proposals.
  Three obligations had no enforcer and are ported at error, with specs:
  - R108 `replacement-throw-carries-cause` (BE);
  - R109 `require-public-member-jsdoc` (BE, exported classes, interfaces and object types outside the test tiers);
  - R110 `props-fields-readonly` (FE, deep readonly props).
- `scripts/checks/failure-codes.mjs` reads a bracketed `UPPER_SNAKE` name as an emitted code only in text: a message prefix such as `[TARGET_MISSING] ...`, a template, a comment or a YAML flow list. In JavaScript, a bracket holding a single identifier is code that reads a constant, and it is found by parsing: an element access (`baseline[MIRROR_CHECK]`, `x?.[KEY]`), an array literal (`[SKILL_ROOT]`) or a computed key (`{ [KEY]: v }`). Removed with it:
  - the stale `TRANSCRIPT_CODE` catalog entry (its emitted value `TRANSCRIPT_MISSING` keeps its entry);
  - 38 `failure-codes.not-codes` entries that existed only to silence those false positives.
  Spec: `tests/failure-codes-scan.spec.mjs`.
- Op worktree lifecycle is owned by the runtime (lane WT). `scripts/kernel/product-worktree.mjs` `integrateOp` lands an op through the one gate (`runLandGate`, `scripts/checks/gate.mjs`) and makes these checks:
  - a merge guard runs before the rebase (`land-merge-dropped-main`);
  - the gate runs on exactly the rebased op tree (`op-worktree-dirty`, `op-worktree-reset-failed`);
  - a pre-land verify re-runs the op's declared green checks, the land checks and the import check (`product-integrate-red`, with a continuation);
  - a refused fast-forward is `land-main-refused`, or `main-moving` once retries run out, and the tree is restored on every refusal.
  After a land, main is pushed, and each op records one `product-op-landed` event. Preserved work is a `snapshotCommit` that never holds `node_modules`. The workflow-branch `integrateOp`, `depsUnit` and product-land are deleted.

- `/claude-debug` is invoked once and schedules itself with Claude Code's own `/loop <interval> /claude-debug pass`, the interval read from the new validated `config.yaml` block `claudeDebug: {interval, worktreeLimit}` (default in `config.example.yaml`, none in code); a second invocation finds the live loop and starts none. Each tick is exactly one pass: a read-only check of everything (engine, controllers, queues, services, seats, workflows and legs, orphan ledgers, tokens, worktree counts and orphans, main-checkout integrity: tracked deletions and empty `node_modules`/`packages/node_modules`, failing land and push gates), diagnosis, one lane per new core alert and a Vietnamese diagnosis table (symptom, cause, fix owner). `scripts/supervisor/debug-pass.mjs` keeps the loop record and the open fixes by alert key in `<state root>/claude-debug/state.json`, so no pass dispatches a duplicate lane. `scripts/supervisor/core-watch.mjs` is a single snapshot only; its forever change-stream mode, `--once` and `--interval` are removed. Contract change `claude-debug-loop`.
- Status tones follow HeroUI (owner decision 2026-09-30): a solid pair and a soft pair per tone. `contrast-aa` holds a `<success|warning|info|danger>-soft` token with its foreground, and that soft foreground as a bare glyph on each surface, background or canvas token, to `policy.softMinContrast` (3:1 by default; evidence kinds `soft`, `status-glyph`); body and interactive text keep `policy.minContrast` 4.5:1. COLOR-5 case-1a, the tone and brand.decide guidance, the schema, `docs/brand-checks.md` and the `@starci/grammar` contrast pairs (0.7.1, `SOFT_MIN`) carry the same rule, so a lane no longer darkens a status tone to reach AA as a bare glyph. Contract change `status-tones-heroui-soft`.
- The Qwen provider is removed entirely (owner ruling 2026-09-29): its agent card, pool (`qwen-agent`), profiles (`qwen-agent`, `qwen3.8-max`, `deepseek-v4-pro`), quota probe (`scripts/api/quota/qwen.mjs`), the `quota` config key (Qwen was its only member), the Orca host recipe, the loop-detection gate, the input-row/ghost-suggestion card fields, the Qwen token adapter and session sweep, and the base-pool line of the supervisor status block. Only claude, codex and devin remain; `agent: qwen`, `qwen-agent` in `config.yaml` is refused with a Vietnamese message saying Qwen was removed and to use claude, codex or devin. No backward compatibility. Contract entry `provider-qwen-removed`; deleted paths are in `modules/kernel/retired-paths.yaml`.
- The op evidence directory is `evidence/` (was `E/`): op manifests, the shared op prompt, schemas, docs and every consumer (artifact subkind, write families, agent-data boundary, verify-failure, context pack, api proof segments) use only `evidence/`; the `E/` form is removed with no legacy fallback (contract change `evidence-dir`).
- The comeback concept is removed: `scripts/supervisor/comeback.mjs` is deleted and listed in
  `modules/kernel/retired-paths.yaml`; `COMEBACK_HINT` and every comeback pointer are gone from
  `engine/ledger-db.mjs`, `engine/machine-db.mjs`, the reconciler schedules, the supervisor home, the
  `.starciwork` boundary, `modules/schemas/work-layout.yaml` and `docs/ledger-db.md`. An old-schema store is
  still refused — a fresh `runtime.sqlite` is created by `openLedger` at the file
  `ledgerFileFor(<repo root>)` resolves (the host store by `openMachine`), each on first use once the refused
  file is moved aside; archiving an old store is a manual owner act. `archives.kind` drops `'comeback'` for
  new stores. Contract change `comeback-removed`.

## [1.0.0-alpha.3] — 2026-09-28, base `7b2737d2e`

Theme: one storage architecture that is easy to query and hard to corrupt. All state lives in two
SQLite databases, each with one writer module, plus one content-addressed blob store; the state
machines and the bug classes found by the 2026-09-28 log audits (H1–H17, MB-01..17) are refused by
the schema itself. Clean slate: there is no migration, backfill, v2 table or read fallback. The
comeback (`scripts/supervisor/comeback.mjs`) archives and wipes the old stores; the runtime refuses
an old-schema file with a pointer to it. Design: `docs/architecture.md`, `docs/ledger-db.md`,
`docs/debugging.md`; contract change `alpha3-release`.

**Storage: two databases and a blob store**

- `runtime.sqlite`, one per project, now lives at `%LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite`
  (resolved through `machine.ledgers`), outside every repository. Schema
  `engine/migrations/runtime/0001-init.sql` (`starci/runtime@1`, `user_version` 1, STRICT, `json_valid`
  everywhere); the only writer is `engine/ledger-db.mjs`, with typed write functions per table group,
  the event digest chain computed in JS, idempotency through `api_requests`, and W3C `trace_id` /
  `span_id` on every write.
- `machine.sqlite`, one per host, at `%LOCALAPPDATA%/StarCi/machine.sqlite`. Schema
  `engine/migrations/machine/0001-init.sql` (`starci/machine@1`); the only writer is
  `engine/machine-db.mjs`, which also owns the ledger registry (`registerLedger`, `resolveLedger`,
  `listLedgers`, `forEachLedger`).
- Blob store `~/.starci/artifacts/<sha[0:2]>/<sha256>`; `blobs.http_path` is a generated column.
  `scripts/lib/redact.mjs` is the one redaction module, applied before every blob put and every log
  write. `scripts/lib/blob-lookup.mjs` turns a citation back into bytes.
- Connection policy: WAL verified, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout` 15 s,
  `trusted_schema=OFF`, one checkpointing connection (the engine), read-only `query_only` readers,
  the SQLite version recorded in meta.
- The land gate runs `scripts/checks/check-db-openers.mjs`: no `new DatabaseSync` on a ledger outside
  the writer and reader modules.
- Vocabulary: a **unit** (`work_units`) is one step; a **job** is one try (`try_no`, `retry_of`); an
  **attempt** (`op_attempts`) is one dispatch (`dispatch_seq`), with its contract, report, check runs,
  artifacts, prompt, final transcript and 60 s scrollback snapshots.
- Agent output leaves `.starciwork`: reports only in `reports`, checks in `check_runs` (raw
  `exit_code` apart from `declared_exit_code`), attachments, captures, UAT runs, draw loops, layout
  captures and ask answers as blobs plus rows. A Work record cites them by artifact id and sha256
  (`work_citations`, `scripts/kernel/work-citations.mjs`, check `CITATION_UNRESOLVED`).
  `.starciwork` holds product content only (`scripts/lib/starciwork-boundary.mjs`,
  `work-layout.yaml shape.productPaths`); `check-example-work` refuses agent data in it.

**Retired stores** (archived and deleted by the comeback; no code reads or writes them)

- The Supervisor ledger `~/.starci/supervisor/.starciwork/runtime.sqlite` → `sup_*` tables, `seats`,
  `deliveries` and `machine_logs`.
- `reconciler.sqlite`, `reconciler.heartbeat`, `reconciler-starts.json`, `reconciler.log` →
  `engine_leader`, `leader_history`, `process_runs`, `engine_queue`, `engine_actions` (full result,
  stdout and stderr as blobs), `controller_modes` + `mode_changes`, `sla_episodes`,
  `invariant_violations`, `services` + `service_events`.
- `journal.sqlite` (no writer since `c2a3ccf92`), `logs.sqlite`.
- JSON state: `ram-throttle.json`, `gc-state.json`, the land queue directories, `connectors/`,
  `env-servers/`, `uat-slots/`, footprints → `throttle_*`, `pool_backoff`, `gc_runs`/`gc_items`,
  `land_queue`/`land_runs`/`pushes`, `connectors`/`host_locks`/`notifications`/`sup_messages`,
  `env_servers`, `uat_slots`, `host_samples`.
- Text logs (`supervisor/logs/*.log`, watchdog logs, connector logs) → `machine_logs` with FTS5.
- `.starciwork/kernel-evidence/**`, `kernel-strays/**`, `E/**`, `runs/**`, impl `assets/`, draw loops,
  settle caches → blobs and rows.
- Deleted code: `engine/schema.sql`, `engine/evidence.sql`, `engine/triggers.sql`, `engine/machine.sql`;
  every migrator and backfill (`scripts/migrate/evidence-to-blobs.mjs`,
  `scripts/work/{backfill-artifact-subkind,backfill-job-artifacts,backfill-patch-json,backfill-work-graph,migrate-logs-into-ledger,migrate-runtime}.mjs`,
  `scripts/route/backfill-plan-edges.mjs`); `scripts/kernel/prune-registry.mjs`,
  `scripts/kernel/report-owner.mjs`; `scripts/checks/check-work-history.mjs`,
  `scripts/checks/check-work-replay.mjs`; the retry-lineage helpers. All listed in
  `modules/kernel/retired-paths.yaml`.

**Workflow phases and the Kernel API**

- Seven phases: `awaiting-approval, queued, running, paused, stopped, finished, archived`.
  `workflow_transitions` and `job_transitions` are data; triggers refuse any other transition, and a
  phase change without its `lifecycle_changes` row.
- New verb `api lifecycle --pause | --stop | --resume`. Only the owner resumes a stopped workflow
  (`stopped → queued`); no controller, Kernel or Supervisor resumes one (Q14, MB-08).
- New verb `api unit`: a unit's try budget (default 5) is raised only by the owner or the Supervisor
  (`--raise-budget`, with a reference). Re-running a passed unit needs `enqueue --reopen <reason>`.
- `api report` reads the report from the job scratch (`STARCI_JOB_SCRATCH`) once, stores it only in
  `reports`, turns `--attach` files into blobs, then deletes the scratch.
- `api check` re-runs runtime checks into `check_runs`; any other command is recorded as `declared`
  and never counts green.
- Dispatch writes one `op_attempts` row plus its contract per dispatch; leased → running is a
  compare-and-set on the lease token.

**Hidden bugs fixed** (LOG-AUDIT-PROJECTS, LOG-AUDIT-MACHINE)

- H1: the settler settles what raw evidence decides, without the Kernel; an overdue settle is a
  `v_blocking` / `v_settle_overdue` row. H3/H5: try budget per unit, one unit per (op, subject, goal
  revision), no re-run of a passed unit without a reopen. H4: `retry_of` only to a failed try of the
  same unit. H6: the canon slice planner is mandatory (`scripts/kernel/canon-plan-gate.mjs`). H7: an
  unavailable checker is never red. H8: verdicts use the raw exit code. H9: archive keeps reported
  jobs; dispatch needs ready → leased and a running workflow. H10: reports and artifacts are
  immutable. H11: a stalled Kernel is replaced after 3 wakes without a move. H12: leases, incidents
  and running rows close through their owner and expiry. H13: an infrastructure dispatch failure does
  not spend a try. H14: a dead worker without a report is settled by the worker-health probe.
- MB-01: duty schedules persist in `schedules`. MB-02: a Supervisor Decision Item wakes the seat.
  MB-03: push refusals keep the full output as a blob and a stable signature. MB-04: the engine keeps
  its lease while draining; ensure never kills a draining engine. MB-05: a seat that refuses input 3
  times is replaced. MB-07: DI keys refuse empty parts. MB-10/12: a busy gate and a push-owed land are
  recorded outcomes. MB-11: the Telegram bridge survives an unreadable config. MB-13/14/16: GC matches
  ownerless terminals to lanes, retries after the grace window, records every outcome; test fixtures
  live under %TEMP%. MB-15: the throttle refuses a write from an older runtime rev.
- New SLA codes `TRANSCRIPT_MISSING`, `SEAT_DEAF`, `SETTLE_OVERDUE`.

**Reconciler, GC and the comeback**

- `gc:blob-sweep` (24 h): mark and sweep per ledger through `blob_ref_columns` into `gc_marks`, 24 h
  grace, archive before delete, retention 30 days for a passed attempt and 90 days otherwise (Q4).
  `host:transcripts` (60 s): scrollback snapshots of open attempts and seats.
- Housekeeping is the only purger of ended workflows: 30 days, zipped and verified first (Q6).
- `scripts/supervisor/comeback.mjs`: dry run by default; `--apply` refuses unless every workflow is
  stopped, every controller is in shadow and the engine holds no lease; zips and verifies every old
  store, deletes only verified paths, marks Work records with broken citations stale (Q12), creates
  the fresh databases and prints the relaunch list. It never touches `.starcistacks`, secrets or
  `~/.starci/prod.pw`. It has not been applied to live data.

**Docs, examples and hygiene**

- Rewritten: `docs/architecture.md`, `docs/ledger-db.md` (storage), `docs/supervisor.md`,
  `docs/workflow-kernel.md`, `docs/connectors.md`; new `docs/debugging.md` with the ten standard
  questions and their SQL, verified against the alpha.3 schema. CONTEXT, README, the entry skills and
  `init/AGENTS.md` name the ledger outside `.starciwork`.
- `.starcistacks` is the only stack root: the pre-rename `.stacks` root, `STACKS_LEGACY_ROOT` and
  `STACKS_DUAL_ROOT` are gone.
- The example trees cite their UAT runs and captures by sha256 (`work/evidence@1` `run` is a blob
  citation object); evidence whose record or code digest moved is marked stale with a reason.

**Known gaps in this release**

- The harness UI does not load: `ui/server.mjs`, `ui/supervisor.mjs` and `ui/reconciler.mjs` still
  import removed APIs (the Supervisor ledger helpers and the old reconciler state exports). The
  owner's Codex UI rewrite replaces them; `check-db-openers` keeps `ui/reconciler.mjs` pending.
- Specs are still red on fixtures seeded with the pre-alpha.3 schema (old `jobs.attempt`,
  `result_json`, `state_snapshots`, `checks`, the Supervisor ledger, workflows moved to `running`
  without a `lifecycle_changes` row). A full `npm test` run on main at `92680638d` (with `node_modules`) had 663 failing tests
  in 158 spec files, out of 2,637 tests. Most seed the pre-alpha.3 schema; a few assert shapes that
  alpha.3 changed (blob check output, cited layout captures). Files and failing-test counts:
  `admission` (2), `agent-exited-liveness` (4), `agent-trust` (2), `allocation-balance` (4), `api-status-perf` (3), `app-router-owned-paths` (2), `application-stacks-integration` (1), `artifact-subkind` (1), `ask-auto-accept` (7), `ask-kinds` (7), `assisted-uat-contracts` (1), `assisted-uat-runner` (1), `autopilot` (5), `benchmark-snapshot` (4), `canon-slice-wire` (1), `check-api-surface` (2), `check-host-boundary` (1), `check-op-manifest` (3), `check-orca-tree` (14), `check-starcistacks` (1), `codex-unattended-ops` (3), `config` (1), `connectors` (6), `contract-freeze` (4), `contract-rollout` (3), `cut-seam-stub` (7), `cut-set-integration` (2), `dead-worker-recovery` (12), `dead-worker-self-heal` (13), `decisions-doorbell` (1), `decisions-first` (1), `decisions-verb` (1), `devin-capacity-circuit` (2), `dispatch-handshake` (3), `dispatch-host-resources` (1), `dispatch-path-lease-wait` (4), `dispatch-prerequisites` (3), `dispatch-target-repo` (4), `display-names` (4), `draw-acceptance` (2), `draw-loop-dna` (1), `draw-owner-feedback` (5), `draw-real-components` (1), `draw-review` (11), `foundations` (4), `gate-attribution` (7), `gate-conditions` (14), `goal-entry` (3), `grammar-context` (1), `grammar-knowledge` (1), `greenfield-lockup` (1), `handover` (5), `harness-contract` (3), `heroui-alert-asset` (1), `implement-dead-worker-environment` (1), `input-draft` (3), `interface-audit-contract` (1), `job-settle-parity` (1), `json-exceptions` (1), `kernel-api` (22), `kernel-bridges` (7), `kernel-group` (1), `kernel-launch-readiness` (1), `kernel-observe` (5), `kernel-replace-close` (1), `kernel-runtime-rev` (3), `kernel-wake-delivery-proof` (10), `kernel-watchdog` (1), `launch-grace-liveness` (7), `layout-destinations` (2), `layout-tree` (3), `layout-tree-i18n-keys` (1), `lease-canonical-paths` (2), `leased-launch-abandoned` (4), `ledger-db` (13), `ledger-schema-parity` (2), `ledger-shape` (3), `liveness-busy-cards` (6), `managed-dispatch` (18), `managed-repos` (2), `model-scorecard` (2), `nudge-delivery-proof` (5), `op-ipc` (15), `op-ledger-boundary` (3), `op-params` (1), `op-work-paths` (3), `orca-host-outage` (14), `orca-run-rebind` (3), `orca-tasks-reconcile` (4), `orchestration-question-bridge` (5), `owner-answers` (5), `owner-claim` (2), `peer-messages` (7), `peer-wait` (16), `plan-edges` (1), `pool-slot-route-hold` (3), `prior-attempt-failures` (3), `product-worktree` (1), `progress-report` (1), `prompt-delivery-stalled` (4), `provider-health-recover` (4), `provision-unstick` (1), `push-gate` (3), `qwen-base-pool` (5), `qwen-loop-gate` (1), `reconciler-engine` (1), `reconciler-gc` (1), `reconciler-job` (9), `reconciler-pool-backoff` (1), `reconciler-sla` (1), `reconciler-worker-health` (1), `reconciler-workflow` (5), `route-lineage` (10), `route-model` (1), `runtime-tree-hygiene` (2), `safe-remove` (1), `schema-catalog` (2), `serve-ask-lifecycle` (7), `serve-ask-port-band` (2), `settle-landed` (10), `settle-next-step` (11), `settle-session-release` (5), `settle-target-repo` (6), `shared-checkout-guard` (1), `sonar-local` (2), `staged-input-liveness` (3), `stale-active-liveness` (3), `stale-active-unreachable` (6), `stale-input` (9), `stall-parked-frontier` (4), `start-workflow-restart` (2), `status-api-units` (1), `strategy-pools` (3), `supervisor-bridge` (5), `supervisor-gate-hold-wait` (3), `supervisor-kernel` (1), `supervisor-lessons` (1), `supervisor-owed` (12), `supervisor-owed-ack` (4), `supervisor-poll` (12), `supervisor-stall` (10), `telegram-bridge` (3), `telegram-media` (8), `terminal-create-recovery` (5), `terminal-dedupe` (2), `typed-logs` (3), `verdict-contract` (5), `verify-reliability` (7), `waiter-priority` (5), `work-debt-adopt` (3), `work-graph` (3), `work-graph-runtime` (3), `work-landed` (11), `work-peer-drift` (4), `work-record-schemas` (1), `worker-death-resilience` (1), `worker-question-inactive` (2), `workflow-archive` (4).
- A real reconciler pass (`engine.mjs --once`) takes about 2 min 40 s, longer than the 120 s cap of
  the `reconciler-engine` CLI spec.
- The Orca live paths are not yet exercised on the new schema: a live worker attesting to running,
  the dead-worker requeue on a real terminal, and transcript capture from a real terminal.
- The live owner `config.yaml` still carries the retired `quota.qwen` keys `planQuota`, `unit`,
  `calibratedRemainingPercent`, `calibratedAt`. WP10 removes them from the engine: `quota.qwen` accepts
  only `{resetAt}`, and the owner must delete the old keys from `config.yaml`.

## [1.0.0-alpha.2] — in preparation, base `f87a8f34b`

Theme: canonical files say one thing, once, in the present tense. Every rule lives in exactly
one place and every other surface cites it. Working notes are in `docs/fable.md`.

**Version line**

- `2.0.0` → `1.0.0-alpha.2`. The `v2.x`/`v6.x` git tags belong to the previous `@starci/skills`
  package, not to this runtime. `package.json` `version` is the only version authority.
- `CONTRIBUTING.md` carries the six rules that define the bar for a contract or prose edit.

**One authority per fact**

- `modules/kernel/api.yaml` is the verb surface: it names every verb `scripts/kernel/api.mjs`
  implements, and `bin/starci.mjs` and the docs cite it.
- Blocker kinds, report outcomes, effort vocabulary and job status each live in one place.
  `normalizeOwnedPath`, `readOwnerConfig` and the queued→running phase transition each have one
  implementation.
- `modules/models/runtimes.yaml` owns concurrency and the fleet's time windows; retry counts,
  watchdog cadence and observe interval are data there rather than prose repeated per file.
- `modules/schemas/index.yaml` catalogues every schema stamp, and
  `scripts/checks/check-schema-catalog.mjs` keeps it complete.

**Contracts tell the truth**

- Every documented refusal in the kernel contracts is one the code prints; the rest are removed.
- Every `citation:`/`enforcedBy:`/`source:` names a file and symbol that exist, enforced by
  `scripts/checks/check-contract-cites.mjs`; `scripts/checks/check-api-surface.mjs` holds the verb
  surface to the code.
- `modules/host/orca/calls.yaml` describes what the wrappers do today.
- `modules/kernel/dispatch.yaml` points at `modules/schemas/goal-plan.yaml` for the plan shape.

**The retired execution model is gone**

- Coordinator, matrix, cell, secondary-type and solo-mode vocabulary is removed from
  `modules/models/`, `modules/host/` and `modules/ops/_common.yaml`.
- `.json` ghosts (`registry.json`, `runtimes.json`, `config.json`, `goal-plan.json`) are gone from
  contracts, engine error strings and checks.

**Evidence and checks**

- `scripts/checks/check-evidence-binding.mjs` makes QUALITY-BAR §5 executable: a `done` claim needs
  an artifact that exists with a matching digest.
- `npm run check` (syntax, ops registry, host contract) plus `npm test` gate every push and PR;
  `ci.yml` runs them.
- Ten unreachable `scripts/api/orca/` wrappers, three `scripts/agent/` CLI shells and two orphan
  checks are deleted; the Orca test stub is shared and the landed-lane skip guards are gone.
- Generated example coverage trees are untracked.

**Examples**

- `todo-app-example.yml` runs the checks that exist; the committed age key is documented as a demo
  key that encrypts demo values only.

## [1.0.0-alpha.1] — 2026-09-22, snapshot at `614e67d55`

The tree is a clean open-source layout. Headline changes:

- **Architecture settled:** one long-lived `[Kernel]` LLM agent per workflow; all state mutation
  goes through `scripts/kernel/api.mjs` (`survey|status|plan|enqueue|dispatch|settle|incident|finish`);
  one ephemeral `[Op]` agent per job spawned via provider adapter cards.
- **State:** single sqlite ledger at `.starciwork/runtime.sqlite` (`engine/ledger-db.mjs` +
  `engine/schema.sql`/`machine.sql`).
- **Mechanism/data split:** mechanism code under `engine/`; contracts as YAML data under
  `modules/`; executables under `scripts/{goal,kernel,route,agent,api,context,checks,example,install}/`;
  provider facts (data only) under `providers/`.
- **Install:** `scripts/install/install.mjs` + thin `bin/starci.mjs`
  (`init|update|doctor|version|api|start|goal`). Installer seeds untracked `config.yaml` from
  `config.example.yaml`, writes the `AGENTS.md` bootstrap, and installs the `define-goal` /
  `start-kernel` entry skills into host skills directories.
- **Entry skills ship in the package:** `skills/define-goal/`, `skills/start-kernel/` — a fresh
  install has a lifecycle entry out of the box.
- **Dispatch hardening:** dispatch attests terminal + prompt + first model activity before marking
  a job `running`; settle closes the worker terminal; re-plans persist lineage in the ledger.
- **Packaging:** `files[]` is a source allowlist; `schemas/` is folded into `modules/schemas/`.
- **Docs:** README rewritten; CONTRIBUTING.md and this changelog added; `docs/` describes the
  current architecture.
