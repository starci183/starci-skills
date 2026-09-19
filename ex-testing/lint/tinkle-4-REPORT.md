# tinkle-4 ? completed: scripts/checks consolidation

Executed the owner-authorized move. The owner explicitly lifted the v11-5 wait gate in this task; no wait or fabricated v11-5 marker was needed.

## Result

- Moved 40 modules: 13 top-level scripts/check-*.mjs and all 27 modules formerly under checks/.
- Moved architecture/ (10 modules) and code-patterns/ (9 modules) as whole directories. The remaining 8 former checks/ root modules also moved.
- Removed the now-empty checks/ directory. No check-*.mjs remains directly in scripts/.
- Non-check build-*, compile-*, example-* and other scripts retain their original locations.
- Updated 140 source, test, configuration and documentation files. Existing unrelated source changes were preserved.

## Before/after gates

Commands were run from .claude, before moving files and again at their new paths. Full stdout/stderr is byte-for-byte identical for both gates.

| Gate | Before | After | Counts |
| --- | --- | --- | --- |
| node scripts/check-example-work.mjs ? node scripts/checks/check-example-work.mjs | exit 0 | exit 0 | 261 records; 3,138 references; 127 evidence files; 43 artifact payloads skipped |
| node scripts/check-example-yaml.mjs ? node scripts/checks/check-example-yaml.mjs | exit 0 | exit 0 | 856 YAML files accepted |

Work-gate findings before and after: 0 refused, 0 warned, 43 informational payload notices.

- [Baseline statuses](_tinkle4-baseline.json) and [after statuses with exact comparison](_tinkle4-after.json).
- [Work before](_tinkle4-check-example-work-before.txt) / [work after](_tinkle4-check-example-work-after.txt).
- [YAML before](_tinkle4-check-example-yaml-before.txt) / [YAML after](_tinkle4-check-example-yaml-after.txt).

## Import and path fixes

- Moved check entrypoints now resolve the skill root through ../.. and import core/kernel helpers at the new depth. Example helpers remain in scripts/ and are imported through ../example-*.mjs.
- Former checks/ modules import core helpers through ../../core/. stacks.mjs resolves both source YAML and compiled JSON schemas through ../../schemas/.
- check-scoped-lint.mjs resolves architecture helpers and its dynamic code-pattern adapter imports inside scripts/checks/.
- CLI dynamic imports, kernel proof/render/acceptance imports, the audit adapter and example capture/render helpers point at the new modules.
- kernel/audit.mjs recognizes direct check commands at the new paths and retains legacy command classification for existing recorded commands; compound commands remain rejected.
- scripts/runtime-modules.txt, package contents, CI commands/path filters, test fixture copies, runtime inventory assertions and split path.join calls use the new layout.
- Updated operator references, model declarations, schemas, knowledge, module context YAML, entry guidance, documentation, example READMEs and upgrade layout references.
- Workflow receipt directories named checks/ were retained: checks/<opId>.json is workflow data, not a source-module directory. Historical ex-testing reports and published example YAML evidence were preserved.
- Local sealed runtime copies and other worktrees were excluded from the final change. An over-broad initial scan touched 147 files there; every such file was restored from its exact pre-edit snapshot and verified byte-for-byte.

Complete moved/edited file inventory: [_tinkle4-migration.json](_tinkle4-migration.json). Original reference inventory: [_tinkle4-references-before.txt](_tinkle4-references-before.txt).

## Focused verification

- Parsed 105 moved/affected JavaScript modules with the Node module parser and resolved every static relative import: zero missing targets. [Import audit](_tinkle4-import-audit.json).
- Parsed all 21 changed YAML files; verified 40 destination files, zero stale source locations, and audit command recognition/rejection. [Final audit](_tinkle4-final-audit.json).
- Existing focused test suite: **212 tests, 210 passed, 2 skipped, 0 failed**. It covers example gates/derivation/critique, Work artifacts/consistency/history/replay/surfaces/change, stale-check CLI, stacks (including relocated compiled-schema fixture), brand, render, acceptance and protected proof. [Test log](_tinkle4-tests-focused.txt).
- git diff --check passed for affected tracked sources.

## Broader verification limits

The brief-required gates and focused checks pass. No claim of a complete runtime build or full repository suite is made.

- Normal runtime build fails before publication on an existing symlink under examples/ecommerce-app-be/node_modules/@ecommerce-app-be/identity. [Build log](_tinkle4-build.txt).
- A clean staging copy excluding installed dependencies gets further but the existing runtime inventory omits model/index.mjs, required by unchanged hosts/headless/host.mjs. This unrelated manifest omission also exists in the pre-move inventory. [Clean build log](_tinkle4-clean-build.txt). Neither attempt published .dist; its previously generated content remains unchanged.
- An expanded initial run had 210 passes, 2 skips and 6 failures: four test files lacked local TypeScript/Ajv dependencies; one compiled CLI test requires regenerated .dist; one old proof-path assertion was fixed and passes in the final focused run. [Expanded log](_tinkle4-tests.txt).
- A diagnostic architecture run using the example backend TypeScript through NODE_PATH reached 69 passes out of 71; one case lacked SWR and the global lookup altered the deliberate missing-TypeScript test. This diagnostic is not reported as a clean suite. [Diagnostic log](_tinkle4-tests-architecture.txt).

## Moved files

| Original | Destination |
| --- | --- |
| scripts/check-entry.mjs | scripts/checks/check-entry.mjs |
| scripts/check-example-derived.mjs | scripts/checks/check-example-derived.mjs |
| scripts/check-example-work.mjs | scripts/checks/check-example-work.mjs |
| scripts/check-example-yaml.mjs | scripts/checks/check-example-yaml.mjs |
| scripts/check-json-exceptions.mjs | scripts/checks/check-json-exceptions.mjs |
| scripts/check-scoped-lint.mjs | scripts/checks/check-scoped-lint.mjs |
| scripts/check-stales.mjs | scripts/checks/check-stales.mjs |
| scripts/check-work-artifacts.mjs | scripts/checks/check-work-artifacts.mjs |
| scripts/check-work-consistency.mjs | scripts/checks/check-work-consistency.mjs |
| scripts/check-work-deep.mjs | scripts/checks/check-work-deep.mjs |
| scripts/check-work-history.mjs | scripts/checks/check-work-history.mjs |
| scripts/check-work-replay.mjs | scripts/checks/check-work-replay.mjs |
| scripts/check-work-surfaces.mjs | scripts/checks/check-work-surfaces.mjs |
| checks/acceptance.mjs | scripts/checks/acceptance.mjs |
| checks/architecture/backend.mjs | scripts/checks/architecture/backend.mjs |
| checks/architecture/config.mjs | scripts/checks/architecture/config.mjs |
| checks/architecture/contracts.mjs | scripts/checks/architecture/contracts.mjs |
| checks/architecture/frontend.mjs | scripts/checks/architecture/frontend.mjs |
| checks/architecture/index.mjs | scripts/checks/architecture/index.mjs |
| checks/architecture/next-data.mjs | scripts/checks/architecture/next-data.mjs |
| checks/architecture/owners.mjs | scripts/checks/architecture/owners.mjs |
| checks/architecture/registration.mjs | scripts/checks/architecture/registration.mjs |
| checks/architecture/source-names.mjs | scripts/checks/architecture/source-names.mjs |
| checks/architecture/typescript.mjs | scripts/checks/architecture/typescript.mjs |
| checks/architecture.mjs | scripts/checks/architecture.mjs |
| checks/brand.mjs | scripts/checks/brand.mjs |
| checks/code-patterns/grammar-guards.mjs | scripts/checks/code-patterns/grammar-guards.mjs |
| checks/code-patterns/nest-boundaries.mjs | scripts/checks/code-patterns/nest-boundaries.mjs |
| checks/code-patterns/nest-error-identity.mjs | scripts/checks/code-patterns/nest-error-identity.mjs |
| checks/code-patterns/nest-errors.mjs | scripts/checks/code-patterns/nest-errors.mjs |
| checks/code-patterns/nest-metadata.mjs | scripts/checks/code-patterns/nest-metadata.mjs |
| checks/code-patterns/nest-tests.mjs | scripts/checks/code-patterns/nest-tests.mjs |
| checks/code-patterns/nest.mjs | scripts/checks/code-patterns/nest.mjs |
| checks/code-patterns/next-errors.mjs | scripts/checks/code-patterns/next-errors.mjs |
| checks/code-patterns/next.mjs | scripts/checks/code-patterns/next.mjs |
| checks/proof.mjs | scripts/checks/proof.mjs |
| checks/render.mjs | scripts/checks/render.mjs |
| checks/stacks.mjs | scripts/checks/stacks.mjs |
| checks/work-change.mjs | scripts/checks/work-change.mjs |
| checks/work-layout.mjs | scripts/checks/work-layout.mjs |

Completion marker: done/tinkle-4.done.
