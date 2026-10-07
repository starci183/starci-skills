# Changelog

All notable changes to StarCi are documented here. The runtime is on the `1.0.0-alpha.N` line: contracts are provisional
until every S* row in `docs/goal.md` holds with fresh evidence, then `1.0.0` freezes them.
`package.json` `version` is the only version authority.

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
- `modules/kernel/op-incident-policy.yaml`: one policy table for every hold on a job, seat or workflow, with a matrix of hold kinds against eight invariants. A launch refusal, quota or readiness failure demotes then excludes that agent for the job so the next chain member takes it; a job with every member spent opens one job-scoped escalation; a running worker's rate limit waits or is replaced by the reset time; an overdue Supervisor Decision Item climbs to the owner.
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
- SonarCloud findings from 5,701 to 59 code smells and 2 bugs open at this release.

### Known limitations
- SonarCloud is not at zero: 59 code smells and 2 bugs are open; a fix branch exists and is unverified.
- Two specs (`dead-worker-self-heal`, `gate-conditions`) failed once under load in the full Windows run and pass alone; the cause is not established.
- `supervisor-gate` holds are not yet in the escalation ladder (no re-evaluated condition, no workaround-first rule, no owner step).
- The incident policy has run against specs and ledger fixtures only, not through a full real workflow.
- The machine store keeps the unused `models.share_pct` column so an existing store still opens.
- Kernel-initiated Codex launches still fail on a launch-trust probe that inherits the seat's guard identity.

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
