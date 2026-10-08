# Changelog

All notable changes to StarCi are documented here. The runtime is on the `1.0.0-alpha.N` line: contracts are provisional
until every S* row in `docs/goal.md` holds with fresh evidence, then `1.0.0` freezes them.
`package.json` `version` is the only version authority.

## [1.0.0-alpha.7] — 2026-10-08

Theme: the roles are one declared contract, the system recovers from a host restart by itself, no smell or bug enters at commit, and the remote main moves only with a release proven on the exact commit that is pushed.

### Changed
- The packages of this release are versioned by what changed: `@starci/eslint-canon-be` 3.1.0 and `@starci/eslint-canon-fe` 8.1.0 (the new enforced law `SCAN_SMELL` R235; the front-end canon depends on `@typescript-eslint/eslint-plugin`), `@starci/hfs` 4.1.0 (templates, the platform sequence primitive, scaffold and sync), `@starci/cli` 1.1.0 (depends on hfs 4.1.0), `@starci/stylelint-canon` 2.0.6 and `@starci/jest-preset` 2.2.6. `starci release publish` plan mode names every package row and every blocker in its text and in the json `data.plan`.
- The SonarCloud organization is configuration, not a secret: `config.yaml` `sonar: {organization: <key>}` (the env `SONAR_ORGANIZATION` wins; `config.example.yaml` documents the empty default), no longer a line of `secret.env`. An example's `runtimeSecrets` is `[SONAR_TOKEN]` only (`STACKS_EXAMPLE_FORM` refuses the organization there), the env catalog lists `SONAR_ORGANIZATION` as `config`, and the pre-cut check names the config key when the organization is unset.
- The runtime repository tracks no secret: the example apps are analysed on SonarCloud (declaration `provider: sonarcloud`, `mode: hosted`, `runtimeSecrets: [SONAR_TOKEN]`, project keys `starci-example-<name>`) and no longer use the self-hosted `ext/sonar`, which serves product repositories only; their sealed tokens and `ext/sonar/secrets/KEYS.md` are deleted; `STACKS_EXAMPLE_FORM` / `STACKS_PRODUCT_FORM` refuse each declaration form for the other kind, `RT_SECRET_TRACKED` refuses any tracked `*.enc`, `secret.env` or `.env` outside `ruleParams.runtime.heldSecrets` (the stack members of `ext/sonar` and the ecommerce demo secrets, still held), and `secret.env.example` lists the `secret` names of `modules/schemas/env.yaml` (`SONAR_ORGANIZATION` is new). A ciphertext already in git history stays there until its secret is rotated.
- A push of the runtime repository's `main` is a release. The installed pre-push hook (`scripts/guards/release-push-gate.mjs`) refuses a push of `main` or of a `v*` tag unless the pushed commit is a release commit (`scripts/guards/release-definition.mjs`, the same code `starci release cut` runs): `package.json` `version` differs from the remote main's, an annotated tag `v<version>` sits on the commit, `CHANGELOG.md` has a dated heading for that version with no unfinished mark, and the release record of exactly that commit holds a green full root suite, packages suites and checks. The refusal names what is missing and the command that produces it; there is no bypass switch. Any other ref is left alone.
- A land fast-forwards local main and never pushes. `supervisor.landGate.push` and `starci supervisor land --no-push` are removed and refused by name, the land records no push row and opens no push-owed decision, and `supervisor push` and `push-mains` skip the runtime repository (product repositories are pushed as before). Publication is the release flow's job.
- The release cut runs the packages suites (`npm run test:packages`) as a row of its L4 plan and records them by sha; it refuses before the suite when the version has not moved past the remote main's or the CHANGELOG heading is undated.
- The quota check treats a provider window with no use and no reset time yet as valid, not as an unstarted-window failure.
- Spawn reconciliation moved from `workers.mjs` into `spawn-reconcile.mjs`.
- Roles are one contract (`modules/kernel/roles.yaml`): eight principles, the runtime floor, the reporting chain Op → Kernel → Supervisor → owner, and per role its scope, job, cleanup duty and what it never does. Seat and op prompts carry role blocks generated from it (`roles-contract` check, R232).
- The Supervisor no longer changes the runtime: it runs no fix workers (`supervisor.workers` accepts 0, the shipped default), and the guard refuses its lands and writes in the runtime checkout (`RUNTIME_CHANGE_OWNED_BY_DEBUG`). It rules on gates, resolves conflicts between workflows, divides shared resources and records runtime defects.
- Debug is a time-boxed auditor of role conformance, a loop of the owner's chat: a role's wrong is recorded as role, broken duty and evidence and remedied by a change in the runtime with a spec; a blocked Op that reported with its cause is a correct error, not a departure. The Supervisor fix-lane instructions still present in its prompt text are refused by the guard and are retired in the next release.
- An Op reports only to its Kernel: `starci supervisor tell` and `channel` refuse an Op (`OP_REPORTS_TO_KERNEL`).
- `work.author` stands behind `business.decide`, `architecture.decide` and `interface.draw` in new and stored plans.
- `ask-tunnel` is a required host row only when the Telegram connector is enabled.

### Added
- `starci release notes --tag <v*>`: prints or writes the CHANGELOG section of a release tag; the `github-release` job of `ci.yml` creates the GitHub Release from it on a pushed `v*` tag (a pre-release when the version has a pre-release part).
- `starci release cut --plan`: reports what the cut would run and require on this commit, and runs, tags and pushes nothing.
- The `sonar-rules` self-check: Sonar's rules enforced locally (also at commit time on the staged files), with an empty baseline; own code is held to its own rules.
- Checks: `removed-vocabulary` (removed spellings are refused in every instruction), `prose-commands` (every `starci` command an instruction shows exists in the CLI catalog, R230) and `documented-defaults` (a documented default cites its key and equals the value the code reads, R231); the validators read one key tree.
- The edge-case registry (`modules/reconciler/edge-cases.yaml`): every edge case met, with its occurrence, the rule and spec that cover it, or `open` with the reason.
- Restart recovery: a host restart releases the provider receipts its launches left (`dispatch-ended`, `host-restarted` proofs), fails a `spawning` job the restart ended, re-arms parked work-queue keys at engine start, and settles the custody a dead tunnel owed.
- Hold kinds `failed-no-step`, `owner-wait-no-ask`, `reported-unsettled` and `orphaned-frontier`: a job that ended with nothing after it gets its route step from the Job controller, or a Decision Item for the Kernel.
- An expired provider login is named in the refusal, a `login:<provider>` host row and the hold policy (`provider-login-expired`).

### Fixed
- The three example apps reached the release with 46 SonarCloud code smells although every row before the scan was green. The smells are fixed in the code and in the templates that render it (the sequence primitive `eachInOrder` replaces every `await` in a loop, the cli group returns its promise, the locale is read through `next/root-params`, and the regex, ternary, `void`, unused import, unused prop and `String.raw` findings go), and they cannot return silently: both lint canons publish the law `SCAN_SMELL` (R235, `no-await-in-loop`, `prefer-code-point`, `prefer-string-raw`, `no-nested-conditional`, `no-void-operator`, `no-unused-import`, `prefer-export-from`, `no-unused-prop-types`, plus typescript-eslint `no-deprecated`, `no-base-to-string` and `require-await`), and the `sonar-rules` self-check judges the TypeScript each example scans.
- The three L4 Sonar rows could never pass: the proof polled the public tunnel host of `secret.env` (stopped) instead of the server it started, nothing wrote the lint report the scan imports, a keep-alive socket pooled before the synchronous lint step was reset, and an analysis token cannot read the per-file coverage the dashboard needs. The proof now scans SonarCloud with the runtime's one `SONAR_TOKEN` (a user token, so the dashboard reads work), writes the lint report first, opens a connection per request, creates a missing project, analyses the branch `release-proof` once a project exists, and `starci release cut` (also `--plan`) refuses in seconds when `SONAR_TOKEN` or `SONAR_ORGANIZATION` is absent, the token or organization is rejected, or SonarCloud is unreachable.
- The worktree GC read no owner at all: its ledger lookup used a handle member that does not exist, so every workflow was "owner-unknown" and a running or paused workflow's tree was collected once Orca listed no terminal in it (after a host restart). The lookup now reads the ledger phase, and an unreadable ledger keeps the tree.
- A workflow keeps its branch: a replacement tree is cut at the workflow branch (or its preserved ref) and the preserved uncommitted work is restored, never cut from main; a registered tree behind the branch is moved onto it at the next `starci workflow start` or with `starci workflow custody --apply`; refs off one history are refused `workflow-custody-diverged`.
- Five red specs and 17 findings left by the alpha.6 cleanup.
- SonarCloud findings of the code-smell baseline are fixed in code (default sort comparators, optional chains, array callbacks, awaited loops through the in-order helpers).
- After a host restart no seat could launch: an unconfirmable release of a Dispatch from the previous Orca runtime kept a proven-gone Kernel terminal `unclosed`; ten Codex receipts in `unknown` state filled the pool for good; a Claude window with no use yet was judged invalid.
- `starci reconciler up --services` reported a failed connector start without its reason.
- A whitespace normaliser in the gate re-raise check collapsed the letter `s` instead of whitespace.
- The published canon packages lacked `config.example.yaml`, which their bundled engine reads.
- The `starci` skill's goal reference taught the removed routing-bias field.
- The repository's `package.json` carried a `pretest` hook the release cut refuses; the hook is gone (the spec preload already regenerates the runtime copies) and a spec binds the real test script the way the cut does.
- A spec run no longer reads the checkout's own `config.yaml` (`roots.temp`, `supervisor.landGate`, launch trust): the owner's live file made the temp-root, registry-isolation, land-gate and checkpoint specs differ between a lane clone and the release host. A spec run sees an owner config only from under the spec's temp directory (the spec preload sets STARCI_OWNER_CONFIG_WITHIN).
- The release cut found its L4 row red on a host the plain suite passed on. The causes are fixed at their roots: the `release notes` verb is named by the command policy; a stale `packages/test-world/dist` (now built by L4 and refused by the spec that borrows it); the JSON inventory scanning a spec's scratch app beside a settle spec; the op-worktree history hook switching itself off on a git before 2.46 (`rev-parse --show-ref-format` echoes the flag); `GIT_INTERNAL_SUPER_PREFIX` missing from the git local-env list; the Linux parity container's old git (`node:<major>-trixie`) and its one-level checkout path.
- `starci release cut` (and `--plan`) refuses `release-host` at once when the host lacks an Orca terminal, a reachable Orca or a Docker daemon, instead of failing an hour into L4; `starci release env-test` (`npm run test:release-env`) runs the suite under the cut's conditions in everyday verification.
- The example apps failed 16 rows of the L4 plan. Examples: each held a hand-added `.starcistacks/.npmignore` that `starci app lint` refuses; the lite example named the full quality gate; the ecommerce landing and app read the shop and service origins as module constants, which Next evaluates while it collects page data, so their image builds died on the missing `.starcistacks` projection (now read when a request needs them).
- Image templates: a Next image copied `fe/apps/<app>/public`, a folder the scaffold never writes (the build stage now creates it), and the images of a lite back end did not copy the `supabase/types` its sources import.
- `starci app check` judged an app nested in a larger repository (every example) against an empty base: the migration immutability read used a repository-top path next to a working-folder listing and reported every untouched migration as edited.
- The L4 plan demanded the `test:contract`, `test:integration`, `test:e2e` and `typecheck:tests` rows of a full app that holds no spec file in that layer (the scaffold has the scripts and the tests tsconfig only). A row now exists for each layer that holds a spec file, and `release cut --plan` lists the others as `notPlanned` with the reason. Every example script step also runs with the SWC cache of `build-env.mjs`: `@swc/core` refused its native binding under the host's cache ancestor ACL and every `build:fe` failed on `next.config.ts`.
- `@starci/jest-preset` matched a layer's spec files with a pattern prefixed by the root path; on Windows a root with a dot-named folder (the runtime checkout is `.claude`) turned the separator into a glob escape and `test:contract`, `test:integration` and `test:e2e` found no file.
- `npm run check` now runs `example-render`: every example is judged by the runtime's own HFS (its tree and every managed file against the renderer of this checkout, no app install), so an example can no longer fall behind a renderer, template or canon change unseen until the release cut.
- The `json-exceptions` check read the turbo task cache (`.turbo/cache/*.json`) that an example build leaves in the checkout as authored JSON, so `npm run check` failed in the checkout after the L4 example builds; `.turbo` is build output like `.next`.
- Two specs of the scaffold read stale state: the app scaffold spec expected the CLI pin `1.0.0` where the package is `1.0.1` (it now reads the pin from `packages/cli`), and the scaffold end-to-end spec used a `packages/test-world/dist` left by an earlier checkout (it builds the package from the checked-out source each run).
- The last line of `starci runtime check` states the whole verdict (`check: ok — runtime HFS clean; self-checks 45 of 45` or `check: FAILED — runtime HFS 2 finding(s); self-checks 44 of 45 (failed: env)`): a failed runtime HFS stage was hidden behind an all-green self-check count.
- The spec-run confinement of the owner `config.yaml` is a generic engine variable (`STARCI_OWNER_CONFIG_WITHIN`, set by the spec preload to the spec's temp root); the engine no longer imports the scripts tier for it.
- The npm tarball ships no sealed example credential: npm reads an app's own ignore file instead of the root `files` negations, so each example app carries a `.npmignore` naming its `.starcistacks/<env>/secrets` folders (an optional `.npmignore` joins the `app.tool-config-optional` slot), and a spec holds the tarball free of them.

### Known limitations
- SonarCloud has not scanned this commit; the local `sonar-rules` gate reproduces 16 of the 17 findings of the previous scan and misses optional chains that need type information.
- The operating standard, the debug questions and the digest's per-role conformance verdicts are designed, not built; 17 edge-case registry entries are `open`.
- Both real workflows stop at `brand.decide`: the draw render path in a fresh worktree and the brand-token contract are open; per-op token cost (6 to 17 million tokens for a decision leg) is unmeasured against the declared budget.
- An Op can still address any terminal through the shared Orca `orchestration send` allowance.
- The Codex loop syntax in the debug reference is unverified.
- The packages `@starci/hfs`, `@starci/cli`, `@starci/eslint-canon-be`, `@starci/eslint-canon-fe`, `@starci/stylelint-canon` and `@starci/jest-preset` differ from their registry versions at the same number, and each example installs the registry copy: the L4 example rows (lint above all) pass only after `starci release publish --publish` has republished them at bumped versions and re-pinned the examples. The cut does not read the publish plan before it starts the L4 run.
- The machine store keeps the unused `models.share_pct` column so an existing store still opens.

## [1.0.0-alpha.6] — 2026-10-08

Theme: the first two real workflows run end to end through their first gates; model picking moves to capability tiers; every hold on a job gets one declared policy.

### Changed
- Model picking is by capability tier and ordered chain (`modules/models/tiers.yaml`: `frontier`, `high`, `medium`, `low`, and the call-only `imagegen`), one picker for every seat and op: hard filter, owner bias, keep a live seat, balance, then chain order by tokens. Provider pools, shares, `kernel.group`, `models.pools` and the `require` bias are removed and refused by name; the bias key is `only`.
- Image generation is a headless call (`starci work imagegen`), not a seat: drawing ops run on their difficulty tier and call it for raster regions.
- Workflow debug is a loop of the calling chat (`starci debug digest`, read-only); the Orca core-debug seat, `debug pass`, the `--caller-*` flags and the `coreDebug`/`debug` config keys are removed and refused by name. The Codex loop syntax in the skill reference is unverified.
- `/starci` checks the runtime on every invocation.
- The land gate holds the host lock only around the publish step and verifies the tree it lands; its spec selection is bounded.
- The Codex command guard is registered in the Codex home a worker starts in (the owner's `~/.codex` and Orca's managed home), not in the worktree's project layer, which Codex ignores in a linked worktree.

### Added
- `modules/kernel/op-incident-policy.yaml`: one policy table for every hold on a job, seat or workflow, with a matrix of hold kinds against eight invariants. A launch refusal, quota or readiness failure demotes then excludes that agent for the job so the next chain member takes it; a job with every member spent opens one job-scoped escalation; a running worker's rate limit waits or is replaced by the reset time; an overdue Supervisor Decision Item climbs to the owner. A `supervisor-gate` needs a typed cause and a tried workaround (or a typed reason none exists), carries a machine-checked release condition where its cause allows, enters the same ladder, and takes one of three Supervisor resolutions: `fixed`, `workaround`, `not-runtime-fault`.
- `roots.temp` and `resources.{minFreeDiskGb,minFreeDiskPct,minFreeRamPct}` in `config.yaml`: the runtime temp root and the host floors are the owner's to set.
- A generic retry budget (`scripts/lib/retry-budget.mjs`) for the reconciler work queue, stale terminals and the host lock; a provider-reservation reaper; a leftover-worker sweep.
- Host rows `command guard resolvable`, `drift-modes` and `drift-rev`; `reconciler status` leads with a `DRIFT:` line.
- Checks: `undeclared-identifiers`; the failure-code catalogue covers the new refusals.

### Fixed
- The command guard hook resolved through the per-user launcher on PATH, which bash does not find as `starci.cmd`, so every guarded Bash call of a Windows seat ran unguarded behind a non-blocking hook error. The hook command now names the launcher by absolute path, `starci runtime install` and `runtime link` write an extensionless POSIX launcher beside `starci.cmd`, launch trust refuses a launch whose guard command no shell can run (`guard-command-unresolvable`), and the host check has a required row `command guard resolvable`.
- An autopilot budget gate held every job of a workflow whenever a finished attempt was not yet metered, and nothing released it; only an exceeded cap raises it now and the runtime releases it when its condition is gone.
- A Kernel waiting on a named machine condition was replaced as idle; an unattended Kernel restart had no sender terminal and retried forever; a failed Kernel launch left a `launch-unknown` signal no later start could reconcile; a disconnected terminal with no tagged process could not be proven closed.
- An op that had read its knowledge was settled failed for a READ proof nothing produced; a job's checks were re-run in the main checkout instead of its workflow worktree; `status` showed a superseded red as the reason.
- The reconciler engine recorded an unreadable `config.yaml` as every controller `off` and could not reload onto a new revision; it keeps its last good modes, reloads without reading the new config through old code, and reports drift.
- Kernel and Supervisor token usage was not metered behind the Orca worker preamble.
- Linux: the Windows launcher path, file-time rounding, temp-root and path-key assumptions in specs; `starci kernel route` dropped the per-member rejections when every member was refused.
- SonarCloud findings: from 5,701 code smells down to 59 smells and 2 bugs on the last scan, each of which this release addresses in code.

### Known limitations
- SonarCloud was at 59 code smells and 2 bugs on the last scan; this release changes the code for every one of them, and no scan has confirmed the count yet.
- Two specs (`dead-worker-self-heal`, `gate-conditions`) failed once under load in a full Windows run and pass alone; the cause is not established. The full suite has not been run on the exact released commit: its lanes were run separately.
- The incident policy has run against specs and ledger fixtures only, not through a full real workflow.
- The machine store keeps the unused `models.share_pct` column so an existing store still opens.
- The Codex launch-trust probe runs without the seat identity and the seat's guard shim, which is what refused Kernel-initiated Codex launches; specs cover it and no real Kernel-initiated Codex launch has confirmed it.

## [1.0.0-alpha.5] — 2026-10-06

Theme: host prompts move under the public entry, host state lives under the runtime root, and the runtime gains artifact, install-sandbox and Sonar proof.

### Changed
- The host startup and maintenance prompts live at `skills/starci/references/host-startup.md` and `host-maintenance.md`; the `.starci/` source directory is gone.
- Host state and artifacts live under `<runtime root>/.runtime`, which is git-ignored and never packaged; nothing is relocated from earlier per-user locations.
- The machine store has one schema and no upgrade path: a store that is not the current schema is refused unchanged.
- The entry check validates the bootstrap files of the hosts an install selected.
- The runtime repository's CI runs on every push to `main` as well as on `v*` tags and by hand (static checks, coverage, Codecov, and the SonarCloud scan on `main`), the runtime artifact is built on every main push, and a fast-forward push of `main` needs no release tag; rule R221 allows the `main` push in the runtime's own workflows only, and app CI templates keep the tag-only law.

### Added
- A `runtime-artifact` workflow (manual dispatch) packs the runtime with version, SHA and hash metadata plus an inventory, and refuses host-local or secret material.
- An `install-sandbox` workflow and `scripts/gates/install-sandbox.mjs` prove a clean-machine install on Windows and Linux.
- Runtime coverage (`npm run test:coverage`, Codecov flag `runtime`, informational) and a SonarCloud analysis of the runtime in the tag run.
- A packed-import guard in the runtime package proof.

### Fixed
- SonarCloud bug and vulnerability findings across `engine/`, `scripts/`, `ui/` and `packages/`: explicit code-unit sort comparators, regexes without catastrophic backtracking, secret redaction in the assisted-UAT runner, a quiet-since fallback in progress RCA, tightened file modes, GitHub Actions pinned by commit SHA and `npm ci --ignore-scripts` in workflows.
- The packed runtime no longer imports modules absent from the package.
- The installer names a missing or unsupported `age-keygen`.

### Known limitations
- Sonar, Linux parity, the L3 and L4 ladders, UAT and the full unit and e2e suites did not run for this release; only targeted specs and checks did.
- The two product workflows are not yet proven running; `1.0.0` waits for that proof.
