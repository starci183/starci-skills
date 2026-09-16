# Code pattern enforcement

`model/code-patterns.yaml` is the executable inventory for the fixed StarCi NestJS and Next.js code profiles. The authored manifest, not every rule exported by an installed lint package, decides which code obligations apply. Generated `.dist/model/code-patterns.json` is the runtime form.

## Public command and operation

Run `starci code-patterns check --profile nest --root <repository> --all` for a Nest
source repository; use `--profile next` for a Next repository. Add
`--architecture-config <repository-relative.json>` when the layout/public-owner
contract needs explicit binding. The single `bin/starci.mjs` entry forwards to
the sealed compiled checker; consumers do not need internal module paths.

The command prints one `starci/code-pattern-check@1` JSON report. Exit `0` means
complete clean declared coverage, `1` means measured findings, and `2` means
invalid or unavailable coverage. Explicit file arguments remain available after
`--`, but omitting an applicable file fails completeness rather than certifying a
partial sample. `review.verify` in `lint` mode invokes this aggregate plus the
selected Work/stack checks and any additional project checks. Finding an issue
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

Architecture obligations bind a `starci/architecture-check@1` result from `starci architecture check`. The code-pattern result records the architecture report digest, repository/source identity and required rule IDs. An absent, stale, invalid or non-clean report is uncovered coverage. Static dependency checks do not prove dependency-injection lifetime, authorization or behavior; the obligation's semantic companion states the remaining review.

### Script

Repository audits use a stable script rule ID and a typed result binding. A generic command exit code, a package script with the same name, or prose saying that a check ran is insufficient. Missing tools/configuration are unavailable coverage, not a pass.

## Coverage and remaining work

The manifest is the current implementation inventory; inspect each obligation's
status and actual result instead of treating this prose as a frozen count.
Explicit owner/public-entry and Grammar boundaries, Nest documentation/import
syntax, and the implemented Next syntax clauses have executable checks. Legacy
rules that contradict the adopted standard must be off while their replacement
obligations remain required. That migration does not waive an unimplemented
replacement.

Remaining `missing` or `conflict` obligations still block conformance. In
particular the conditional FE world-owner/render boundary, framework-specific
error/data lifecycles and remaining declared source/contract/test forms require
their exact implementations. Private Academy env/cache/default-export rules do
not become shared canon merely because their names occur in a local config.
This implementation queue does not authorize product rewrites or lint-package
publication.

## Evidence limits

A complete code-pattern result proves only the declared mechanical obligations over the recorded files and tool identities. Agents still review responsibility, cohesion, state/effect ownership and edge cases using `docs/architecture-rules.md`, `docs/portable-source-architecture.md` and `docs/backend-source-pattern.md`. Applicable typecheck, boot, contract, concurrency, recovery and rendered behavior evidence remains separate.
