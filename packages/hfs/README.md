# @starci/hfs

The HFS command line of a StarCi product repository. It is installed from the npm registry at the exact version in `knowledge/hfs/canon-pins.yaml` (see [`packages/README.md`](../README.md)),
and it is self-contained: `runtime/` carries the slot manifest, the canon pins, the Vietnamese why
catalog slice, the loader and the architecture machine with every file it imports, so it runs where there is no runtime
checkout. The machine loads `typescript` from the repository it checks (never its own copy), so run `npm ci` first.

```sh
npx hfs check   [--repo <dir>] [--json] [--fast] [--base <ref>] [--sonar <file>]   # exit 1 on any error-level finding
npx hfs report <eslint|stylelint> <in> <out> [--repo <dir>]   # a linter's json -> Sonar Generic Issue Import (see Sonar)
npx hfs init    [--repo <dir>] [--stdout]     # write a starter hfs.json (never overwrites); --stdout only prints
npx hfs emit-contracts [--repo <dir>]         # write contracts/<app>/schema.graphql of every api app that serves GraphQL (the managed script contract:emit)
npx hfs explain <path> [--repo <dir>] [--json]
npx hfs sync (--check | --write) [--root <dir>]   # generated files: the managedBy slots of slots.yaml, the .gitignore block (sync/, templates/)
npx hfs work-hygiene                              # pre-commit guard for staged .starciwork / .starcistacks paths
```

`hfs check` reads the repository's `hfs.json` and the tracked paths (`git ls-files`), checks the work tree, and then runs the
whole architecture machine over the repository. Every finding carries a why code and its Vietnamese text
(`modules/kernel/failure-codes.yaml`).

Its own checks (`scripts/lib/hfs-check.mjs`, `scripts/lib/hfs-rules/`; the rendered-file checks (`sync/managed.mjs`) and the prettier check (`sync/format.mjs`) live in `sync/` because they read the templates and the repository's own install, and reach `hfs check` as `extraFindings`; the jest / vitest preset the coverage exclusions come from and prettier are read from the repository's `node_modules`, so run `npm ci` first):

| Code | Level | Meaning |
|---|---|---|
| `HFS_SLOT_UNDECLARED` | error | a tracked path no slot owns (the nearest slot is named) |
| `HFS_SLOT_NOT_ENABLED` | error | a path in an opt-in slot `hfs.json` did not declare |
| `HFS_SLOT_AMBIGUOUS` | error | two slots own the path equally (a manifest gap) |
| `HFS_TRACKED_MUST_BE_IGNORED` | error | a tracked path in an `ignored` slot (build output, generated) |
| `HFS_FORBIDDEN_PRESENT` | error | a tracked path in a forbidden / `external` slot |
| `HFS_SLOT_REQUIRED_MISSING` | error | a file or directory a required slot, app or instance must contain |
| `HFS_MIN_INSTANCES` | error | fewer instances of a slot than `minInstances` |
| `HFS_CANON_PIN_DRIFT` | error | a dependency not at the exact version of `knowledge/hfs/canon-pins.yaml` |
| `HFS_SIZE_SOFT_BACKLOG` | info | a source file over `ruleParams.fileLines.soft`; report only, never fails |
| `HFS_MANAGED_FILE_DRIFT` | error | a managed file that exists but differs from its render (hooks, workflows, sonar, codecov, `tsconfig.build.json`, `src/tests/tsconfig.json` (back end; a front end keeps `tsconfig.e2e.json`), `jest.config.js` (back end), `vitest.config.ts` (front end), `.prettierrc`, `.prettierignore`, the `scripts` block of `package.json`, compared as parsed JSON) |
| `HFS_RULE_OFF_WITHOUT_REPLACEMENT` | error | `eslint.config.mjs`, or a front end's `stylelint.config.mjs`, differs from its one-line render, so a rule could be off, warned or redefined in it |
| `HFS_TOOL_CONFIG_LOCAL` | error | a repository holds a tool config outside the managed set (`.eslintrc*`, `.eslintignore`, a second `eslint.config.*` or `stylelint.config.*`, another prettier, vitest, jest or lint-staged config), a file that defines an ESLint rule or a stylelint plugin, a tool configuration key in a `package.json` (`eslintConfig`, `stylelint`, `prettier`, `lint-staged`, `jest`), or a script that runs eslint, stylelint or prettier with a flag that swaps the configuration |
| `HFS_SONAR_CONFIG` | error | `sonar-project.properties` differs from its render (no host URL; the ESLint report and HFS import paths), or the stack declaration names another quality gate than the one of `knowledge/sonar-gate.yaml` |
| `HFS_TS_STRICT` | error | the root `tsconfig.json` sets, lowers or adds anything but `extends` the preset (`be.json`, `next.json`), the template's `exclude` and (back end) the three `paths`; the finding names the flag |
| `HFS_EMPTY_DIR` | error | a directory with no file below it (git tracks none), outside `.git`, `node_modules` and `ignored` slots; the topmost one is reported |
| `HFS_GHOST_TREE` | error | an empty directory beside a sibling whose name is within two edits of its own (`business` / `bussiness`) |
| `HFS_UNTRACKED_ROOT_ENTRY` | error | an entry git neither tracks nor ignores (`git ls-files -o --exclude-standard`), outside an `ignored` slot |
| `HFS_PLAINTEXT_SECRET` | error | a tracked plaintext secret: an env, key or credentials file, a value the push scan refuses (never printed), or an `.enc` that is no sops envelope (R06) |
| `HFS_STACKS_SHAPE` | error | a `.starcistacks` path outside the standard shape (a sealed file outside `<env>/secrets/`, `runtime/files/`, root `DESIGN.md` or `k8s/`), a local Sonar not owned by the host, a service still rooted at `.stacks` (R10) |
| `HFS_CI_MISSING_CANON` | error | `ci.yml` without a `run: npx hfs check` step (whole check, pinned version), or `.husky/pre-push` without `npm run typecheck` and `npm run lint:check` (R13) |
| `HFS_DEP_VERSION_SKEW` | error | a dependency at two specs across the root and workspace `package.json` files, or a nested copy of a declared dependency in `package-lock.json` (R14) |
| `HFS_CONTRACT_SNAPSHOT_DRIFT` | error / info | a back end serving GraphQL without `contracts/<app>/schema.graphql`, a front-end contract copy that differs by hash from the sibling back end named by `hfs.json` `stacks` (info when the sibling is not checked out) (R23) |
| `BE_TEST_TOPOLOGY` | error | a `*.test.*` file, a `testing/` folder, a second jest configuration or a `jest` key in `package.json` (R47; `int-spec`, `harness-spec` and the retired test folders are the machine's `HFS_TEST_KIND_RETIRED`) |
| `FE_WIRE_GENERATED` | error | a contract copy with no `codegen` script wired before `build` and `typecheck`, or generated types older than the copy (R52) |
| `FE_I18N_PLACEMENT` | error | no `next-intl`, no `src/proxy.ts`, a `middleware.ts`, a route file outside `[locale]`, no `vi.json` catalog (R59) |
| `FE_I18N_CATALOG` | error | a locale catalog lacking a key another locale has (R60) |
| `HFS_GITIGNORE_BLOCK_DRIFT` | error | the managed `.gitignore` block differs from its render (R04; `sync/managed.mjs`) |
| `HFS_SONAR_CONFIG` | error | `sonar-project.properties` differs from its render: no `sonar.host.url`, the coverage exclusions of the installed jest / vitest preset (R11; `sync/managed.mjs`) |
| `HFS_FORMAT` | error | a tracked file the repository's own prettier would change (R19; `sync/format.mjs`, not under `--fast`) |
| `HFS_FORMAT_TOOL_MISSING` | refusal (exit 2) | prettier is not installed in the repository; the format check is never skipped |

The managed files are judged by `sync/managed.mjs` and `sync/ts-strict.mjs` (the package renders the templates; the runtime copy does not). The list of managed
files is the `managedBy` slots of `slots.yaml`; `hfs sync --write` renders them and `hfs check` compares them, so a hand edit and a forgotten `sync` are the same finding.
Each finding is reported once: the eslint and stylelint one-liners under R17, `tsconfig.json` under R22 when it names a flag, a workflow or hook that lost a canon step under R13 (or R19 for the format step), everything else under R05.
A front end is rendered by the same mechanism as a back end: `tsconfig.json`, `tsconfig.e2e.json`, `eslint.config.mjs`, `stylelint.config.mjs`, `vitest.config.ts`, `.prettierrc`, `.prettierignore`, the hooks, the workflows, the Sonar and codecov files
and the `scripts` block (`lint:check` is the one lint gate, ESLint over apps, packages and `e2e/` plus stylelint; `test:e2e` is the only script that runs Playwright). `vitest.setup.ts`, `playwright.config.ts` and `turbo.json` stay the repository's own
(`fe.tool-config-repo`): they carry the repository's setup, web servers and ports, which no preset can render, and per-app `vitest.config.ts` files carry aliases and plugins.

The architecture machine (`scripts/checks/architecture.mjs` of the runtime, the same code bundled here): tiers and import
direction, owner public API, cycles, module registration and composition, clones, dead exports, required files, size growth,
the source-shape, contract-form and front-end rules, and the repository-tree rules. Each violation and each error is one
finding under the machine's own rule id (`BE_TIER_DIRECTION`, `HFS_UNUSED_EXPORT`, `ARCH_OWNER_EXPORT_BYPASS`, ...). A
repository without `typescript` installed fails with `ARCH_TYPESCRIPT_MISSING`; the check never passes because it could not run.

`--fast` (the template pre-push hook runs `npx hfs check --fast`) judges only what changed since the merge-base of `HEAD` with
`origin/main` (else `main`; `--base <ref>` names another ref): the slot and pin checks on the changed paths, the machine on the owners
of the changed source files without clones and dead exports, and no file-system tree checks. The required-file and minimum-instance
checks still cover the whole tree. With no merge-base `--fast` is a refusal (exit 2) that names the fix, never a silent full
pass. Without `--fast`, `--base <ref>` is the base of the size-growth check.

Exit codes: 0 clean, 1 an error finding, 2 a refusal (not a Git work tree, bad flag, `--fast` with no merge-base). The command never writes to the repository
except `hfs init`, which writes `hfs.json` only when none exists.

## Sonar

One mechanism, the same for a back end and a front end: every finding of the canon is imported into Sonar, and the quality gate
fails while any is open. Nothing is configured per repository; the pieces are managed files (`hfs sync`) and this package.

| Source | Report | How Sonar reads it |
|---|---|---|
| `hfs check` (repository, managed-file and architecture-machine findings) | `reports/hfs.sonar.json`, from `hfs check --sonar reports/hfs.sonar.json` | `sonar.externalIssuesReportPaths`, engine `starci-hfs`, rule id = the finding code |
| ESLint (the BE and FE canon plugins alike) | `reports/eslint.json` (`npm run lint:report`) then `reports/eslint.sonar.json`, from `hfs report eslint reports/eslint.json reports/eslint.sonar.json` | `sonar.externalIssuesReportPaths`, engine `eslint`, rule id = the ESLint rule |
| stylelint (front end) | `reports/stylelint.json` (`npm run lint:report:css`) then `reports/stylelint.sonar.json`, from `hfs report stylelint ...` | `sonar.externalIssuesReportPaths`, engine `stylelint`, rule id = the stylelint rule |

`--sonar` writes the error findings as a Generic Issue Import document (SonarQube 10.3+ format: `{ rules, issues }`) before the verdict, so a
failing check still leaves its report. A rule's name and description are the catalog's English title and Vietnamese title, meaning and next step;
impacts are HIGH (maintainability). `info` findings (the soft-size backlog) are report-only and not imported. The output is sorted, so two runs
over one tree are byte-identical. Sonar drops an issue on a file it does not index (a tracked source file or stylesheet under `sonar.sources`), so the ONE placement rule of the three engines files a finding on
any other path (hfs.json, a workflow, a config file, `e2e/`, a package the sources do not list) and a finding with no path on the first source file, its message starting with the real path.
Sonar's own ESLint import (`sonar.eslint.reportPaths`) is not used: it drops those issues silently. A front end's `sonar.sources` and `sonar.tests` are `apps`, plus `packages` when hfs.json opts into `repo.packages` or an `fe.package.*` slot.

The managed `sonar-project.properties` carries `sonar.externalIssuesReportPaths` (`reports/hfs.sonar.json`, `reports/eslint.sonar.json` and, for a front end, `reports/stylelint.sonar.json`) and no `sonar.host.url` (the host is
`SONAR_HOST_URL`); the managed CI workflow produces the reports and runs the scan and the gate action with `!cancelled()`, so a failed check step still
reaches Sonar while the job stays failed. There is no `continue-on-error`. Both profiles run `npm run hfs:report`, `npm run lint:report` (a front end also `npm run lint:report:css`) and `npx hfs report <linter> <in> <out>` for each. The duplicate-block threshold (`ruleParams.<profile>.duplicateBlock`) has no Sonar property for TypeScript (SonarJS detects
clones with its own token rule), so the machine enforces it (R21) and its findings are imported like every other.

The gate is `knowledge/sonar-gate.yaml`, the one declaration: the new-code conditions and an `overall` part (0 open issues on the whole code,
duplicated lines density, cognitive complexity through the S3776 rule). A SonarQube gate condition cannot filter by engine, so the condition counts every
open issue, imported or native; that is stricter than the three imports alone and is intended. `hfs check` reports `HFS_SONAR_CONFIG` (R11) when the
properties file is not its render or the stack declaration names another gate. R20 and R21 have their Sonar enforcers as conditions of that file.

## Maintaining the bundle

`runtime/` is a byte copy of the slot loader files, the pins, and the import closure of `scripts/lib/hfs-check.mjs` and
`scripts/checks/architecture.mjs` (computed by `scripts/sync-runtime.mjs`, so a new import of the machine is bundled without
editing a list), plus the catalog slice of every code `hfs check` can emit: its own and the machine's (`ARCHITECTURE_RULE_IDS`,
derived from the machine's rule id lists). After changing any of those files, `knowledge/hfs/slots.yaml`,
`knowledge/hfs/canon-pins.yaml`, `knowledge/patterns/fe/folder.yaml` or the catalog entries of those codes, run `node packages/hfs/scripts/sync-runtime.mjs`;
`tests/hfs-cli.spec.mjs` fails on a stale copy. Bump `version` here and in the pin when the behaviour changes.

The examples gate `node scripts/checks/check-example-architecture.mjs` runs this CLI (full check) on every `examples/*` directory
with an `hfs.json` and fails on any error-level finding (it is heavy: run it once, by hand).

## Serving knowledge to other packages

`package.json` `exports` opens `./runtime/*`, so a package that needs a runtime file resolves it from the installed copy
(`import.meta.resolve("@starci/hfs/runtime/knowledge/hfs/slots.yaml")`), never from the product repository or a link path.
`@starci/eslint-canon-be` does this and lists `@starci/hfs` in `dependencies` at the exact version.
