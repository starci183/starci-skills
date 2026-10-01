# Code pattern enforcement

`modules/models/code-patterns.yaml` is the executable inventory for the fixed StarCi NestJS and Next.js code profiles. The authored manifest, not every rule exported by an installed lint package, decides which code obligations apply. Generated `modules/models/code-patterns.yaml` is the runtime form.

## Command and operation

The lint of a repository is `hfs lint` (the ESLint canon plus `hfs check`, one `starci/lint@1` report); a code-writing op
runs it over its changed files through `node scripts/gates/gate.mjs --root <app> --changed <files...>` (ops name it
`starci-gate`). The layout and public owners come from `hfs.json` and the slot manifest. The gate prints one
`starci/gate@1` JSON report: exit `0` clean, `1` findings new against the base, `2` a tool could not run.
`review.verify` in `lint` mode runs the whole-repository `hfs lint --format json` plus the selected Work/stack checks and
any additional project checks. The manifest `modules/models/code-patterns.yaml` is the rule inventory the check-hfs-rules
parity gate and canon-scan read. Finding an issue
settles only a measurement; repairing source and completing delivery retain their
own authority and evidence.

## Result contract

Each obligation has a stable ID, source knowledge rule IDs, path applicability, a mechanical requirement, its exact machine, and any remaining semantic review. `status` has only three values:

- `implemented`: the named machine exists. A pass still requires the exact target files, config and source revision to be checked cleanly.
- `missing`: the requirement is mechanical but its named checker is not implemented. Code-pattern conformance must fail.
- `conflict`: an available checker implements a different or obsolete rule. Code-pattern conformance must fail until the rule and manifest are repaired coherently.

`semanticOnly` is reserved for decisions that cannot be answered from syntax, resolved dependencies or repository metadata. It names the reason and guidance. A rule with any mechanically decidable clause remains in `obligations`; moving it to `semanticOnly` is not a waiver.

## Machine kinds

### ESLint

The checker loads the target-local canon package, verifies the exact package name, version and deterministic content digest, then resolves each manifest rule ID. The digest sorts included files by POSIX-relative path and hashes each UTF-8 path, a null byte, raw file bytes and another null byte in sequence; the manifest declares its include/exclude globs and expected file count. It computes the effective config for every expected production file. The obligation passes only when its exact severity/options apply, no expected file is missing or ignored, inline configuration is refused, every file produces an explicit result, and lint reports no warning, error or suppressed message. A repository-private rule cannot satisfy a canon ID.

The manifest may select a subset of a package's exported toolbox. An extra export is not automatically law. Conversely, an obligation does not disappear because the package recommendation omits or disables its rule.

### Architecture

Architecture obligations bind a `starci/architecture-check@1` result from `node scripts/hfs/architecture.mjs <app>/<side>` (`hfs check` runs it over `be/` and `fe/`). The code-pattern result records the architecture report digest, repository/source identity and required rule IDs. An absent, stale, invalid or non-clean report is uncovered coverage. Static dependency checks do not prove dependency-injection lifetime, authorization or behavior; the obligation's semantic companion states the remaining review.

There is no third machine kind: every obligation is judged by a canon rule or the architecture machine, or is not part
of the locked convention; `require-public-member-jsdoc` (R109), `replacement-throw-carries-cause` (R108) and
`props-fields-readonly` (R110) are canon rules at error.

## Coverage and remaining work

The manifest is the current implementation inventory; inspect each obligation's
status and actual result instead of treating this prose as a frozen count.
Installed rules that contradict the adopted standard must be off while their
replacement obligations remain required. That update does not waive an
unimplemented replacement. Private Academy rules do not become shared canon
merely because their names occur in a local config. This inventory does not
authorize product rewrites or lint-package publication.

The architecture adapters keep their guides beside this file:
[Nest contract and readonly boundary](nest-contract-check.md) and
[Next data lifecycle](next-data-lifecycle-check.md). The aggregate records
`frontendDataLifecycle` coverage independently of its rule IDs. A proven absence
of SWR is not applicable; selecting SWR without a supported contract is
unavailable.

## Evidence limits

A complete code-pattern result proves only the declared mechanical obligations over the recorded files and tool identities. Agents still review responsibility, cohesion, state/effect ownership and edge cases using `docs/architecture-rules.md`, `docs/portable-source-architecture.md` and `docs/backend-source-pattern.md`. Applicable typecheck, boot, contract, concurrency, recovery and rendered behavior evidence remains separate.
