# Changelog

All notable changes to StarCi are documented here. The project is pre-publication on the
`1.0.0-alpha.N` line: contracts are provisional until every S* row in
`docs/goal.md` holds with fresh evidence, then `1.0.0` freezes them.
`package.json` `version` is the only version authority.

## [1.0.0-alpha.4] — TBD(release date), release commit `TBD(sha)`

Theme: a product is one app repository and a monorepo (hfs 4); the back end is a Nest monorepo of `be/apps/<app>` with seven feature kinds and bounded contexts; the event bus is Kafka only; every app builds
its own image; every action enters through one `starci <group> <verb>` command and who may do what is decided by the caller's role from one policy table; every agent starts through `orchestration worker-start`
and a finished worker is closed completely; the runtime's own source is layered, single-sourced and checked at zero findings; the remote moves once per release, main and one annotated tag together, and CI runs
once, on that tag.

### Breaking
- One app repository per product (hfs 4, slot and rule manifests 2.0.0): one `package.json`, one lockfile, `hfs.json` of kind `app`, with `be/` and `fe/` sides. No alias, no backward compatibility.
- Every app is a monorepo, even with one service: npm workspaces `fe/apps/*` and `fe/packages/*`, turbo at the app root (pin 2.11.6), each fe app the workspace `@<project>/<app>`; the back end is a Nest monorepo of
  `be/apps/<app>` (R143-R146 `HFS_MONO_*`). `hfs lint --workspace` scopes the one lint to a workspace.
- One-off actions live in one be app, `be/apps/cli` (nest-commander, `*.cli.ts` commands, R147-R150); there is no migrate app and no argv flag in a service.
- The event bus is Kafka in KRaft mode only (no ZooKeeper, no Redpanda). One digest-pinned image, `apache/kafka:4.2.2@sha256:1213eb39...e09b69`, is shared by the ecommerce dev stack and `@starci/test-world` 1.2.0, which refuses anything else.
- `examples/ecommerce-app` is the main example (be identity, order, billing, cli; fe landing, app) and `examples/shape-slot` the small hfs-4 reference. The old one-service demo app is deleted and the `examples/starcistacks-services`
  fixtures moved under `tests/fixtures/starcistacks-services` (paths in `modules/kernel/retired-paths.yaml`).
- CI no longer runs on a branch push or a pull request: every workflow of the repository, its examples and the hfs app templates starts only on a release tag `v*` or by hand (R221). A scaffolded app inherits it.
- One `starci` command (CLI lane, `db3acdb15`). `@starci/cli` 1.0.0 owns the only `starci` bin and the grammar `starci <group> <verb>`: 28 groups and 228 verbs from one catalog (`modules/cli/commands`; the generated help, `docs/cli.md` and the
  shell completions, R198 `RT_CLI_CATALOG_DRIFT`, R199 `RT_CLI_VERB_PARITY`). The `hfs` bin, the `starci-test-stack` bin, `bin/starci.mjs` and every old spelling (`starci api <verb>`, `starci init|update|doctor|version|validate|check`,
  `starci start`, `starci goal`, `hfs <verb>`) are removed with no alias and exit 2 naming the replacement. R197 `RT_RETIRED_CLI_CALL` refuses a retired spelling anywhere in the tree, R200 `RT_CLI_APP_ONLY_TEMPLATES` limits the
  managed app templates to `starci app <verb>`, and R201 `CLI_ONLY_ENTRY` refuses a prompt, doc, skill, config, CI file, hook or task registration that reaches a runtime script directly. A scaffolded full app depends on `@starci/cli`, not `@starci/hfs`.

### Added
- App shape and kinds: seven be feature kinds with slots, templates and knowledge patterns (api, webhooks `BE_WEBHOOK_*`, realtime `BE_REALTIME_*`, jobs, saga, cli, domain), the event-bus facade with `events.json` emitted from typed event
  classes, saga and queue/jobs platform capabilities, bounded-context rules (tiers domain and projections, R154-R158), `hfs add` for each kind, microservice rules (R163-R168, a second-service reference: billing) and per-worker test-world namespaces.
- Images (R187-R191 `HFS_DOCKER_*`): `be/apps/<app>/Dockerfile` and `fe/apps/<app>/Dockerfile` per declared app, built from the app root; `.dockerignore` and `images.yml` (builds every image on the tag, never pushes) are managed by `hfs sync`; the managed
  scripts `docker:build:<app>` and `docker:build`; `hfs new image`; the scaffold writes the Dockerfiles; a Next app sets `output: "standalone"`.
- Coverage (COVERAGE lane, owner decision): coverage is per-file 100 on the LOGIC of `be/src/modules/**` only, derived once from the slot `coverage` field; jest thresholds, Sonar's coverage exclusions (its complement) and Codecov's project, patch and
  components (identity, order, billing, platform) are rendered from that one derivation; R203 `BE_FEATURE_THIN` (a feature holds no logic), R204 `HFS_COVERAGE_SCOPE_DRIFT`. Re-scanned, both examples read 100 overall.
- Runtime checks, each at zero findings with no allowlist, all inside `npm run check`. CORE: `RT_HELPER_NEAR_COPY`, `RT_HELPER_REDEFINED`, `RT_DUPLICATE_CODE`, `RT_EXPORT_UNUSED`, `RT_ENV_UNCATALOGUED`, `RT_ENV_READ_OUTSIDE_OWNER`,
  `RT_TEST_ENV_IN_PRODUCTION`, `RT_ENV_STALE_ENTRY`, `RT_CODE_UNCATALOGUED`, `RT_CODE_STALE`, `RT_CODE_MALFORMED`, `RT_CODE_SOLE_EMITTER`, `RT_SPEC_ASSERTS_SOURCE_TEXT`, `RT_SPEC_SKIP_UNEXPLAINED`, and R202 `CI_UPLOAD_NOT_SILENT`
  (a Codecov upload authenticates by OIDC, fails the job, is never gated on a secret). SMELL (R205-R211): `RT_DOC_NO_OWNER`, `RT_EXAMPLE_COUPLING`, `RT_RETIRED_NAME_LIVE`, `RT_PORT_RESTATED`, `RT_CONFIG_DEFAULT_TWICE`, `RT_VERSION_RESTATED`,
  `RT_SLOT_ID_SHAPE`, plus `GENERATED_UNTRACKED` (R121) and `ONE_ALLOWLIST` (every exception lives in `modules/kernel/allowlist.yaml`). TEST-SPEED: R226 `RT_SPEC_OVER_BUDGET` (advisory in this release) and R227 `RT_SYNTAX_INVALID`.
- Single source of truth: one model catalog `modules/models/registry.yaml` (models, prices, pools, targets); shared op input fragments in `modules/ops/_common.yaml`; the packages' runtime copies are generated, git-ignored and untracked;
  knowledge never restates the slot and rule manifests (R192-R196: `RT_GENERATED_BLOCK_STALE`, `RT_RULE_ID_UNKNOWN`, `RT_PROSE_PATH_NO_SLOT`, `RT_PROSE_RESTATES_SLOTS`); English-only source, Vietnamese matching data in `modules/goal/source-phrases.yaml`.
- Git governance (GOVERNANCE lane, [git governance](docs/git-governance.md) and [source process](docs/source-process.md)): R221 `CI_TRIGGERS_RELEASE_ONLY` (workflows start only on a `v*` tag or by hand; Codecov and Sonar upload only in the tag run; one concurrency
  group per ref), R222 `RELEASE_NOTES` (a release tag needs a finished CHANGELOG section), and `cutRelease` (`scripts/supervisor/release-cut.mjs`, the only push of main: an annotated `v*` tag whose message is this section, L4 run once with every skip reported and
  any infrastructure skip a failure, then one atomic push of main and the tag). The test ladder L0-L5, the rights by role and the three change paths are written down.
- Role rights (RIGHTS lane, `4266bf408`; R223 `RIGHTS_ROLE_DENIED`, R224 `RIGHTS_PROTECTED_ZONE`, R225 `RT_HOOK_SHAPE`): who may do what is decided by the caller's role, which the guard reads from the bound job guard, the seat guard or `STARCI_ROLE`
  (`release` only while the host lock is held live by role release), never from the command. ONE rule table, `modules/kernel/command-policy.yaml`, is read by the PreToolUse command guard and by the PATH shim entry `shimDecision`: an agent role runs only the
  read-only allowlist, the `starci` verbs its role may use and the file edits of its worktree; a raw git write (commit, push, tag, merge, rebase, worktree), npm install, publish or test run, docker, supabase, gh, schtasks, shutdown, an Orca mutation or an
  unknown program is refused with the `starci <group> <verb>` to use, and a whole-suite run is refused outside the release cut. The PROTECTED ZONE (`modules/kernel/protected-zone.yaml`: guard and rights, release cut and git hooks, CI triggers, test policy, host
  lock, permission settings) is closed to the supervisor self-upgrade role (an owner proposal instead), an op never writes the `.claude` runtime checkout, and the guard also reads Edit, Write, MultiEdit and NotebookEdit calls. The host lock is a runtime API
  (`scripts/machine/host-lock.mjs`: acquire, release, owner, stale-owner takeover by pid; the land and the release cut take it). App and `.claude` git hooks: pre-commit is L0 only; pre-push is the release gate (main and `v*` pass only with an annotated
  release tag on HEAD and the L4 record `<git common dir>/starci-release/<sha>.l4.json` that `starci release cut` writes; `refs/backup/*` pass; nothing else); a supervisor self-upgrade land keeps a revertable `refs/self-upgrade/<id>` ref.
- One CLI over the whole tree (CLI lane, `db3acdb15`): `starci git commit|sync|land|backup` (the commit message convention and trailers, rerere, a fast-forward land of LOCAL main after the land gate and the dependent specs, never a push),
  `starci test run --level` with `starci check|lint|typecheck run --level` (the bounded L1-L4 ladder; `starci test run --level L2 --against <ref>` is the land pre-verify), `starci npm ci|install`, `starci supabase`, `starci docker`, `starci worker start|read|list|stop|release|close`
  (`close` releases the worker, closes its terminal and proves the process tree is gone), `starci task register`, `starci harness start|stop|status|open` (the harness server starts in-process; the old `ui/start.mjs` entry is deleted) and `starci release cut|publish|check|images|app-installs|clean-test|sync-runtime`.
  Every heavy verb takes the one host lock through the shared verb lock. PATH wrapper shims for git, npm, npx, node, docker, supabase, gh and schtasks send every raw call through `starci guard raw`, so the one policy binds agents of every kind (a raw `git commit`
  in a shimmed terminal is refused while `starci git commit` commits); `starci runtime link` installs the launcher shim, the runtime record and the git hooks.
- Test budgets and speed (TEST-SPEED lane, `cd1ce26ff`): 36 spec files run faster with every test and every assertion kept (test counts and per-test assertion counts equal, and two logic mutations plus one wiring mutation red before and after each change),
  each by sharing a per-process fixture or a resident real-entry child, never by shortening a timeout: the scaffold e2e 530 s to 282 s, `hfs-cli` 742 s to 336 s (176 s in the last land), `kernel-api` 397 s to 69 s, `supervisor-kernel` 322 s to 190 s,
  `hfs-scaffold-app` 472 s to 333 s, `default-deny` 153 s to 8.5 s, `hfs-docker-rules` 153 s to 90 s, `managed-dispatch` 148 s to 80 s (measured serially on a loaded host). The flaky scaffold API case is fixed at its root (port 0 and the child's ready event).
  R226 `RT_SPEC_OVER_BUDGET` judges every spec duration in `modules/kernel/spec-durations.yaml` against the 60 s per-file budget; for this release it is an advisory INFO finding ranked by its excess, and the land target is 15 minutes
  ([source process](docs/source-process.md), Test budget). R227 `RT_SYNTAX_INVALID`: every tracked js file parses in-process, tests and packages included.
- Release plumbing: `release:check` (the one gate, never publishes) and `release:publish` (plan by default; the publish is a human step); a managed SWC native-binding cache for gate runs; Playwright 1.63.0 as a root devDependency; five behaviour specs
  (settle checkpoint, dispatch typed-log prompt and workflow-tree guard, kernel-prompt delivery, SLA clock states); the land gate selects specs by their imports and by the data trees they read; per-land `pre-verify` of the dependent specs.
- Orca and workers: workers start through `worker-start --spec`, output is read through `worker-read`, worker questions through the consuming `orchestration check`, and `worker_done` settles the Dispatch and Task; one Orca worktree per Kernel workflow with a
  mid-workflow rebase policy; an Orca-owned `[Worker]` staging checkout; a runtime-known worker depth limit. A finished worker is closed COMPLETELY through one path, `scripts/machine/worker-close.mjs`: worker-release, the terminal close, and a bounded proof that no
  process of that terminal's shell tree remains (membership by the inherited `ORCA_TERMINAL_HANDLE`, never by name; a proven survivor is stopped by pid and raises `worker-process-survived`, which never changes the worker's outcome; an unverifiable host kills nothing).
  Found when a released cursor worker kept running for hours; live-proven on cursor and codex probe workers.
- Release row wiring (RELEASE-PREP lane, `fa14f0700`): a real `npm ci` in every example first; the Sonar proof through the existing local gate (scan against the project gate, then the dashboard; the local SonarQube stack is started by exact name when stopped and put back as found); and a last L4 step, `linux-parity`: the CI-equivalent light jobs derived from `.github/workflows` (installs, the full check set, package clean installs, per example codegen, typecheck, hfs lint and the builds; never a spec suite) run once in a Linux container on this host before the push, HEAD handed over as a read-only tar. A red step or no docker daemon fails L4 and blocks the cut. The spec run of L4 runs on the example installs with `STARCI_REQUIRE_APP_INSTALLS=1`, so a scaffold spec fails on a missing install instead of skipping; a lite example is planned without the test scripts it cannot hold; `starci release app-installs` scaffolds under the checkout (`ex-testing/`) and the scaffold spec refuses a `STARCI_APP_INSTALLS` outside it (an install elsewhere panics the Turbopack build); the app-installs proof scaffolds through `@starci/cli`, the only package with a `starci` bin.
- Browser journey: one Playwright journey per example (shop: browse, cart, checkout) under the optional `app.browser` slot, dispatch-only in CI.
- Other: `hfs secret list|show|set|gen` over sops and age; BE rules for cookie attributes, ambient ids and injected parameter names; R113 `FE_GRAPHQL_CONTRACT`; workflow worktrees and head-pinned verify judges; `@starci/test-world` 1.2.0 (Kafka KRaft, parallel world spec files).
- PENDING(LITE): the lite edition (`starci app scaffold --edition lite`, the lite example app `examples/lite-app`, rules R212-R220: `hfs.json` takes an `edition` of `full` or `lite`, the slot and rule manifests carry `editions` and the lite overlays, Supabase migration, RLS, definer, config and client-owner rules on a real PostgreSQL parser, `starci app upgrade --edition full`). Replace this line with the landed LITE text at the cut.

### Changed
- The runtime's own source follows the standard layering (api, lib, machine; checks enforce it; the layering allowlist is gone: R116 `RT_BASE_IMPURE`, `RT_TIER_DIRECTION`, `ARCH_OWNER_CYCLE`, `RT_API_SHAPE` at zero); `scripts/kernel/api.mjs` is `cli.mjs`; shared helpers moved to their owners.
- The `ecommerce-app` example meets the zero bar: eslint, hfs lint, tsc, stylelint 0; Sonar 0 bugs, smells, vulnerabilities, hotspots; services at 100 percent; real-stack integration, e2e and contract green.
- The Codecov upload authenticates with GitHub's OIDC token: no `CODECOV_TOKEN` secret exists or is needed.
- Vietnamese is confined to the declared `_vi` catalog fields; everything else is English.
- The app git hooks and the `.claude` hooks follow the gate model: pre-commit judges the staged files only (L0), the whole-app typecheck and the affected specs left the hook; the push is judged by the release gate.

### Removed
- The one-service demo app and the `examples/starcistacks-services` example files other than its template; the app kind `migrate` and the slot `be.feature.transport.cli`.
- The `hfs` bin, the `starci-test-stack` bin, `bin/starci.mjs`, `ui/start.mjs` and every pre-CLI command spelling (see Breaking).
- The name-matching agent-process reaper, `close-verify --tree` and the GC census (replaced by the one worker-close path); the advisory Devin per-worker model pin (Orca does not honour it).
- Fleet naming (renamed to workers), the `index.yaml` and `prices.yaml` model files, the source-language allowlist, and the per-example `ci.yml` path filters of the images workflow.

### Fixed
- CI was red on every push since 2026-10-01 and nobody noticed: the root `ci` workflow never installed `packages/` and `packages/test-world`; `grammar-package` lacked `@types/node`; the ecommerce journey waited on a done gap; and a clean-checkout full `npm test` showed five
  reds that only dependent-spec lands never ran (two sonar custody specs that assumed a named host checkout, the relatedExamples spec reading one catalog of three, the job-runner template differing from its example, the scaffold e2e building test-world with the wrong compiler).
- `hfs emit` and the hfs/canon packages import only files inside their own package; a Nest registration refusal keeps its wording; the managed `ci.yml` and `images.yml` are prettier-clean.
- A released cursor worker's agent process survived `worker-release` (see Added: the worker-close path).
- Main went red on the housekeeping temp-prefix spec and on the canon pins after two lands: the spec temp prefixes of the rights, policy and L4 specs are declared (`modules/models/runtimes.yaml`) and the canon digests are rebound (MAINFIX, `e398fa7d1`);
  no import links that meta spec to the specs that add temp prefixes, so the external land scripts now always add it to the selection.
- The spec fixtures of `@starci/eslint-canon-fe` tokens and `@starci/jest-preset` remove their temp directories (the temp-leak guard failed once their dependencies were installed).
- PENDING(LITE): the lite fixes of the cut: the managed `turbo.json` of both editions passes `SWC_NATIVE_BINDING_CACHE` through (`globalPassThroughEnv`), so a build through turbo honours the runtime-managed SWC cache; a scaffold depends on `@starci/cli`, the package that owns the `starci` bin its scripts call, with a spec that every bin a script calls has a provider.

### Published packages
Plan at main `cd1ce26ff` (`starci release publish`, plan only; re-run at the cut): `@starci/hfs` 4.0.9, `@starci/cli` 1.0.0 (new), `@starci/eslint-canon-be` 3.0.9, `@starci/eslint-canon-fe` 8.0.9, `@starci/jest-preset` 2.2.4, `@starci/prettier-config` 1.0.2,
`@starci/stylelint-canon` 2.0.4 and `@starci/test-world` 1.2.0 to publish (8, 0 blockers); `@starci/grammar` 0.8.2, `@starci/heroicons` 0.3.2 and `@starci/tsconfig` 2.0.2 are already on the registry. The example apps re-pin to the published
set and swap `@starci/hfs` for `@starci/cli` in the same step. TBD(publish date and shasums).

### Known limitations
Impossible from the runtime's side; the missing capability is named.
- Orca gates have no decider class, task-free form, claims, TTL or idempotency keys, so decision items stay runtime-side.
- Orca does not apply `--display-name` to a worker terminal title in an existing worktree, so `terminal rename` stays.
- Orca has no Run close or archive verb, no CLI for probe-repo removal, Run clearing or coordinator unbinding: the owner clears Runs in the Orca UI.
- Orca has no per-worktree provider config setting, so launch trust writes the provider files; no "all Runs" worker-list read from a Run-bound terminal, so lane-owner and drift reads are Run-scoped; and a worker that sent `worker_done` cannot be woken by a message.
- The `worker-start` receipt carries no `result.worker` (E4): the terminal comes from `worker-show` `dispatch.assigneeHandle`.
- Devin has no per-worker model pin (E7): `agent.model` is honoured only in the user config or `DEVIN_MODEL`; every Devin runs the default model.
- `worker-release` alone does not end every agent (a cursor worker survived it); the runtime's close path covers it, and Orca should end the agent on release.
- Codecov authenticates by OIDC: a product repository must be activated on codecov.io once (owner action per repository).
- The local gates run on Windows; Linux parity is a local run of the CI jobs before the push, not a CI result on the author's machine.
- The runtime package `starci` is not on the npm registry and this release does not publish it (a separate owner approval, [releasing](docs/releasing.md)): `starci runtime install`, which fetches `starci@1.0.0-alpha.4`, works only after that publication or from a reviewed archive; the eight `@starci/*` packages are what this release publishes.
- The release host's `%LOCALAPPDATA%\swc` inherits an app-sandbox ACL that `@swc/core` refuses; the runtime-managed builds set `SWC_NATIVE_BINDING_CACHE` instead, and repairing the ACL is an owner action on the host.

Left in the runtime, planned for 1.0.0-alpha.5:
- R226 `RT_SPEC_OVER_BUDGET` is advisory in this release: 15 of the 40 recorded spec files are still over the 60 s budget (the heaviest: `hfs-cli` 336 s, `hfs-scaffold-app` 333 s, the scaffold e2e 282 s, `supervisor-kernel` 190 s); it turns blocking in alpha.5 after they are sped up.
- `modules/kernel/spec-durations.yaml` is seeded from serial proof runs, not refreshed from the land pre-verify: the pre-verify log carries no per-file duration, so refreshing it needs a file-aware reporter.
- 20 node-script spellings remain outside the retired-call mapping data (the mapping data, its generated docs and the specs that assert it carry the rest): in `examples/ecommerce-app` (4), `examples/shape-slot` (1), `modules/kernel` (8: seven contract-change histories and one failure-code text),
  `packages/grammar` (2), `packages/hfs` (1), `packages/fe-kit` (1), `modules/reconciler` (1), `benchmark` (1) and the `setCommand` text of `scripts/lib/sops-envelope.mjs` (1). R201 allows them today; they are converted in alpha.5.
- `node --test` with no file list runs every spec, so a selection that came out empty runs the whole suite (it happened twice during the release work). `starci test` and `starci git land` must refuse an empty selection explicitly; until then no raw `node --test` without files.
- The repo-wide housekeeping meta spec is added to every land by the external land scripts; declaring such meta specs in data (an `always` list in the spec selection) inside `starci git land` is planned.
- The host lock has no queue: whoever retries first wins, so heavy-run windows were ordered by hand. A FIFO with the land order as priority is planned.
- The example apps (`ecommerce-app`, `shape-slot`, `lite-app`) were developed against `@starci/hfs` and are re-pinned to the published `@starci/cli` 1.0.0 only at this cut; no example ran against the registry packages before the cut's L4.

### Evidence
Lands on local main, in order (fast-forwards; each land ran the land gate, the full `npm run check` and only the specs the change reached): SHAPE `7e4d9f862` (334 dependent specs 2702/2712), EX-KINDS and DOCKER `c91f149b4`, SHAPE knowledge `c6ec7d2c3` (348 files 2834/2840),
CORE `953515729` (278 files 2339/2343, 0 fail; the first land refused on 10 reds fixed at the root), COVERAGE `1d3939613` (375 files 3069/3075), CI-FIX and the release fix `5bfae6a10` (clean-checkout `npm test` 3741 tests, 0 fail), SMELL `021eb80e0`,
GOVERNANCE `383ea6048` (694 of 700 over 54 files, the one red a parallel-run race, 12/12 alone), RIGHTS `4266bf408` (321 files 2655/2674; 12 reds explained and green on their re-run), RELEASE-PREP `fa14f0700` (2183/2184, the red fixed; delta 13 files 164/164),
MAINFIX `e398fa7d1` (22 files 204/204), CLI `db3acdb15` (first L2 run 4723 tests over 659 files, every red fixed; delta 131 files 1094/1102, the one red file 60/60 on its serial run), TEST-SPEED `cd1ce26ff` (116 files 1137/1139, 0 fail, check 38/38);
PENDING(LITE) lands last. TBD(L4 logs, including the linux-parity log and the left-out steps, and the measured test and CI reduction), TBD(CI run URL of the tag), TBD(published package shasums).

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
