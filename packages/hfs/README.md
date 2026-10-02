# @starci/hfs

The HFS command line of a StarCi app: the one repository of a product, `<app>/` with its root (the one `package.json`, lockfile and `node_modules`, `hfs.json` of kind `app`, CI, hooks, `.starciwork`) and its two sides `be/` and `fe/`. It is installed from the npm registry at the exact version in `knowledge/hfs/canon-pins.yaml` (see [`packages/README.md`](../README.md)),
and it is self-contained: `runtime/` carries the slot manifest, the canon pins, the Vietnamese why
catalog slice, the loader and the architecture machine with every file it imports, so it runs where there is no runtime
checkout. The machine loads `typescript` from the app it checks (never its own copy), so run `npm ci` first.

Every command runs at the app root. A side is judged with its folder as the root it was when products were split in two repositories (the "side view" of `scripts/hfs/slots.mjs`): the root slots (`app.*`) are judged once, the `be.*` slots under `be/` and the `fe.*` slots under `fe/`, and nothing crosses sides except `sides.fe.reads` (`be/contracts/`, the input of the front end's codegen). Every finding path is app-relative (`be/src/...`, `fe/apps/...`).

```sh
npx hfs lint    [--repo <dir>] [--changed <file>...] [--fix] [--format text|json] [--sonar <file>] [--stylelint <glob>]   # THE lint entry (`npm run lint`): ESLint over be/ with the BE canon and over fe/ with the FE canon, stylelint over fe/, the hfs checks; exit 0 clean, 1 findings, 2 a tool could not run
npx hfs check   [--repo <dir>] [--json] [--fast] [--base <ref>]   # the repository pass alone (what `hfs lint` runs for the findings that have no TypeScript file); exit 1 on any error-level finding
npx hfs scaffold app <name> [--into <dir>]   # a new app <dir>/<name>/: the root, be/ and fe/ skeletons and the app hfs.json; refuses an existing directory
npx hfs emit-contracts [--repo <dir>]         # write be/contracts/<app>/schema.graphql of every api app that serves GraphQL and be/contracts/<app>/openapi.json of every api app with a typed operation table (the managed script contract:emit)
npx hfs explain <path> [--repo <dir>] [--json]
npx hfs sync (--check | --write) [--root <dir>]   # generated files: the managedBy slots of slots.yaml, the .gitignore block (sync/, templates/)
npx hfs work-hygiene                              # pre-commit guard: staged .starciwork / .starcistacks paths, and the secrets guard over every staged file (read from the index)
npx hfs new service <dir> <name> [--inject <Decorator>=<module>:<Type> | <Class>=<module>]... [--repo <dir>]   # a back-end service and its unit spec skeleton
npx hfs new spec <file>.service.ts [--repo <dir>]                                                              # the spec skeleton of an existing service
```

## Creating a service

Only `*.service.ts` files are unit-tested (unit test standard), each with exactly one colocated `<name>.service.spec.ts`. `hfs new` is the one way they come into being together:

- `hfs new service src/modules/domain/commission commission --inject InjectPrimaryEntityManager=@modules/platform/database:EntityManager --inject InjectClock=@modules/platform/clock:Clock` writes `commission.service.ts` (the class, `@Injectable()`, the constructor with the given `@Inject*()` parameters) and `commission.service.spec.ts`. `--inject` is `<Decorator>=<module>:<Type>` for a custom `@Inject*()` decorator (its token is the UPPER_SNAKE of the name, `PRIMARY_ENTITY_MANAGER`, exported from the same module) or `<Class>=<module>` for a class-typed dependency. The directory must belong to a slot of the manifest that owns the file (a service lives in `src/modules/{domain,platform,integrations}/<capability>/`), and `hfs new` never overwrites.
- `hfs new spec src/modules/domain/member/member-profile.service.ts` writes only the spec of a service you wrote by hand. It reads the constructor with the repository's own TypeScript compiler API, so `npm ci` comes first.

The spec skeleton is `Test.createTestingModule({ providers: [Service, { provide: TOKEN, useValue: double }, ...] }).compile()` and `moduleRef.get(Service)`, with one provider per constructor dependency and nothing else, every double imported from `@starci/jest-preset` (the root), and one placeholder `it` per public method. The double of a token comes from `ruleParams.be.specDoubles` of the slot manifest, the table the lint law `spec-infra-double-from-kit` holds a spec to (`*_ENTITY_MANAGER` -> `mockEntityManager()`, `CLOCK` -> `new FakeClock(...)`, `EVENT_BUS` -> `recordingEventBus()`, `QUEUE_OUTBOX` -> `recordingQueueOutbox()`, `CACHE` -> `fakeCache(clock)`, lock, lease, fence and hold -> `fakeLock(clock)`, ids -> `fakeIds()`, `*_OPTIONS` -> a literal to fill in, everything else and every class -> `mock<T>()`), so the skeleton satisfies the law by construction: no cast, no `new` of the service, no ambient clock. A back end only (a front end has no services); the files are written for prettier (print width 120).

`hfs check` reads the app's `hfs.json` and the tracked paths (`git ls-files`), checks the work tree (the root rules once, the side rules per side), and then runs the
whole architecture machine over each side folder. Every finding carries a why code and its Vietnamese text
(`modules/kernel/failure-codes.yaml`).

Its own checks (`scripts/hfs/check.mjs`, `scripts/hfs/rules/`; the rendered-file checks (`sync/managed.mjs`) and the prettier check (`sync/format.mjs`) live in `sync/` because they read the templates and the repository's own install, and reach `hfs check` as `extraFindings`; the jest / vitest preset the coverage exclusions come from and prettier are read from the repository's `node_modules`, so run `npm ci` first):

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
| `HFS_MANAGED_FILE_DRIFT` | error | a managed file that exists but differs from its render (hooks, workflows, sonar, `tsconfig.build.json`, `src/tests/tsconfig.json` (back end), `jest.config.js` (back end), `.prettierrc`, `.prettierignore`, the `scripts` block of `package.json`, compared as parsed JSON) |
| `HFS_RULE_OFF_WITHOUT_REPLACEMENT` | error | `eslint.config.mjs`, or a front end's `stylelint.config.mjs`, differs from its one-line render, so a rule could be off, warned or redefined in it |
| `HFS_TOOL_CONFIG_LOCAL` | error | a repository holds a tool config outside the managed set (`.eslintrc*`, `.eslintignore`, a second `eslint.config.*` or `stylelint.config.*`, another prettier or lint-staged config, or a jest config in a back end that is not the one root file), a file that defines an ESLint rule or a stylelint plugin, a tool configuration key in a `package.json` (`eslintConfig`, `stylelint`, `prettier`, `lint-staged`, `jest`), or a script that runs eslint, stylelint or prettier with a flag that swaps the configuration |
| `HFS_SONAR_CONFIG` | error | `sonar-project.properties` differs from its render (no host URL; the ESLint report and HFS import paths), or the stack declaration names another quality gate than the one of `knowledge/sonar-gate.yaml` |
| `HFS_TS_STRICT` | error | the root `tsconfig.json` sets, lowers or adds anything but `extends` the preset (`be.json`, `next.json`), the template's `exclude` and (back end) the three `paths`; the finding names the flag |
| `HFS_EMPTY_DIR` | error | a directory with no file below it (git tracks none), outside `.git`, `node_modules` and `ignored` slots; the topmost one is reported |
| `HFS_GHOST_TREE` | error | an empty directory beside a sibling whose name is within two edits of its own (`business` / `bussiness`) |
| `HFS_UNTRACKED_ROOT_ENTRY` | error | an entry git neither tracks nor ignores (`git ls-files -o --exclude-standard`), outside an `ignored` slot |
| `HFS_PLAINTEXT_SECRET` | error | a tracked plaintext secret: an env, key or credentials file, a value the push scan refuses (never printed), or an `.enc` that is no sops envelope (R06) |
| `HFS_STACKS_SHAPE` | error | a `.starcistacks` path outside the standard shape (a sealed file outside `<env>/secrets/`, `runtime/files/`, root `DESIGN.md` or `k8s/`), a local Sonar not owned by the host, a service still rooted at `.stacks` (R10) |
| `HFS_CI_MISSING_CANON` | error | `ci.yml` without a `run:` step of `hfs lint` (`npm run lint`, or `npx hfs lint` at the pinned version), or `.husky/pre-push` without `npm run typecheck` and `npm run lint` (R13) |
| `HFS_DEP_VERSION_SKEW` | error | a dependency at two specs across the root and workspace `package.json` files, a dependency declared at another version than the root `overrides` pin, or a nested copy of a declared dependency in `package-lock.json` (R14) |
| `HFS_CONTRACT_SNAPSHOT_DRIFT` | error | a back-end api app serving GraphQL without `be/contracts/<app>/schema.graphql` (R23); the front end reads that snapshot in place, so there is no copy to drift |
| `BE_TEST_TOPOLOGY` | error | a `*.test.*` file, a `testing/` folder, a second jest configuration or a `jest` key in `package.json` (R47; `int-spec`, `harness-spec` and the retired test folders are the machine's `HFS_TEST_KIND_RETIRED`) |
| `BE_SPEC_PLACEMENT` | error | a `*.spec.*`, `*.test.*` or `*-spec.*` file outside the four test layers, `scripts/` and `tools/` included (R102) |
| `HFS_REPO_LOCAL_CHECK` | error | a `check-*` file in `scripts/` or `tools/`, an `eslint-local-rules*` file or local eslint plugin, or a script that runs a local check (R103) |
| `HFS_LINT_SUPPRESSION_FILE` | error | an `eslint.suppressions*` file, a `lint:suppressions` script, an eslint suppress flag or a suppressions config (R104) |
| `HFS_PROOF_COMMAND_FILE_MISSING` | error | a `.starciwork` `requiresProof.<kind>.command` that runs a file the repository does not hold (R105) |
| `FE_GRAPHQL_CONTRACT` | error | a front-end `.graphql` document that the back end's contract snapshot (`be/contracts/<service>/schema.graphql`) does not serve: an unknown field, argument or input field, a missing required argument, a variable of another type, or a selection that does not fit (R113) |
| `BE_INTEGRATION_SPEC_MISSING` | error | an integration (`src/modules/integrations/<provider>/` with `<provider>.config.ts`) without a `src/tests/integration/<provider>/*.integration-spec.ts` that registers its module through `useTestWorld({ modules })`, references its ErrorCode enum and drives an outage through the world (R112) |
| `HFS_MONO_WORKSPACES` | error | the app root `package.json` without `workspaces` exactly `["fe/apps/*", "fe/packages/*"]`, `packageManager` `npm@<version>` or a `turbo` devDependency (R127) |
| `HFS_MONO_FE_WORKSPACE` | error | an fe app `package.json` not named `@<project>/<app>`, not private, or without exactly the workspace scripts; an fe package without `build`, `typecheck` and the workspace `lint` (R128) |
| `HFS_MONO_NEST_PROJECTS` | error | `be/nest-cli.json` not `monorepo: true`, its default project not an api app, or its `projects` not exactly the declared be apps (R129) |
| `HFS_MONO_WORKSPACE_DEP` | error | an fe workspace imports a package its own `package.json` does not declare, or the root `package.json` declares a workspace package (R130) |
| `HFS_PEER_INTEGRATION_MISSING` | error | the app root `package.json` depends on a driver integration (a pair of `knowledge/hfs/peer-integrations.yaml`) without its runtime peer, e.g. `@nestjs/apollo` on `@nestjs/platform-express` 11 without `@as-integrations/express5` (R111) |
| `FE_WIRE_GENERATED` | error | a contract copy with no `codegen` script wired before `build` and `typecheck`, or generated types older than the copy (R52) |
| `FE_I18N_PLACEMENT` | error | no `next-intl`, no `src/proxy.ts`, a `middleware.ts`, a route file outside `[locale]`, no `vi.json` catalog (R59) |
| `FE_I18N_CATALOG` | error | a locale catalog lacking a key another locale has (R60) |
| `FE_I18N_KEYS` | error | a literal key read through `next-intl` that a locale lacks, or a catalog key no source reads (R106; the architecture machine) |
| `FE_NO_TESTS` | error | a front end holds a `*.spec.*`, `*.test.*` or `*-spec.*` file, an `e2e/`, `__tests__/`, `__mocks__/` or `test-support/` directory, a vitest, Playwright, jest or Cypress file, a test script, or a test dependency in a `package.json`; no exception (R97; `scripts/hfs/rules/fe-no-tests.mjs`) |
| `HFS_GITIGNORE_BLOCK_DRIFT` | error | the managed `.gitignore` block differs from its render (R04; `sync/managed.mjs`) |
| `HFS_SONAR_CONFIG` | error | `sonar-project.properties` differs from its render: no `sonar.host.url`, the `sonar.exclusions` of the installed jest preset, the be lcov import with the services as the only coverage scope (R11; `sync/managed.mjs`) |
| `HFS_FORMAT` | error | a tracked file the repository's own prettier would change (R19; `sync/format.mjs`, not under `--fast`) |
| `HFS_FORMAT_TOOL_MISSING` | refusal (exit 2) | prettier is not installed in the repository; the format check is never skipped |

The managed files are judged by `sync/managed.mjs` and `sync/ts-strict.mjs` (the package renders the templates; the runtime copy does not). The list of managed
files is the `managedBy` slots of `slots.yaml`; `hfs sync --write` renders them and `hfs check` compares them, so a hand edit and a forgotten `sync` are the same finding.
Each finding is reported once: the eslint and stylelint one-liners under R17, `tsconfig.json` under R22 when it names a flag, a workflow or hook that lost a canon step under R13 (or R19 for the format step), everything else under R05.
The root and both sides are rendered by the one mechanism. The root: `package.json` `scripts` (`dev:be`, `dev:fe`, `build:be`, `build:fe`, `start:<app>`, `lint`, `lint:fix`, `test`, `test:integration`, `test:e2e`, `test:contract`, `test:stack`, `codegen`, `contract:emit`, `migrate`, `typecheck`, ...; a be script runs from `be/`, where its tsconfig and jest configuration are), `.prettierrc`, `.prettierignore`, the `.husky` hooks, the CI workflows, the Sonar file and the `.gitignore` block. A side: its `tsconfig.json` (resolving `@starci/tsconfig` from the root `node_modules`), its `eslint.config.mjs` one-liner, and for be `tsconfig.build.json`, `src/tests/tsconfig.json` and `jest.config.js`, for fe `stylelint.config.mjs`. `lint` is the one lint gate, `hfs lint`: ESLint over each side with its canon, the app check and stylelint over fe; `lint:fix` is the same with `--fix`. The front end has no test script, no test configuration and no e2e or coverage file: it has no tests, and `FE_NO_TESTS` (R97) refuses any spec, e2e file, test tool or test script under `fe/`. `turbo.json` stays the app's own
(`fe.tool-config-repo`): it carries the task graph, which no preset can render.

The architecture machine (`scripts/hfs/architecture.mjs` of the runtime, the same code bundled here): tiers and import
direction, owner public API, cycles, module registration and composition, clones, dead exports, required files,
the source-shape, contract-form and front-end rules, and the repository-tree rules. Each violation and each error is one
finding under the machine's own rule id (`BE_TIER_DIRECTION`, `HFS_UNUSED_EXPORT`, `ARCH_OWNER_EXPORT_BYPASS`, ...). A
repository without `typescript` installed fails with `ARCH_TYPESCRIPT_MISSING`; the check never passes because it could not run.

`--fast` (the template pre-push hook runs `npx hfs check --fast`) judges only what changed since the merge-base of `HEAD` with
`origin/main` (else `main`; `--base <ref>` names another ref): the slot and pin checks on the changed paths, the machine on the owners
of the changed source files without clones and dead exports, and no file-system tree checks. The required-file and minimum-instance
checks still cover the whole tree. With no merge-base `--fast` is a refusal (exit 2) that names the fix, never a silent full
pass.

Exit codes: 0 clean, 1 an error finding, 2 a refusal (not a Git work tree, bad flag, `--fast` with no merge-base). `hfs check` and `hfs lint` never write to the app
(`hfs lint --fix` lets ESLint and stylelint fix in place).

## Sonar

One mechanism for both sides: every finding of the canon is imported into Sonar, and the quality gate
fails while any is open. Nothing is configured per app; the pieces are managed files (`hfs sync`) and this package.

One entry, one report, one file: `npm run lint` is `hfs lint`; `npm run lint -- --sonar reports/lint.sonar.json` writes the ONE Sonar file, read through `sonar.externalIssuesReportPaths`. It carries three engines: `starci-hfs` (the repository findings of `hfs check`, rule id = the finding code), `eslint` (the BE and FE canon plugins alike, rule id = the ESLint rule) and `stylelint` over fe (rule id = the stylelint rule). `hfs lint --format json` prints the same findings as the one report `starci/lint@1` (`{ schema, ok, changed, counts.error, engines, errors[], findings[{ engine, rule, code, severity, path, line, column, message }] }`); `--changed <files...>` restricts ESLint and stylelint to those files and keeps of the repository findings the ones on a listed file or on no file. The exit code is 0 clean, 1 findings, 2 a tool could not run (a missing ESLint install is never a pass).

`--sonar` writes the findings as a Generic Issue Import document (SonarQube 10.3+ format: `{ rules, issues }`) before the verdict, so a
failing lint still leaves its report. A rule's name and description are the catalog's English title and Vietnamese title, meaning and next step;
impacts are HIGH (maintainability). `info` findings (the soft-size backlog) are report-only and not imported. The output is sorted, so two runs
over one tree are byte-identical. Sonar drops an issue on a file it does not index (a tracked source file or stylesheet under `sonar.sources`), so the ONE placement rule of the three engines files a finding on
any other path (hfs.json, a workflow, a config file, `e2e/`, a package the sources do not list) and a finding with no path on the first source file, its message starting with the real path.
Sonar's own ESLint import (`sonar.eslint.reportPaths`) is not used: it drops those issues silently. `sonar.sources` lists `be/apps`, `be/src` and `fe/apps` (plus `fe/packages` when the front end opts into an `fe.package.*` slot); `sonar.tests` is the back end's.

The managed `sonar-project.properties` carries `sonar.externalIssuesReportPaths` (`reports/lint.sonar.json` only) and no `sonar.host.url` (the host is
`SONAR_HOST_URL`); the managed CI workflow produces the report and runs the scan and the gate action with `!cancelled()`, so a failed lint step still
reaches Sonar while the job stays failed. There is no `continue-on-error`. CI runs `npm run lint -- --sonar reports/lint.sonar.json` once at the app root, before the scan. The duplicate-block threshold (`ruleParams.<side>.duplicateBlock`) has no Sonar property for TypeScript (SonarJS detects
clones with its own token rule), so the machine enforces it (R21) and its findings are imported like every other.

The gate is `knowledge/sonar-gate.yaml`, the one declaration: the new-code conditions (coverage 100, duplication, blocker and critical issues, hotspots) and an `overall` part (coverage 100, 0 open issues on the whole code,
every hotspot reviewed, duplicated lines density, cognitive complexity through the S3776 rule). A SonarQube gate condition cannot filter by engine, so the condition counts every
open issue, imported or native; that is stricter than the three imports alone and is intended. `hfs check` reports `HFS_SONAR_CONFIG` (R11) when the
properties file is not its render or the stack declaration names another gate. R20 and R21 have their Sonar enforcers as conditions of that file.

Coverage is the services' alone, from one scope. The managed `test` script is `jest --selectProjects unit --coverage`: it fails below the per-file 100 threshold on `src/**/*.service.ts` and writes `be/coverage/lcov.info` (the jest preset's lcov reporter). The managed `sonar-project.properties` imports that report (`sonar.javascript.lcov.reportPaths=be/coverage/lcov.info`) with `sonar.coverage.exclusions` set to the complement of the services (SonarQube has no coverage inclusions: `coverageExclusions` in `sync/index.mjs` lists every be source role of the slot manifest's suffix vocabulary other than `service`, the be file names a slot declares outside it such as `main.ts`, `index.ts` and the migrations, and `fe/**`) and no other coverage key, so a handler, resolver, controller, module, config file or test is not a coverage target and `fe/` is outside coverage. The managed `codecov.yml` holds the same paths at 100 on the project and the patch and ignores `fe/**`; the managed CI workflow uploads the lcov with `codecov/codecov-action` after the unit run. `hfs sync` renders the scope into both files from the installed jest preset's `COVERAGE_SOURCES` (`coverageScope` in `sync/index.mjs`), so they can never drift. The runtime judges the coverage per file: `sonar-local.mjs scan` holds every service a slice touched at 100, and `sonar-local.mjs dashboard` fails a project unless every service is at 100.

The upload needs the repository secret `CODECOV_TOKEN` (each product monorepo gets its own; the runtime repository's root `.github/workflows/examples.yml` uses the runtime repository's one for the example apps; the owner adds it once per repository: Codecov, the repository's settings, then GitHub Settings > Secrets and variables > Actions > New repository secret `CODECOV_TOKEN`). Without it the step is skipped like the Sonar steps without `SONAR_TOKEN`.

## Maintaining the bundle

`runtime/` is a byte copy of the slot loader files, the pins, and the import closure of `scripts/hfs/check.mjs` and
`scripts/hfs/architecture.mjs` (computed by `scripts/sync-runtime.mjs`, so a new import of the machine is bundled without
editing a list), plus the catalog slice of every code `hfs check` can emit: its own and the machine's (`ARCHITECTURE_RULE_IDS`,
derived from the machine's rule id lists). After changing any of those files, `knowledge/hfs/slots.yaml`,
`knowledge/hfs/canon-pins.yaml`, `knowledge/patterns/fe/folder.yaml` or the catalog entries of those codes, run `node scripts/hfs/sync-runtime.mjs`;
`tests/packages-hfs/hfs-cli.spec.mjs` fails on a stale copy. Bump `version` here and in the pin when the behaviour changes.

The examples gate `node scripts/checks/check-example-architecture.mjs` runs `hfs lint` of this CLI at the root of every `examples/*`
app with an `hfs.json` (`examples/todo-app`, `examples/ecommerce-app`) and fails on any finding or any tool that could not run;
`hfs check` alone would miss the machine's source rules, which the canons judge. It is heavy: run it once, by hand, after `npm ci`
in each app.

## Serving knowledge to other packages

`package.json` `exports` opens `./runtime/*`, so a package that needs a runtime file resolves it from the installed copy
(`import.meta.resolve("@starci/hfs/runtime/knowledge/hfs/slots.yaml")`), never from the product repository or a link path.
`@starci/eslint-canon-be` does this and lists `@starci/hfs` in `dependencies` at the exact version.
