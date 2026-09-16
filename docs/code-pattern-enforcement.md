# Code pattern enforcement

`model/code-patterns.yaml` is the executable inventory for the fixed StarCi NestJS and Next.js code profiles. The authored manifest, not every rule exported by an installed lint package, decides which code obligations apply. Generated `.dist/model/code-patterns.json` is the runtime form.

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

The Next adapter resolves declarations with the target-installed TypeScript compiler. `FE_RETURN_TYPE_PROFILE` distinguishes JSX or explicitly owned visual functions, symbol-bound React `memo`/`forwardRef` wrappers, hooks, async utilities and primitive helpers; capitalization alone never makes a component. `FE_CLOSED_VOCABULARY_SHAPE` binds checked state/mode/Grammar unions to exact inventories, follows unaliased public type re-exports, rejects presentation enums and checks boolean prop names. `FE_CONTRACT_NAME_SHAPE` resolves public type exports to one owner and one symbol instead of comparing text aliases.

A repository may declare the roles that syntax cannot supply at `package.json#starci.codePatterns.next`:

```json
{
  "schema": "starci/next-code-pattern-contract@1",
  "owners": [
    { "root": "src/features/authentication", "name": "Authentication" }
  ],
  "closedVocabularies": [
    {
      "path": "src/features/authentication/view-state.ts",
      "type": "AuthenticationPhase",
      "inventory": "AUTHENTICATION_MODES",
      "role": "mode"
    }
  ]
}
```

Every declared path must be normalized, in-repository, non-redirecting and covered by the exact selected source set. Duplicate identities, missing symbols, unresolved aliases and uncovered owner paths are unavailable coverage. The current direct adapter still needs one compatible owning TypeScript program for every selected source; project-aware monorepo selection remains a blocking integration item rather than an inferred pass.

## Current blocking gaps

The manifest deliberately remains non-green. The principal gaps are:

1. Same-source cross-owner public entries and export-star need `ARCH_OWNER_EXPORT_BYPASS` and `ARCH_OWNER_EXPORT_STAR` for both profiles.
2. The selected Grammar export/peer/style family needs `ARCH_GRAMMAR_EXPORT_BYPASS` and `ARCH_GRAMMAR_CONTRACT_INVALID`.
3. The conditional frontend world-owner/render boundary needs type-resolved coverage beyond the legacy block/name heuristic. Intrinsic browser state must stay valid.
4. Nest provider re-registration and selected handler/module registration need static coverage plus a separate boot test for real tokens and lifetime.
5. Both profiles retain syntax gaps in names, member comments, resolved inherited readonly shapes, tests and framework-specific data/error lifecycles, listed as `missing` obligations rather than manual review. Next monorepos also need exact per-source TypeScript project selection before the new resolved checks can certify portable coverage.
6. Legacy BE deep-import/no-folder-barrel rules conflict with explicit owner public entries. The legacy FE block-twin rule cannot certify the adopted conditional boundary. Private Academy rules for env/cache/default exports are not shared canon rules.

These gaps are an implementation queue for the owning checker/runtime work. They do not authorize product rewrites or lint-package publication.

## Evidence limits

A complete code-pattern result proves only the declared mechanical obligations over the recorded files and tool identities. Agents still review responsibility, cohesion, state/effect ownership and edge cases using `docs/architecture-rules.md`, `docs/portable-source-architecture.md` and `docs/backend-source-pattern.md`. Applicable typecheck, boot, contract, concurrency, recovery and rendered behavior evidence remains separate.
