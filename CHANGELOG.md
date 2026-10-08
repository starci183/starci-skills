# Changelog

All notable changes to StarCi are documented here. The runtime is on the `1.0.0-alpha.N` line: contracts are provisional
until every S* row in `docs/goal.md` holds with fresh evidence, then `1.0.0` freezes them.
`package.json` `version` is the only version authority.

## [1.0.0-alpha.8] — in preparation

### Fixed
- The prompt of a deciding or authoring op no longer lists the whole of `knowledge/`. The nine ops with the read-knowledge proof (architecture.decide, brand.decide, business.decide, decision.prepare, docs.author, knowledge.repair, scope.define, scope.finish, work.author) filed `knowledge/**` as their standard: 260 to 290 mandatory files and a 88 to 95 KB prompt that the worker read and carried in its context for every later turn (up to 13 percent of the 3 to 13 million tokens a decision leg cost in the real usage rows). Each now files the law inputs and the knowledge its own READ step names (19 to 45 files, a 21 to 28 KB prompt); `knowledge/op-gate.yaml` `readSet` bounds the file count and the prompt, and a spec holds it.
- A wake typed into a Kernel's input box is bounded by `allocation.wake.maxChars` (790): Claude Code folds a paste of about 800 characters or more into a `pasted_content` block that the model treats as untrusted. In the real Kernel transcripts every wake of 1218 characters or more arrived pasted and every wake of 730 or fewer arrived as the user's message. The transition, ask-answered, stall, supervisor and watchdog wakes now keep their opener, the runtime-rev sentence when it fits and the seat identity, and point at `starci kernel status` for the rest (`scripts/kernel/wake-bound.mjs`).
- The `TERMINAL_COUNT_DRIFT` clock counts only the tabs the runtime titled (`[Kernel]`, `[Op]`, `[Worker]`, `[Supervisor]`), not the owner's own terminals, and a violated clock runs the dedupe pass once per SLA window; before, it counted every Orca terminal, stayed open for twenty hours and named an auto-action nothing performed (`scripts/reconciler/terminal-drift.mjs`).

## [1.0.0-alpha.7] — 2026-10-08

Theme: the roles are one declared contract, the system recovers from a host restart by itself, no smell or bug enters at commit, and the remote main moves only with a release proven on the exact commit that is pushed.

### Changed
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

### Known limitations
- SonarCloud has not scanned this commit; the local `sonar-rules` gate reproduces 16 of the 17 findings of the previous scan and misses optional chains that need type information.
- The operating standard, the debug questions and the digest's per-role conformance verdicts are designed, not built; 17 edge-case registry entries are `open`.
- Both real workflows stop at `brand.decide`: the draw render path in a fresh worktree and the brand-token contract are open; per-op token cost (6 to 17 million tokens for a decision leg) is unmeasured against the declared budget.
- An Op can still address any terminal through the shared Orca `orchestration send` allowance.
- The Codex loop syntax in the debug reference is unverified.
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
