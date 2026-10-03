# StarCi HFS - the one source and storage standard

HFS is the single standard for the tree, the source ownership, the storage and the shared tooling of every StarCi app,
of `.claude` itself and of every example under `examples/`. This file is the canonical statement. Where another runtime
document disagrees with it, this file wins and the other document is wrong; where this file disagrees with an enforcer
(`slots.yaml`, `rules.yaml`, a check, a canon rule), the enforcer wins and this file is fixed.

A product is ONE app repository, `<app>/`, and it is ALWAYS a monorepo, even with one service, so every app has the same
shape (R143 to R146). Its root holds the one `package.json`, the one `package-lock.json`, the one `node_modules`, the
managed `turbo.json`, the one `hfs.json` (kind `app`), the CI, the hooks, the formatter, the Sonar configuration,
`scripts/` and `.starciwork`. The root `package.json` declares the npm workspaces `fe/apps/*` and `fe/packages/*`: each fe app
(`@<project>/<app>`) and each fe package is a workspace with its own `package.json` and dependencies, and turbo runs their
build, dev, lint and typecheck (a workspace lints with `hfs lint --workspace .`, the one lint scoped to it). The back end has
no `package.json`: it is a Nest monorepo of `be/apps/<app>` (nest-cli `projects`), even for one service. Its two sides are `be/` (the back end) and `fe/` (the front end); each side holds everything a standalone
back-end or front-end repository root used to hold, except `package.json`, the lockfile and the other files the root
owns. Every path in this file is relative to the app root: a back-end path starts with `be/`, a front-end path with
`fe/`. The only cross-side reach is the front end reading `be/contracts/` (its codegen input), declared in `hfs.json`
`sides.fe.reads`. `hfs lint`, `hfs sync` and `hfs scaffold app` run at the app root.

The machine-readable parts live next to this file and are read by every check, lint factory, template and message:

| File | Owns |
| --- | --- |
| `slots.yaml` | Every kind of content allowed to exist in an app: path, presence, tracking, tier, required files, tests, budget, managed template, the two sides and their allowed cross-side reads. Versioned `MAJOR.MINOR.PATCH`. |
| `rules.yaml` | The rule catalog (ids increase from `R01`; a retired id is never reused) with finding code, the law, gates, failure codes and enforcers (catalog below). |
| `canon-pins.yaml` | The exact versions of every `@starci/*` package and framework this major supports. |

The pattern cases in `knowledge/patterns/{be,fe,repo}/` explain how to write code and structure files inside these
slots. Each case cites the rule id it implements (`hfsRules`) and the finding code that judges it. A code-writing op
READs the pattern files of the slots it touches before it codes (`knowledge/op-gate.yaml`).

## 1. Principles

1. **One source of law.** The slot manifest and the rule catalog in `.claude` are the only rules. An app carries no rule
   of its own, no allowlist, no baseline, no suppression file and no local copy of a canon config.
2. **Growth is addition.** A new kind of content is a new slot. A slot is never edited in place inside a major.
3. **One machine at every gate.** Pre-commit, the op gate (`scripts/gates/gate.mjs`), the Kernel's landing
   and CI run the same `@starci/hfs` at the pinned version. There is no rule only agents can run.
4. **Zero findings is necessary, not sufficient.** An app is done only when the behavioural conditions in section 11
   also hold: the real application boots, every feature is composed, every owner is mounted, the contracts match, the
   logger exists.
5. **No backward compatibility.** The day a major lands the previous major stops being valid. An app without a current
   `hfs.json` accepts migration goals only. There is no compatibility window, alias or dual path.

## 2. Slots, presence and tracking

A slot has an `id`, the `profiles` it exists in, a `path` pattern, a `presence`, a `tracked` state and optionally a
`tier`, `requires`, `allows`, `forbids`, `tests`, `budget`, `managedBy`, `rules` and lifecycle fields.

- `profiles`: `app` (a slot of the app root, `app.*`) or `be`, `fe` or both (a slot of a side: `be.*`, `fe.*`,
  `repo.*`). A side slot's path is relative to its side folder: `src/features/api/<feature>/` of profile `be` is
  `be/src/features/api/<feature>/` of the app. `hfs check` judges the root slots once and each side's slots under its folder
  (the side view of `scripts/hfs/slots.mjs`); every finding path is app-relative.
- `presence`: `required`, `optional`, `opt-in` (legal only when `hfs.json` lists the slot or declares an app of its
  kind) or `forbidden`.
- `tracked`: `tracked` (committed), `ignored` (may exist, must be gitignored, because a tool needs it in place) or
  `external` (must not exist in the working tree at all; `goesTo` names where it lives).
- Every tracked path matches exactly one slot (`HFS_SLOT_UNDECLARED`). A directory that matches a slot with
  `owner: true` is an owner, the unit that imports and cycles are judged on. There is no hand-written owner list.
- A file with `managedBy` is rendered from a template by `hfs sync`; any difference is `HFS_MANAGED_FILE_DRIFT`.
- `sides` names the two sides and the only paths of the other side each may read (`fe: [be/contracts/]`); a side
  imports nothing of the app outside itself (`ARCH_INTERNAL_IMPORT_OUTSIDE`).

### 2.1 Versioning

- **Patch**: wording, why text, examples. No check result changes.
- **Minor**: add a slot (always `optional` or `opt-in`), an app kind, a protocol, a rule at severity `warn`, or tighten
  a budget that no pinned app exceeds. Every app on the same major stays green without edits.
- **Major**: change or remove a slot, make an optional slot required, raise a rule from `warn` to `error`, change the
  direction matrix. It needs owner approval and one migration lane per app.
- A retired slot gets `retiredIn` and a successor id; afterwards a path matching it belongs to no slot and is `HFS_SLOT_UNDECLARED`.
- An app pins only the major (`"hfs": 2`) and always runs the newest minor of that major.

### 2.2 Adding something without breaking HFS

| To add | Do | Bump |
| --- | --- | --- |
| Helper or type used by one feature only | `be/src/features/api/<feature>/application/support/<name>.<role>.ts` (`be.feature.application.support`, optional); another feature cannot import it, a second user moves it to a `domain` capability | minor |
| One-off action (migrate, seed, sync, backup, operator command) | a sub-command `be/src/features/cli/<group>/subs/<name>.cli.ts` with its `<name>.cli.spec.ts` in the cli feature root (`be.cli`), compiled into the one app `be/apps/cli` (`be.app.cli`, kind `cli`), run as `cli <group> <command>` | none |
| Event consumer | `transport/message/<event>.consumer.ts` in the api feature, composed by the api app that owns it (or a `worker` app scaled apart); declares the pattern `event-bus` | none, declared in `hfs.json` |
| Background job, sweep, recurring task | `features/jobs/<job>/transport/queue/<job>.processor.ts` plus a typed queue `modules/queues/<queue>/<queue>.queue.ts` with a BullMQ job scheduler; declares the patterns `queue` and `fenced-job` | none, declared in `hfs.json` |
| Another api app, or a worker app to scale background work apart | `be/apps/<name>` plus its kind in `hfs.json` `sides.be.apps` | none |
| Another Next app | `fe/apps/<name>` plus kind `next` in `hfs.json` `sides.fe.apps` | none |
| New app kind or protocol | new slot `be.app.<kind>` or `be.transport.<protocol>` | minor |
| Integration (payment, LLM) | `be/src/modules/integrations/<provider>/` | none |
| Model code | client in `integrations`, training code in a new slot, weights in an object store | minor |
| Human documentation | slot `repo.docs` (opt-in) | none |
| Infrastructure | `.starcistacks/<env>/infra/{compose,k8s,terraform}/` | none |
| Mobile app | a new app-kind slot (an Expo app) | minor |
| Shared package | `be/packages/<pkg>` or `fe/packages/<pkg>` (`repo.packages`, opt-in, built to `dist`, an npm workspace of the root `package.json`) | none |

## 3. The app declaration: `hfs.json`

The only declaration an app adds, at its root (shape `modules/schemas/hfs-repo.schema.yaml`). It declares the manifest
major, the kind `app`, the project binding and, per side, the apps with their kinds, the opt-in slots, the cross-side
reads and (back end only) the database connections.

```json
{
  "hfs": 2,
  "kind": "app",
  "project": "nivo",
  "sides": {
    "be": {
      "apps": [
        { "name": "core", "kind": "api" },
        { "name": "cli", "kind": "cli" }
      ],
      "optionalSlots": ["be.transport.message", "be.contract.graphql", "repo.docs"],
      "connections": [
        { "name": "primary", "envPrefix": "PRIMARY_DB", "owner": "core", "isolation": "database" },
        { "name": "agentos", "envPrefix": "AGENTOS_DB", "owner": "core", "isolation": "database" }
      ]
    },
    "fe": {
      "apps": [{ "name": "landing", "kind": "next" }, { "name": "app", "kind": "next" }],
      "optionalSlots": ["fe.package.ui", "fe.package.i18n"],
      "reads": ["be/contracts/"]
    }
  }
}
```

`sides.be.apps` lists every `be/apps/<name>` with its kind (`api`, `worker`, `cli`; at most one cli app, named `cli`, required once a connection is declared, R147); `sides.fe.apps` every
`fe/apps/<name>` (`next`). App names are unique across both sides. `connections` (back end only) lists every physical
database or schema as `{ name, envPrefix, owner, isolation }`: the logical name (never the engine; the connection IS the bounded
context), the prefix of its `<PREFIX>_*` environment keys, the one api or worker app that owns it (only that app composes it)
and whether the context is its own `database` or its own `schema` of a shared database (`<PREFIX>_SCHEMA`; splitting a schema
out into a database is an env change only). `reads` is a subset of the manifest's `sides.<side>.reads`. A missing `hfs.json`, or a machine run that analysed
zero files for a side, is a failure (`HFS_ARCH_CONFIG_UNREAD`), never "unavailable". Owners are derived from slots;
`hfs.json` holds no owner list, path or disabled rule. `hfs scaffold app <name>` writes a new app with its declaration.

## 4. App map: where everything lives

<!-- hfs:generated app-map -->
| Path | State | Slot |
| --- | --- | --- |
| `hfs.json` | required, tracked | `app.declaration` |
| `README.md` | required, tracked | `app.readme` |
| `package.json` | required, tracked, generated by hfs sync (package-scripts) | `app.package-manifest` |
| `turbo.json` | required, tracked, generated by hfs sync (task-graph) | `app.task-graph` |
| `package-lock.json` | required, tracked | `app.lockfile` |
| `{.gitignore,.gitattributes}` | required, tracked | `app.git-meta` |
| `{.editorconfig,.nvmrc}` | required, tracked | `app.tool-config` |
| `{.prettierrc,.prettierignore}` | required, tracked, generated by hfs sync (tool-config) | `app.format-config` |
| `.npmrc` | optional, tracked | `app.tool-config-optional` |
| `{tsconfig.json,.eslintrc,.eslintrc.*,.eslintignore,eslint.config.*,.stylelintrc,.stylelintrc.*,.stylelintignore,stylelint.config.*,.prettierrc.*,prettier.config.*,jest.config.*,lint-staged.config.*,.lintstagedrc*}` | forbidden, external; nowhere at the app root: each side holds exactly its managed tool configuration (be.tool-config, fe.tool-config) and the root only the formatter (app.format-config) | `app.tool-config-local` |
| `{sonar-project.properties,codecov.yml}` | required, tracked, generated by hfs sync (quality-config) | `app.quality-config` |
| `.husky/{pre-commit,pre-push}` | required, tracked, generated by hfs sync (hooks) | `app.hooks` |
| `.github/workflows/ci.yml` | required, tracked, generated by hfs sync (ci-workflows) | `app.ci` |
| `.github/workflows/e2e.yml` | optional, tracked, generated by hfs sync (ci-workflows) | `app.ci-e2e` |
| `.github/workflows/images.yml` | required, tracked, generated by hfs sync (ci-workflows) | `app.ci-images` |
| `.dockerignore` | required, tracked, generated by hfs sync (docker-ignore) | `app.dockerignore` |
| `browser/` | opt-in, tracked | `app.browser` |
| `.github/{CODEOWNERS,pull_request_template.md,ISSUE_TEMPLATE/**,dependabot.yml}` | optional, tracked | `app.github-meta` |
| `scripts/{.gitkeep,*.mjs,*.cjs,*.ps1,*.sh}` | optional, tracked | `app.scripts` |
| `{be,fe}/` | required, tracked | `app.sides` |
| `.starciwork/` | required, tracked | `app.starciwork` |
| `.starcistacks/` | required, tracked | `app.starcistacks` |
| `.sops.yaml` | required, tracked | `app.sops` |
| `{**/node_modules/,coverage/,reports/,test-results/,**/*.tsbuildinfo}` | optional, ignored | `app.build-output` |
| `{.eslintcache,.turbo/,.scannerwork/,.sonar/,.jest-cache/,.cache/,.tools/}` | forbidden, external; ${STARCI_CACHE_HOME:-%LOCALAPPDATA%/StarCi/cache}/<repo>/<tool>/ (the canon presets set eslint --cache-location, jest cacheDirectory, turbo cacheDir, sonar.working.directory) | `app.tool-cache` |
| `{report*.json,*.tmp.json,%*%,nul,.artifacts/,.tmp-*,*-lint.json,lf.json,lt.json,*.log,design-plans/,.gitmounts/,.dat,vi-flat.txt}` | forbidden, external; agent scratchpad or the StarCi blob store (%LOCALAPPDATA%/StarCi/blobs), cited by {name, sha256} | `app.agent-output` |
| `{.worktrees/,worktrees/,.starciwork/worktrees/}` | forbidden, external; <lanes root>/<project>/<lane>/ (outside every repository) for a lane; a Kernel workflow's worktree is created and owned by Orca outside the app checkout, never tracked, and removed by the runtime's host-side controller once the workflow's finish marked it release-pending | `app.worktrees` |
| `{.env,.env.*,.secrets/,**/*.pem,**/*.key}` | forbidden, external; .starcistacks/<env>/secrets/<slug>.enc (at the app root); decrypted values only in memory or under %LOCALAPPDATA%/StarCi/secrets/<project>/<env>/ via *_FILE | `app.plaintext-env` |
| `{package.json,package-lock.json,hfs.json,README.md,.gitignore,.gitattributes,.husky/,.github/,.starciwork/,.starcistacks/,.sops.yaml,sonar-project.properties,codecov.yml,.prettierrc,.prettierignore,scripts/}` | forbidden, external; the app root: one package.json, lockfile, hfs.json, README, git and CI files, hooks, formatter, Sonar and Codecov configuration, scripts/, .starciwork, .starcistacks and .sops.yaml per app | `repo.side-root-forbidden` |
| `be/{tsconfig.json,tsconfig.build.json,src/tests/tsconfig.json,eslint.config.mjs,jest.config.js}` | required, tracked, generated by hfs sync (tool-config) | `be.tool-config` |
| `be/nest-cli.json` | required, tracked | `be.nest-cli` |
| `be/{.eslintrc,.eslintrc.*,.eslintignore,eslint.config.js,eslint.config.cjs,eslint.config.ts,eslint.config.mts,eslint.config.cts,.prettierrc.*,prettier.config.*,jest.config.ts,jest.config.mjs,jest.config.cjs,jest.config.json,jest.config.e2e.js}` | forbidden, external; nowhere: a back end has exactly the managed tool configuration (be.tool-config); a change to a rule or a flag is proposed in the .claude runtime | `be.tool-config-local` |
| `docs/{adr,runbooks,guides}/**/*.md` | opt-in, tracked | `repo.docs` |
| `docs/**/*.{png,svg,webp}` | opt-in, tracked | `repo.docs-media` |
| `packages/<pkg>/` | opt-in, tracked | `repo.packages` |
| `apps/<app>/Dockerfile` | required, tracked | `repo.app-image` |
| `{**/node_modules/,dist/,apps/*/dist/,packages/*/dist/,.next/,apps/*/.next/,coverage/,reports/,test-results/,**/next-env.d.ts,**/*.tsbuildinfo}` | optional, ignored | `repo.build-output` |
| `{**/__generated__/,apps/*/src/schema.gql}` | optional, ignored | `repo.generated` |
| `{.eslintcache,.turbo/,.scannerwork/,.sonar/,.jest-cache/,.cache/,.tools/}` | forbidden, external; ${STARCI_CACHE_HOME:-%LOCALAPPDATA%/StarCi/cache}/<repo>/<tool>/ (the canon presets set eslint --cache-location, jest cacheDirectory, turbo cacheDir, sonar.working.directory) | `repo.tool-cache` |
| `{report*.json,*.tmp.json,%*%,nul,.artifacts/,.tmp-*,*-lint.json,lf.json,lt.json,*.log,design-plans/,.gitmounts/,.dat,vi-flat.txt}` | forbidden, external; agent scratchpad or the StarCi blob store (%LOCALAPPDATA%/StarCi/blobs), cited by {name, sha256} | `repo.agent-output` |
| `{.worktrees/,worktrees/,.starciwork/worktrees/}` | forbidden, external; <lanes root>/<project>/<lane>/ (outside every repository) | `repo.worktrees` |
| `{.env,.env.*,.secrets/,**/*.pem,**/*.key}` | forbidden, external; .starcistacks/<env>/secrets/<slug>.enc (at the app root); decrypted values only in memory or under %LOCALAPPDATA%/StarCi/secrets/<project>/<env>/ via *_FILE | `repo.plaintext-env` |
| `be/e2e/` | forbidden, external; src/tests/e2e/ for specs; operational probes move to scripts/ or are deleted | `be.root-e2e` |
| `be/contracts/<app>/schema.graphql` | opt-in, tracked | `be.contract.graphql` |
| `be/contracts/<app>/openapi.json` | opt-in, tracked | `be.contract.openapi` |
| `be/contracts/<app>/events.json` | opt-in, tracked | `be.contract.events` |
| `be/contracts/<app>/events.pin.json` | opt-in, tracked | `be.contract.events.pin` |
| `be/apps/<app>/src/` | required, tracked, app kind api, at least 1 | `be.app.api` |
| `be/apps/<app>/src/` | opt-in, tracked, app kind worker | `be.app.worker` |
| `be/apps/<app>/src/` | opt-in, tracked, app kind cli | `be.app.cli` |
| `be/src/features/api/<feature>/` | required, tracked, trigger api, at least 1 | `be.feature` |
| `be/src/features/{api/,jobs/,reactors/,saga/}<feature>/application/` | required, tracked | `be.feature.application` |
| `be/src/features/saga/<saga>/` | opt-in, tracked, trigger saga | `be.feature.saga` |
| `be/src/features/saga/<saga>/steps/` | opt-in, tracked | `be.feature.saga.steps` |
| `be/src/features/saga/<saga>/compensations/` | opt-in, tracked | `be.feature.saga.compensations` |
| `be/src/features/{api/,jobs/,reactors/,saga/}<feature>/application/support/` | optional, tracked | `be.feature.application.support` |
| `be/src/features/api/<feature>/transport/http/` | optional, tracked | `be.transport.http` |
| `be/src/features/api/<feature>/transport/graphql/` | optional, tracked | `be.transport.graphql` |
| `be/src/features/{api/,reactors/,saga/}<feature>/transport/message/` | opt-in, tracked | `be.transport.message` |
| `be/src/features/webhooks/<provider>/` | opt-in, tracked, trigger webhooks | `be.feature.webhooks` |
| `be/src/features/webhooks/<provider>/transport/http/` | opt-in, tracked | `be.feature.webhooks.http` |
| `be/src/features/webhooks/<provider>/transport/http/dto/` | opt-in, tracked | `be.feature.webhooks.dto` |
| `be/src/features/realtime/<channel>/` | opt-in, tracked, trigger realtime | `be.feature.realtime` |
| `be/src/features/realtime/<channel>/transport/graphql/` | opt-in, tracked | `be.feature.realtime.graphql` |
| `be/src/features/realtime/<channel>/transport/graphql/dto/` | opt-in, tracked | `be.feature.realtime.dto` |
| `be/src/features/realtime/<channel>/transport/websocket/` | opt-in, tracked | `be.feature.realtime.websocket` |
| `be/src/features/cli/` | optional, tracked, trigger cli | `be.cli` |
| `be/src/modules/domain/<capability>/` | optional, tracked | `be.domain` |
| `be/src/modules/{domain,integrations}/<capability>/errors/` | optional, tracked | `be.errors` |
| `be/src/modules/{domain,platform,integrations}/<capability>/messages/` | optional, tracked | `be.domain.messages` |
| `be/src/features/api/<feature>/messages/` | optional, tracked | `be.feature.messages` |
| `be/src/modules/{domain,platform,projections}/<capability>/persistence/` | optional, tracked | `be.persistence` |
| `be/src/modules/platform/<capability>/` | required, tracked | `be.platform` |
| `be/src/modules/platform/event-bus/` | opt-in, tracked | `be.platform.event-bus` |
| `be/src/modules/platform/queue/` | opt-in, tracked | `be.platform.queue` |
| `be/src/modules/events/<service>/` | opt-in, tracked | `be.events` |
| `be/src/modules/queues/<queue>/` | opt-in, tracked | `be.queues` |
| `be/src/features/reactors/<reactor>/` | opt-in, tracked, trigger reactors | `be.feature.reactors` |
| `be/src/features/jobs/<job>/` | opt-in, tracked, trigger jobs | `be.feature.jobs` |
| `be/src/features/jobs/<job>/transport/queue/` | opt-in, tracked | `be.feature.jobs.queue` |
| `be/src/features/jobs/<job>/steps/` | opt-in, tracked | `be.feature.jobs.steps` |
| `be/src/modules/platform/jobs/` | opt-in, tracked | `be.platform.jobs` |
| `be/src/modules/projections/<name>/` | opt-in, tracked | `be.projections` |
| `be/src/modules/integrations/<provider>/` | optional, tracked | `be.integrations` |
| `be/src/modules/integrations/<provider>/model/` | opt-in, tracked | `be.integrations.model` |
| `be/src/tests/world/` | optional, tracked | `be.tests.world` |
| `be/src/tests/world/kit/` | optional, tracked | `be.tests.world.kit` |
| `be/src/tests/fixtures/` | optional, tracked | `be.tests.fixtures` |
| `be/src/tests/fixtures/builders/*.builder.ts` | optional, tracked | `be.tests.fixtures.builders` |
| `be/src/tests/fixtures/i18n/` | optional, tracked | `be.tests.fixtures.i18n` |
| `be/src/tests/integration/<capability>/*.integration-spec.ts` | optional, tracked | `be.tests.integration` |
| `be/src/tests/e2e/<area>/*.e2e-spec.ts` | optional, tracked | `be.tests.e2e` |
| `be/src/tests/contract/<provider>/*.contract-spec.ts` | optional, tracked | `be.tests.contract` |
| `be/src/tests/e2e/world/` | forbidden, external; src/tests/world/ (the only test infrastructure location; e2e/<area>/ holds only *.e2e-spec.ts) | `be.tests.e2e-world-retired` |
| `fe/{tsconfig.json,eslint.config.mjs,stylelint.config.mjs}` | required, tracked, generated by hfs sync (tool-config) | `fe.tool-config` |
| `fe/{.eslintrc,.eslintrc.*,.eslintignore,eslint.config.js,eslint.config.cjs,eslint.config.ts,eslint.config.mts,eslint.config.cts,.stylelintrc,.stylelintrc.*,.stylelintignore,stylelint.config.js,stylelint.config.cjs,stylelint.config.ts,stylelint.config.json,prettier.config.*,.prettierrc.*,lint-staged.config.*,.lintstagedrc*,turbo.json}` | forbidden, external; nowhere: a front end has exactly the managed tool configuration (fe.tool-config); the task graph is the app root's turbo.json (app.task-graph); a change to a rule or a flag is proposed in the .claude runtime | `fe.tool-config-local` |
| `fe/apps/<app>/{package.json,next.config.ts,tsconfig.json,postcss.config.mjs}` | required, tracked, app kind next, at least 1 | `fe.app.next` |
| `fe/apps/<app>/public/` | optional, tracked | `fe.app-optional` |
| `fe/apps/<app>/src/app/` | required, tracked | `fe.route` |
| `fe/apps/<app>/src/{proxy.ts,instrumentation.ts,instrumentation-client.ts}` | optional, tracked | `fe.source-root-pinned` |
| `fe/apps/<app>/src/{middleware.ts,middleware.js}` | forbidden, external; apps/<app>/src/proxy.ts: Next >= 16 renamed middleware to proxy and refuses the old name | `fe.source-root-retired` |
| `fe/apps/<app>/src/features/{pages,layouts,overlays}/<name>/` | required, tracked | `fe.feature` |
| `fe/apps/<app>/src/components/{blocks,composites,branches,leaves}/<name>/` | optional, tracked | `fe.components` |
| `fe/apps/<app>/src/hooks/<domain>/` | optional, tracked | `fe.hooks` |
| `fe/apps/<app>/src/modules/<capability>/` | required, tracked | `fe.modules` |
| `fe/apps/<app>/src/modules/api/` | optional, tracked | `fe.modules.api` |
| `fe/apps/<app>/src/modules/api/client.ts` | optional, tracked | `fe.transport.client` |
| `fe/apps/<app>/src/modules/api/outcome.ts` | optional, tracked | `fe.transport.outcome` |
| `fe/apps/<app>/src/modules/config/` | required, tracked | `fe.modules.config` |
| `fe/apps/<app>/src/modules/i18n/` | required, tracked | `fe.modules.i18n` |
| `fe/apps/<app>/src/modules/brand/brand.css` | optional, tracked | `fe.modules.brand` |
| `fe/apps/<app>/src/modules/routes/` | required, tracked | `fe.modules.routes` |
| `fe/apps/<app>/src/modules/types/` | optional, tracked | `fe.modules.types` |
| `fe/packages/<family>-ui/` | opt-in, tracked | `fe.package.ui` |
| `fe/packages/<family>-api/` | opt-in, tracked | `fe.package.api` |
| `fe/packages/<family>-api/src/client.ts` | optional, tracked | `fe.package.api.client` |
| `fe/packages/<family>-api/src/outcome.ts` | optional, tracked | `fe.package.api.outcome` |
| `fe/packages/<family>-i18n/` | opt-in, tracked | `fe.package.i18n` |
<!-- hfs:generated-end app-map -->

**Agent evidence is not tracked.** Evidence, logs, captures, UAT runs and draw rounds live in the blob store and the
runtime ledger; a record cites them by hash. The single exception is the accepted design direction image of a
ui-screen (`.starciwork/features/<feature>/ui/<name>/assets/<file>`), which is product content and is tracked. Initial and
intermediate draw images and prompt files are agent data.

## 5. Backend

The rules of this section are the owner-locked back-end convention of 2026-09-30. Each rule id (R..) is a row of the
catalog in section 12; the pattern files in `knowledge/patterns/be/` cite them and give the code forms.

### 5.1 Source tree

<!-- hfs:generated be-tree -->
```text
be/{tsconfig.json,tsconfig.build.json,src/tests/tsconfig.json,eslint.config.mjs,jest.config.js}                                                    required  be.tool-config
be/nest-cli.json                                                                                                                                   required  be.nest-cli
be/docs/{adr,runbooks,guides}/**/*.md                                                                                                              opt-in    repo.docs
be/docs/**/*.{png,svg,webp}                                                                                                                        opt-in    repo.docs-media
be/packages/<pkg>/                                                                                                                                 opt-in    repo.packages
be/apps/<app>/Dockerfile                                                                                                                           required  repo.app-image
be/{**/node_modules/,dist/,apps/*/dist/,packages/*/dist/,.next/,apps/*/.next/,coverage/,reports/,test-results/,**/next-env.d.ts,**/*.tsbuildinfo}  optional  repo.build-output
be/{**/__generated__/,apps/*/src/schema.gql}                                                                                                       optional  repo.generated
be/contracts/<app>/schema.graphql                                                                                                                  opt-in    be.contract.graphql
be/contracts/<app>/openapi.json                                                                                                                    opt-in    be.contract.openapi
be/contracts/<app>/events.json                                                                                                                     opt-in    be.contract.events
be/contracts/<app>/events.pin.json                                                                                                                 opt-in    be.contract.events.pin
be/apps/<app>/src/                                                                                                                                 required  be.app.api
be/apps/<app>/src/                                                                                                                                 opt-in    be.app.worker
be/apps/<app>/src/                                                                                                                                 opt-in    be.app.cli
be/src/features/api/<feature>/                                                                                                                     required  be.feature
be/src/features/{api/,jobs/,reactors/,saga/}<feature>/application/                                                                                 required  be.feature.application
be/src/features/saga/<saga>/                                                                                                                       opt-in    be.feature.saga
be/src/features/saga/<saga>/steps/                                                                                                                 opt-in    be.feature.saga.steps
be/src/features/saga/<saga>/compensations/                                                                                                         opt-in    be.feature.saga.compensations
be/src/features/{api/,jobs/,reactors/,saga/}<feature>/application/support/                                                                         optional  be.feature.application.support
be/src/features/api/<feature>/transport/http/                                                                                                      optional  be.transport.http
be/src/features/api/<feature>/transport/graphql/                                                                                                   optional  be.transport.graphql
be/src/features/{api/,reactors/,saga/}<feature>/transport/message/                                                                                 opt-in    be.transport.message
be/src/features/webhooks/<provider>/                                                                                                               opt-in    be.feature.webhooks
be/src/features/webhooks/<provider>/transport/http/                                                                                                opt-in    be.feature.webhooks.http
be/src/features/webhooks/<provider>/transport/http/dto/                                                                                            opt-in    be.feature.webhooks.dto
be/src/features/realtime/<channel>/                                                                                                                opt-in    be.feature.realtime
be/src/features/realtime/<channel>/transport/graphql/                                                                                              opt-in    be.feature.realtime.graphql
be/src/features/realtime/<channel>/transport/graphql/dto/                                                                                          opt-in    be.feature.realtime.dto
be/src/features/realtime/<channel>/transport/websocket/                                                                                            opt-in    be.feature.realtime.websocket
be/src/features/cli/                                                                                                                               optional  be.cli
be/src/modules/domain/<capability>/                                                                                                                optional  be.domain
be/src/modules/{domain,integrations}/<capability>/errors/                                                                                          optional  be.errors
be/src/modules/{domain,platform,integrations}/<capability>/messages/                                                                               optional  be.domain.messages
be/src/features/api/<feature>/messages/                                                                                                            optional  be.feature.messages
be/src/modules/{domain,platform,projections}/<capability>/persistence/                                                                             optional  be.persistence
be/src/modules/platform/<capability>/                                                                                                              required  be.platform
be/src/modules/platform/event-bus/                                                                                                                 opt-in    be.platform.event-bus
be/src/modules/platform/queue/                                                                                                                     opt-in    be.platform.queue
be/src/modules/events/<service>/                                                                                                                   opt-in    be.events
be/src/modules/queues/<queue>/                                                                                                                     opt-in    be.queues
be/src/features/reactors/<reactor>/                                                                                                                opt-in    be.feature.reactors
be/src/features/jobs/<job>/                                                                                                                        opt-in    be.feature.jobs
be/src/features/jobs/<job>/transport/queue/                                                                                                        opt-in    be.feature.jobs.queue
be/src/features/jobs/<job>/steps/                                                                                                                  opt-in    be.feature.jobs.steps
be/src/modules/platform/jobs/                                                                                                                      opt-in    be.platform.jobs
be/src/modules/projections/<name>/                                                                                                                 opt-in    be.projections
be/src/modules/integrations/<provider>/                                                                                                            optional  be.integrations
be/src/modules/integrations/<provider>/model/                                                                                                      opt-in    be.integrations.model
be/src/tests/world/                                                                                                                                optional  be.tests.world
be/src/tests/world/kit/                                                                                                                            optional  be.tests.world.kit
be/src/tests/fixtures/                                                                                                                             optional  be.tests.fixtures
be/src/tests/fixtures/builders/*.builder.ts                                                                                                        optional  be.tests.fixtures.builders
be/src/tests/fixtures/i18n/                                                                                                                        optional  be.tests.fixtures.i18n
be/src/tests/integration/<capability>/*.integration-spec.ts                                                                                        optional  be.tests.integration
be/src/tests/e2e/<area>/*.e2e-spec.ts                                                                                                              optional  be.tests.e2e
be/src/tests/contract/<provider>/*.contract-spec.ts                                                                                                optional  be.tests.contract
```
<!-- hfs:generated-end be-tree -->

Nothing else exists at `be/src/` level, and no `types`, `constants`, `utils`, `helpers`, `shared`, `common`, `testing` or
`exceptions` folder exists under `be/src/modules` or `be/src/features` (R01, R89). The unit specs are the
`<name>.service.spec.ts` files beside their services and the `<name>.cli.spec.ts` files beside their cli commands
(section 7). Files carry a role suffix from the closed
list of the slot manifest, `ruleParams.be.suffixes` (`module`, `command`, `handler`, `decorators`, `sql`, `rows`, ...); `use-case`, `repository`,
`store`, `worker`, `scheduler` and `dto` are not among them (R89).

### 5.2 Tiers and direction (R26 to R28)

<!-- hfs:generated be-tiers -->
| From \ to | app | feature | domain | events | queues | projections | integrations | platform | e2e | fixtures | package |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app | no | yes | yes | yes | yes | yes | yes | yes | no | no | yes |
| feature | no | no | yes | yes | yes | yes | yes | yes | no | no | yes |
| domain | no | no | yes, acyclic | yes | yes | no | yes | yes | no | no | yes |
| events | no | no | no | yes, acyclic | no | no | no | yes | no | no | yes |
| queues | no | no | no | yes | yes, acyclic | no | no | yes | no | no | yes |
| projections | no | no | yes | yes | no | yes, acyclic | yes | yes | no | no | yes |
| integrations | no | no | no | no | no | no | no | yes | no | no | yes |
| platform | no | no | no | no | no | no | no | yes, acyclic | no | no | yes |
| e2e | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| fixtures | no | no | yes | yes | yes | yes | yes | yes | no | no | yes |
| package | no | no | no | no | no | no | no | no | no | no | yes |
<!-- hfs:generated-end be-tiers -->

Type-only imports count. Every import across owners goes through the owner's single `index.ts`; inside one owner imports
are relative and never go through the owner's own `index.ts` (R30). Shared types that both platform and domain need go
down to platform or are passed as options. Only these three module tiers exist.

### 5.3 Persistence: one authority, one connection per database (R34 to R36, R83 to R86)

Schema changes only by migration. `synchronize` is the literal `false` everywhere, including e2e databases (e2e runs the
real migrations). There is no runtime DDL, no `dataSource.synchronize()`, no `migrationsRun`, no `CREATE|ALTER|DROP TABLE`
outside `persistence/migrations/**`, no entity or migration glob. The cli migrate command (`cli migrate run`, the root
script `npm run migrate`) is the only runner of migrations, once per connection, before api and worker start; the test
world runs them over the same connection list. Seed data is a cli seed command, never a migration. Entities and migrations live in `persistence/{entities,migrations}/` of
the capability that owns the table; the owner's `index.ts` exports `<c>Entities` and `<c>Migrations` and the app composes
them per connection. Migrations are `<epochMs13>-<kebab-name>.ts`.

One physical database is one connection (`hfs.json` `sides.be.connections`), one `<conn>.connection.ts`, one `<conn>.config.ts` and
one injector `Inject<Conn>EntityManager()` in `platform/database` (R84). The database is reached through that shared
`EntityManager`, injected with the named injector and called directly: `getRepository`, `@InjectRepository`,
`Repository<T>`, repository or store classes, QueryBuilder, a `DataSource` or `QueryRunner` outside `platform/database`,
the cli (slots `be.app.cli`, `be.cli`) and the test world (slot `be.tests.world`) do not exist; specs use the world's `world.db.<connection>` `EntityManager` (R83). A handler opens the transaction with
`this.entityManager.transaction(async (manager) => ...)` and only `manager` is used inside it.

Raw SQL is a `sql`-tagged `SqlText` constant in `persistence/<name>.sql.ts` of the owning capability; `.query()` accepts
only `SqlText` and numbered parameters; row shapes and mappers sit in `<name>.rows.ts` (R36, R68). SQL writes only its own
capability's tables and reads only tables of owners it may import, and every multi-row read is bounded (R86, R69, R77).

### 5.4 Errors, logging, filters (R37 to R40)

One error profile. `platform/errors` owns `DomainError`, the closed `ErrorKind`, the one kind-to-HTTP table, one REST
`ExceptionFilter` and one GraphQL `formatError` (HTTP 200 with `extensions.{code,kind}`), and masks undeclared errors (`INTERNAL`
and a generic message, detail only in the log). Each capability owns `errors/<c>.error.ts`: a code enum
(`<CAPABILITY>_<WHAT>`), an exhaustive `Record<Code, ErrorKind>` table and one error class. Expected refusals are
`Outcome<Value, Code>` values, returned; the transport turns one into the error with `unwrapOutcome`. A domain never
throws a platform error. Display text is resolved by code through the message catalog (R78). `platform/logging` (the
`Logger` port through `InjectLogger()`, enum identities from `<owner>.log-events.ts`, JSON lines) is mandatory;
`console.*`, the Nest logger and `winston` outside it are forbidden. Each app registers exactly one filter through
`APP_FILTER`. Every `catch` logs, rethrows or returns an outcome that carries the cause; an empty `catch {}` is forbidden.

### 5.5 Default deny (R41, R42)

`domain/identity` exports `AuthGuard`, `@Public({ reason: PublicReason.X })`, `@Roles()` and `@CurrentPrincipal()`. Every api
app registers `APP_GUARD` throttler, then the CSRF origin guard, then `AuthGuard`, and that chain is the only authentication
and authorization: no `@UseGuards`. A public operation carries `@Public({ reason: PublicReason.X })` with a member of the
closed `PublicReason` enum of `domain/identity` (`Health`, `AuthHandshake`, `SignedWebhook`, `CatalogRead`); a string or
another enum is refused. Webhooks use the shared signature verifier and compare secrets with `timingSafeEqual`. No
`@Body() x: unknown`, no `GraphQLJSON`, no `switch (input.operation)` in transport. The global `ValidationPipe` whitelists and
forbids unknown fields, every property of an input class carries the validators its type calls for (a string `@MaxLength`,
an enum `@IsEnum`, an array `@ArrayMaxSize`, a nested object `@ValidateNested()` with `@Type`), and pagination is by cursor
only: no `skip`, `offset`, `OFFSET` or page number. GraphQL has depth and complexity limits, and the auth and webhook
doors are strictly rate limited.

### 5.6 Configuration and secrets (R43, R44)

Only the file of `platform/config` that declares `EnvSource` (which also resolves `<KEY>_FILE`, and its typed readers)
touches `process.env`. Each capability and provider has `<name>.config.ts` (`parse<C>Config(env: EnvSource): <C>Options`, or
`<C>Options | null` for an optional integration) and `<name>.options.ts`. `main.ts` builds `EnvSource` once and passes options
to `AppModule.register(options)`; classes read them with `Inject<C>Options()`. `envConfig()`, `ConfigService`,
`@nestjs/config` and dotenv preloaders do not exist. A value typed `Secret` or `Url` by `platform/config` has no default of
any kind (no default argument, no `??` or `||` fallback, no `""`, `localhost` or `http://` literal): a secret, credential,
host, URL, remote port, bucket or database name has no default, and an optional integration is all-or-nothing: none of its
keys set gives `null`, some set stops boot naming the missing keys. No `process.cwd()` joined
with `src` or `.starcistacks`.

### 5.7 Background work (R46)

Background work is a transport. `transport/message/<event>.consumer.ts` (an `EventConsumer` of `platform/event-bus`) and
`features/jobs/<job>/transport/queue/<job>.processor.ts` (a `FencedProcessor` of `platform/jobs`) dispatch one command exactly as a resolver does.
Mechanisms live in `platform/event-bus` (Kafka behind a transactional outbox, with inbox, retry and dead letter), `platform/queue`
(BullMQ with the outbox relay and job schedulers) and `platform/jobs` (the fencing token). An app of kind `api` or `worker`
composes them; `@Cron`, `@Interval` and `@Timeout` exist nowhere, a schedule is a BullMQ job scheduler. A method named
`sweep*`, `deliver*`, `reconcile*`, `retry*` or `relay*` that no processor or consumer calls is a failure. A domain service
publishes `eventBus.publish(event, tx)` or enqueues `enqueueX(payload, tx)` inside its own transaction (knowledge/patterns/be/event-bus.yaml, queues.yaml, jobs.yaml).

### 5.8 Modules, features and injection (R29 to R33, R45, R85, R87, R88)

Features are grouped by trigger kind: `features/api/<feature>/` and `features/cli/`; a kind imports only `modules/*`, never
another kind, and only `be/apps/*` composes features. An api feature root holds `index.ts`, `<feature>.module.ts`,
`application/`, `transport/<protocol>/` and, when it has copy, `messages/` only. Inside one bounded context the handler
calls that context's domain service in one transaction, with no event; an event (through the outbox) only crosses
contexts or carries async work (`knowledge/patterns/be/api.yaml`). `application/` holds commands, queries, handlers and contracts: each message is a typed
`Command<R>`/`Query<R>` carrying one `params` (`ExecuteParams<T>` or `PublicExecuteParams<T>`), each handler
`extends ICQRSHandler` and overrides `process` as one call of an injected service; there is no use-case class, forwarder service or in-process event (R87).
A transport injects only the command or query bus, dispatches exactly one message, holds no logic, returns no envelope and takes no
`GraphQLJSON` (R88); a cli command is an action runner, not a transport, and has its own unit spec (R149). Each transport has exactly one Nest module `<feature>-<protocol>.module.ts`, plus one application
module; never one module per operation.

A capability module is `@Module` extending `ConfigurableModuleClass` from a typed `ConfigurableModuleBuilder<Options>`, and
its only registration method is `register`. Each capability has one representative module, registered exactly once per app
in `be/apps/<app>/src/app.module.ts` as `X.register({ isGlobal: true, ...options.x })`; it may import its own sub-modules as
plain imports. No module imports another capability's representative module; other capabilities reach it through its
injectors. `isGlobal: true` appears only at an app root and `@Global()` nowhere (R45).

Every infrastructure dependency arrives through a zero-argument `Inject<Thing>()` exported from its owner's
`<owner>.decorators.ts` over a `unique symbol` token; raw `@Inject(`, `ModuleRef`, `forwardRef` and property injection do
not exist (R85). Every feature and every transport module is composed by at least one app. Apps hold only `main.ts`,
`app.module.ts` and `<app>.options.ts`; an app has no spec (the e2e world boots it). Entrypoints exist only in `be/apps/*/src` (R33).

### 5.9 Query, transport and runtime safety (R68 to R77, R89, R90)

A statement is text plus numbered parameters; a runtime value never becomes part of the text (R68). A list read states its
bound, and a caller that needs every row pages by keyset instead of truncating (R69); a read never runs once per element of a
loop, the keys are read once (R77). Every outbound HTTP call goes through `platform/http` whose `timeoutMs` is required
(R70). A logger call names no credential and no personal identifier (R71). No type escape exists anywhere, specs included:
`as X`, `as never`, `x!`, `any` (R72). An `async` function awaits (R73). A migration's `down()` reverses its `up()` (R74). A
handler and a public method of an Injectable, Resolver or Controller declare their return type (R75). `JSON.parse` of
outside text sits inside a `try` (R76). Each raw infrastructure library (HTTP, cache, queue, scheduler, logger, date,
config, events) is imported only by its one owning platform or integration capability (R90). Each has an `eslint-be`
enforcer in `@starci/eslint-canon-be`; the input classes of R42 carry the `class-validator` decorators their types call for
(`input-bounded`).

### 5.10 Copy, time, delivery and transactions (R78 to R82)

Text a user reads - an error's display text, a notification's subject or body, a response's `message` or `description` -
comes from the owner's `messages/<owner>.messages.ts` catalog (Vietnamese and English) through the typed `MessageCatalog`
port and `InjectMessageCatalog()`, never a literal in source (R78). The catalog lookup takes an explicit locale:
`platform/i18n`'s `RequestLocale` (`InjectRequestLocale()`) resolves it inside a request (the authenticated user's stored
preference, else the first of `vi`/`en` named in `Accept-Language`, else `vi`) and a job resolves it from the message's
recipient (their stored preference, else `vi`) - never a call-site guess (knowledge/patterns/be/messages.yaml). The ambient
clock (`Date.now`, a bare `new Date()`, `performance.now`, `process.hrtime`, `Temporal.Now`, called or referenced) is read
only inside `platform/clock`; code and specs take the injected `Clock` (`InjectClock()`), so a spec can drive time with a `FakeClock` (R79). Delivery that can
repeat - a signed webhook a sender resends, a queue redelivering a message - is claimed through the shared inbox
(`InjectInbox()`, table `inbox_claims`, unique on `(source, event id)`, owned by `platform/inbox`): the first awaited
expression of the service method a consumer or signed-webhook handler dispatches to (a public `*.service.ts` method whose first parameter has an `eventId`) is `inbox.claim(source, eventId)` on a receiver typed `Inbox`, and a
`false` answer returns without effect (R80). A loop that catches an error and waits before trying again goes through
`platform/retry` (bounded attempts, exponential backoff with jitter, an abort signal), never a loop written at the call
site (R81). No transaction spans an external call: commit first and call out after, or enqueue an outbox message inside
the transaction (R82). Each has an `eslint-be` enforcer in `@starci/eslint-canon-be`.

### 5.11 Services of one product (R163 to R168)

A product with more than one back-end service keeps every service as a Nest app at `be/apps/<service>/` of the one repository
(R163): the apps share the `be/src` libraries and the one `package.json`, each has its own `Dockerfile` and builds its own
image, and no file of one service app imports a file of another (R168). In `.starcistacks/application-stacks.yaml` every api or
worker app is a `role: service` component (R165) and every image of the stack, own or third-party, is pinned: a digest or an
exact version, never a moving tag (R164); an own image is `<repo>/<service>:<x.y.z>` built from the app's Dockerfile, a service
the product does not own stays a pinned third-party image. The wire between services is a contract the consumer judges
itself against: a service keeps the snapshot of its GraphQL schema (R23, R113) and, for the messages it publishes, the literal
table `apps/<service>/src/events.ts` and its snapshot `be/contracts/<service>/events.json`; a consumer lists what it reads
in `apps/<app>/src/consumes.ts` and each entry must exist in the provider's snapshot at that version (R166). Messages travel
on the Kafka topics of `platform/event-bus` (a transactional outbox, a relay, retry and dead letters): a publisher writes the outbox row in its transaction, a consumer is a
`transport/message/<event>.consumer.ts` of a worker app, the receiver dedupes on the event id (inbox claim or an idempotent
state check) and a message that runs out of attempts waits in the dead letters. A saga is a chain of services reacting to each
other's events, never an in-process event: the failure is an event whose contract declares `compensates: "<event>"` and its
consumer undoes that step. Every consumed event is named by an e2e spec that boots the real apps through `useTestWorld`, and the
spec of a saga step also names the compensated event, so it drives the whole flow (R167). A saga is a declared pattern
(`patterns: ["saga"]` in hfs.json): its folder `be/src/features/saga/<saga>/` (the saga kind) holds an orchestrator, a versioned state, steps and a
compensation for every step (R169 to R173; `knowledge/patterns/be/saga.yaml`). See `docs/microservices.md` and the
`ecommerce-app` example (`identity`, `order`, `billing`).

## 6. Frontend

### 6.1 Source tree

<!-- hfs:generated fe-tree -->
```text
fe/{tsconfig.json,eslint.config.mjs,stylelint.config.mjs}                                                                                          required  fe.tool-config
fe/docs/{adr,runbooks,guides}/**/*.md                                                                                                              opt-in    repo.docs
fe/docs/**/*.{png,svg,webp}                                                                                                                        opt-in    repo.docs-media
fe/packages/<pkg>/                                                                                                                                 opt-in    repo.packages
fe/apps/<app>/Dockerfile                                                                                                                           required  repo.app-image
fe/{**/node_modules/,dist/,apps/*/dist/,packages/*/dist/,.next/,apps/*/.next/,coverage/,reports/,test-results/,**/next-env.d.ts,**/*.tsbuildinfo}  optional  repo.build-output
fe/{**/__generated__/,apps/*/src/schema.gql}                                                                                                       optional  repo.generated
fe/apps/<app>/{package.json,next.config.ts,tsconfig.json,postcss.config.mjs}                                                                       required  fe.app.next
fe/apps/<app>/public/                                                                                                                              optional  fe.app-optional
fe/apps/<app>/src/app/                                                                                                                             required  fe.route
fe/apps/<app>/src/{proxy.ts,instrumentation.ts,instrumentation-client.ts}                                                                          optional  fe.source-root-pinned
fe/apps/<app>/src/features/{pages,layouts,overlays}/<name>/                                                                                        required  fe.feature
fe/apps/<app>/src/components/{blocks,composites,branches,leaves}/<name>/                                                                           optional  fe.components
fe/apps/<app>/src/hooks/<domain>/                                                                                                                  optional  fe.hooks
fe/apps/<app>/src/modules/<capability>/                                                                                                            required  fe.modules
fe/apps/<app>/src/modules/api/                                                                                                                     optional  fe.modules.api
fe/apps/<app>/src/modules/api/client.ts                                                                                                            optional  fe.transport.client
fe/apps/<app>/src/modules/api/outcome.ts                                                                                                           optional  fe.transport.outcome
fe/apps/<app>/src/modules/config/                                                                                                                  required  fe.modules.config
fe/apps/<app>/src/modules/i18n/                                                                                                                    required  fe.modules.i18n
fe/apps/<app>/src/modules/brand/brand.css                                                                                                          optional  fe.modules.brand
fe/apps/<app>/src/modules/routes/                                                                                                                  required  fe.modules.routes
fe/apps/<app>/src/modules/types/                                                                                                                   optional  fe.modules.types
fe/packages/<family>-ui/                                                                                                                           opt-in    fe.package.ui
fe/packages/<family>-api/                                                                                                                          opt-in    fe.package.api
fe/packages/<family>-api/src/client.ts                                                                                                             optional  fe.package.api.client
fe/packages/<family>-api/src/outcome.ts                                                                                                            optional  fe.package.api.outcome
fe/packages/<family>-i18n/                                                                                                                         opt-in    fe.package.i18n
```
<!-- hfs:generated-end fe-tree -->

The front end's contract input is the back end's committed `be/contracts/<app>/` read in place (`hfs.json`
`sides.fe.reads`); the root `codegen` script (`scripts/codegen.mjs`) writes the ignored `__generated__/` from it. There is
no contract copy under `fe/`.

### 6.2 Rules

- **Direction.** route to feature; feature to components, hooks, modules; components descend blocks to composites to
  branches to leaves; hooks to modules; modules to modules, acyclic; apps never import each other (R27, R64).
- **`hooks/` are hooks (R56).** `hooks/<domain>/` holds React hooks (`use*.ts`, one hook per file) and one
  `<domain>.shared.ts` for shared non-hook helpers. Server readers (fetch and map, no React) live in
  `modules/api/<domain>/read-*.ts`, wrapped in React `cache()` when several blocks call them in one request.
- **Data transport (R50 to R52).** One client per front end: `fe/packages/<family>-api/src/client.ts` when the front end has
  several apps (or chooses to share it), else the app's `modules/api/client.ts`; it is the only `fetch`, with a timeout and
  `AbortSignal` and no module-level `let` for a token or locale. It returns
  `Outcome<T> = ok | refused (401/403, code) | invalid (issues) | not-found | unavailable (code, retryable)`. `401` and
  `403` become `refused`; a status is never collapsed into null and server text is never shown as a reason. Wire types
  are generated from `be/contracts/` (`codegen` writes the ignored `__generated__/`); GraphQL documents are `.graphql`
  files; `as GraphqlResult<T>` is forbidden. Client reads use SWR calling the client, server reads use the readers, both
  through the same client. Session checks happen in the data layer (`refused` navigates to sign-in), not only in a
  layout. One refresh mechanism per resource, poll or socket, never a hand-written poll loop.
- **Boundaries (R53, R54).** Every app has `app/global-error.tsx`, `app/[locale]/error.tsx`,
  `app/[locale]/not-found.tsx`, and a `loading.tsx` for each route group that reads data. `Suspense fallback={null}` is
  forbidden. Route files (page, layout, template, loading, not-found) hold no inline component, no drawing and no hook.
- **Server first (R55).** Route files are server components. `"use client"` appears only in the `index.tsx` of a block
  with interaction, in a leaf with intrinsic interaction, and in `error.tsx` and `global-error.tsx`. The i18n catalog is
  split by namespace and a client component receives only the `pick`ed part. `force-dynamic` is forbidden on a client
  page.
- **i18n (R58 to R60).** Every app uses `next-intl` with the `[locale]` segment, default locale `vi`, `localePrefix`
  `as-needed`, and `src/proxy.ts` (not `middleware.ts`) for locale routing. The next-intl stack (routing, navigation,
  request config) is written once per front end: `fe/packages/<family>-i18n` exports `createAppI18n` and each app's
  `modules/i18n/index.ts` calls it with its `messages/<locale>.json` (a one-app front end may keep the stack in its
  `modules/i18n/`). No display text at any tier (block, page,
  layout, `aria-label`, `title`, `placeholder`, `alt`) in any language; there is no escape comment. A single-language app
  still uses `next-intl` with one locale. Catalogs of all locales have the same key set (R60), a key the source reads exists in every locale and a key nothing reads is deleted (R106).
  `<html lang>` is set by the `[locale]` layout.
- **CSS and tokens (R61, R62).** Only Grammar tokens. The Common tier reads only Grammar role tokens; a family supplies
  their values. `app/globals.css` contains only `@import` and `@source` in the standard order and every `@source`
  resolves. Colour values live only in `modules/brand/brand.css`, set only declared Grammar brand tokens, in light and
  dark, checked against the brand record. Forbidden: `*.module.css`, class selectors in app CSS, `!important`, hex, oklch
  or rgb outside `brand.css`, declaring `--<family>-*` in an app, breakpoints outside the Grammar scale, raw `<select>`,
  `<input>`, `<textarea>`, `<button>` in product tiers. `@starci/stylelint-canon` runs like the ESLint canon.
- **Packages (R63).** A shared UI package is `fe/packages/<family>-ui`, built to `dist`, explicit `exports`, no
  `export *`, only composites, branches and leaves, no colour literal, no unused export. Family token values are a
  family entry of `@starci/grammar`.
- **Multiple apps (R64).** One independent `fe/apps/<app>` per app; shared code only through `fe/packages/*`. A design draft
  is a branch, not a second app. The `work/ui-screen@2` record declares `app`, a name from `hfs.json` `sides.fe.apps`.
- **Budgets (R65).** Connected units have at most 6 data hooks and 6 `useState`; component 300 lines; `index.tsx` 200;
  hook 200; module 400.

## 7. Tests

- Backend, four kinds by folder and suffix (R47): unit `<name>.<role>.spec.ts` beside its subject — required beside every file of a spec-required role of `ruleParams.be.unitRoles` (a service, a cli command) and beside a webhook or realtime door that has no service of its own, optional beside any other `ruleParams.be.logicRoles` file of a `coverage: required` slot —; integration
  `be/src/tests/integration/<capability>/*.integration-spec.ts` (`useTestWorld({ modules })`, real database, no HTTP); e2e
  `be/src/tests/e2e/<area>/*.e2e-spec.ts` (`useTestWorld({ apps })`); contract `be/src/tests/contract/<provider>/*.contract-spec.ts`
  (provider sandboxes, skipped without sandbox config).
- `be/src/tests/world/` is the only test infrastructure: `global-setup.ts`, `use-test-world.ts`, `fakes/<provider>/`
  (network-edge fakes with `failNext`, `replayWebhook`, `delay`, plus payload fixtures) and `test-world.config.ts` (the
  declaration the test-world library reads, in its one named form `export const { useTestWorld, useSandbox } = defineTestWorld({...})`: `stack`, per-service `stacks`, `fakes`). Nothing under `be/src/tests` overrides a provider or DI
  token: everything first-party is real, and so is every service of the app's own stack (`.starcistacks/<env>`:
  Postgres, Redis, Keycloak with its realm imported, a mail host, k3s through k3d with a local registry when the app drives
  Kubernetes). The library starts them behind toxiproxy, `global-setup.ts` attaches to a warm stack when it answers and
  otherwise starts its own, `global-teardown.ts` stops only what it started, and the world reads the services and the image
  versions from the stack at run time. A spec fails a real service through `world.infra.<service>.latency(ms)`, `.cut()` and
  `.restore()`, never by killing it. `fakes/<provider>/` is only for external SaaS the team does not operate (a payment
  gateway). One exception: a stack service that is stateless compute needing special hardware or an external model (GPU
  inference, a self-hosted embedding model) may be faked when its `stacks` entry in `test-world.config.ts` declares
  `{ fakedBy, reason }`; a stateful service (database, cache, identity, storage, mail, queue, search, or one with a persistent volume)
  never is (R47 `test-world-files`).
- Backend specs never skip themselves (R48 `spec-no-skip`: no `skip`, `skipIf`, `runIf`, `todo`, `only`, `xit`, and no conditional runner); the one skip is the test-world library's `useSandbox(...)`, which skips a contract spec when its sandbox config is absent; no app file, world helpers included, writes a skip. An integration or e2e spec passes `useTestWorld` one object literal (R47 `test-world-shape`). Every `fakes/<provider>/` with `payloads/*.json` needs a `contract/<provider>/*.contract-spec.ts` asserting `shapeOf(real)` equals `shapeOf(fixture)` (R47 `contract-fixture-guard`, helper named by `ruleParams.be.contractShape`).
- Integration, e2e and contract run by hand: no husky, lint-staged, default typecheck, coverage, Codecov upload or automatic
  CI; the e2e workflow is `workflow_dispatch` only (R12). `test:contract` is never part of `test` or `test:e2e`.
- Backend: one `be/jest.config.js` (preset `@starci/jest-preset`) with exactly the projects `unit`, `integration`, `e2e`
  and `contract`; ts-jest `diagnostics: false` and `isolatedModules: true`; types are checked by `typecheck` (unit specs
  and fixtures included) by the op gate and CI and by `typecheck:tests` (`be/src/tests/tsconfig.json`) for the world,
  integration, e2e and contract trees. `test:integration`, `test:e2e` and `test:contract` are each
  `npm run typecheck:tests && cd be && jest --selectProjects <name>`; `test` is `cd be && jest --selectProjects unit --coverage` (per-file 100 on the measured scope `hfs sync` renders: the files of the `ruleParams.be.logicRoles` roles inside the slots whose `coverage` is `required`, R204). Every script runs from the app root.
- A backend e2e boots the real apps through the world; it never hand-assembles a lane module. Fixtures are typed
  builders and doubles, not `as never` or `as unknown as`; they never import a feature. No `testing/` folder in
  `be/src/modules`. A spec does not read source code with `fs` (R48).
- Frontend: no tests by standard (R97): no spec, no e2e, no test runner, test script or test dependency under `fe/`, and no exception.
- Write or update the spec of the service or cli command you change; the op gate (`gate.mjs --tests`) and the hooks run only the affected unit specs. The whole suite runs only at push.

## 8. `.starciwork`, `.starcistacks`, secrets

- `.starciwork/` at the app root (one per app, for both sides) holds flat product records `features/<f>/<family>/<name>/index.yaml`, `br/<rule>/ac/<name>/`,
  `workspace.yaml`, `brand/`, `shell/index.yaml`, `_resources/{identities,environments,fixtures}/<slug>/resource.yaml`
  and accepted ui-screen assets. There is no `work/node` record (R08). `_derived/` is generated and not tracked.
- An identity record holds role, provider, realm and `custody.sealed: .starcistacks/<env>/secrets/identity-<slug>.enc`
  (R09; the path is app-relative, like every path a record names). UAT `accounts.yaml` selects an identity by role; several flows share one identity per role. A record that holds
  no secret uses `custody.provider: none`.
- `.starcistacks/` (at the app root, never under a side) is `application-stacks.yaml` plus `<env>/{README.md, environment.json,
  infra/{compose,k8s,terraform}, runtime/{config,env}, secrets/<slug>.enc, seeds/}`. There is no `runtime/files/`.
  `runtime/env/KEYS.md` names slugs only. The Sonar block is `owner: host` and points at `.claude/ext/sonar`. `DESIGN.md`,
  `deployment.json` and `k8s/` at its root do not exist (R10).
- Secrets exist only as sops `*.enc` at `.starcistacks/<env>/secrets/<slug>.enc`, sealed per `.sops.yaml`; the front end
  holds no secret. A decrypted value is never written into the app tree, ignored or not; it lives in memory or under `%LOCALAPPDATA%/StarCi/secrets/<project>/<env>/`
  and is passed by `*_FILE` (R06). Agents never read, print or commit a secret value and never generate or rotate keys.
  Owner ruling 2026-09-29: ONE shared master age identity (`~/.starci/master.identity`) decrypts every project's SOPS
  custody; every project's envelopes are encrypted to that one master recipient, and the stack text says so.

## 9. Shared tooling, formatter, pins, budgets

- Every config is a thin call into a `.claude` package: `starciBeConfig({ hfs })`, `starciFeConfig({ hfs })`,
  `@starci/tsconfig/{be,next}.json`, `@starci/prettier-config`, `@starci/jest-preset` (back end),
  `@starci/stylelint-canon` (front end), and the `@starci/hfs` CLI (`lint`, `check`, `sync`, `emit-contracts`, `explain`,
  `scaffold app`). Every managed file is generated by `hfs sync` at the app root and hash-checked (R05). The managed files are the slots whose `managedBy` is set in `slots.yaml`: at the app root `app.package-manifest`, `app.format-config`, `app.hooks`, `app.ci`, `app.quality-config` and the git files; per side `be.tool-config` and `fe.tool-config` (`appTokens` of the stylelint config derived from the `globals.css` files by `loadAppTokens`). `lint` (`hfs lint`:
  ESLint over `be/` with the BE canon and over `fe/` with the FE canon, the app check, stylelint over `fe/`) is the one lint
  gate and `lint:fix` its `--fix`; there is no front-end test script. An app defines and disables no rule (R16, R17). `noInlineConfig: true`: no `eslint-disable`, no
  `@ts-ignore`, no `@ts-expect-error` (R18). Every `@starci/*` package is installed from the npm registry at the exact
  version of `canon-pins.yaml` (`packages/README.md`).
- **Formatter.** Prettier only: `printWidth` 120, `tabWidth` 4, `semi` false, `singleQuote` false, `trailingComma`
  `all`. No ESLint formatting rule exists. Pre-commit runs `prettier --check` on the staged files, CI `npm run format:check` (R19).
- **Pins.** `canon-pins.yaml` holds exact versions. One version per dependency across the root and workspace manifests, root `overrides` for
  react, next and grammar, no nested copies (R14, R15). Raising a version is a change in `.claude` first, then each app
  moves to the new pin in its own upgrade lane. `tsconfig` extends `@starci/tsconfig` with `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `allowJs: false` and never lowers a flag (R22).
- **Size budgets.** Backend file 500 lines, function 80, `app.module.ts` 250, `index.ts` 60 exports, feature 250 source
  files. Frontend component 300, connected `index.tsx` 200, hook 200, module 400. The mechanism is no-growth
  (`HFS_SIZE_GROWTH`): a new file is inside the budget, a file already over its budget gains no lines against its parent
  commit. There is no baseline and no allowlist (R20). A duplicated block at or above the one threshold
  `ruleParams.<side>.duplicateBlock` of `slots.yaml`, and a helper defined twice under the same name, fail (R21).
- **Contracts.** The back end commits `be/contracts/<app>/schema.graphql` (and `openapi.json` of a typed operation table),
  written by `hfs emit-contracts` (`npm run contract:emit`); the front end reads them in place and keeps no copy (R23).

## 10. Gates

| Gate | Runs | Target | Rules |
| --- | --- | --- | --- |
| PC pre-commit | L0 only: `hfs work-hygiene` (staged `.starciwork` and `.starcistacks` paths, the secrets guard), ESLint per side on the staged files, stylelint on the staged CSS of `fe/`, `prettier --check` on the staged files; no typecheck and no test run (the op gate does types and the targeted specs) | seconds | R06, R07, R18, R19, R34, R40, R41, R43 to R45, R49, R55, R58, R61, R62 |
| PP pre-push | the release gate check, no test run, no typecheck, lint or format: `refs/backup/*` is allowed; `main` and `v*` tags only when HEAD carries an annotated `v[0-9]*` tag and the release cut recorded the full suite of HEAD (`<git common dir>/starci-release/<HEAD sha>.l4.json`); anything else is refused (`RIGHTS_PUSH_NOT_RELEASE`) | seconds | none |
| OS op settle | the op gate `scripts/gates/gate.mjs` over the op's changed files, forced every round of the op loop: the merge guard, `hfs lint --changed`, `codegen` and package builds, `tsc` per owning tsconfig, the slice's specs; only findings new against the base block (the workflow's previous checkpoint); `api settle` re-reads the attached gate JSON and READ digest and refuses a red `done` | per op | every file-level and owner-level rule in scope |
| LG land | the workflow's finish, the only time main is touched: `gate.mjs` over the whole workflow branch against its merge-base with main (merge guard included), `review.verify` of the exact head that lands, the branch rebased onto main, then main fast-forwarded and pushed; a green op before it is only a checkpoint on `wf-<workflowId>` | per workflow | as OS, over the whole branch, against the newest main |
| CI GitHub | `npm ci`, `npm run lint -- --sonar reports/lint.sonar.json` (the pinned `hfs lint`), `format:check`, `typecheck`, `npm test` (unit with the per-file coverage threshold), `build:be`, `build:fe`, the Sonar scan and gate | | every rule |
| SQ Sonar | the imported lint findings, duplication, cognitive complexity and coverage 100 on the measured files of the be coverage scope (the `ruleParams.be.logicRoles` roles of the `coverage: required` slots; overall, new code and per file; the be unit run's lcov, the same per-file 100 the unit project enforces) | | R20, R21 (second gate) |

A rule's gates are data in `rules.yaml`; adding a rule to a gate edits the manifest, not an app.

## 11. Done for an app

1. `hfs lint` has zero findings for every rule at the pinned version, and CI runs it.
2. The e2e run boots the real `AppModule` of every back-end app and is green when run by hand.
3. No feature or owner is left uncomposed or unmounted; no dead export.
4. `be/contracts/` equals what `hfs emit-contracts` writes, and the front end's generated types come from it.
5. `typecheck`, `lint`, `build:be`, `build:fe`, `test`, `format:check` and the Sonar gate are green.
6. `typecheck:tests` (back end) is green; integration, e2e and contract still run by hand. The front end has none of them.
7. `git status` is clean, with no untracked entry outside a slot marked `ignored`.

## 12. Rule catalog

Every rule is an error from 2.0. Finding code, then the rule. The pattern files cite these ids.

<!-- hfs:generated rules -->
| Id | Code | Law | Scope |
| --- | --- | --- | --- |
| R01 | `HFS_SLOT_UNDECLARED` | Every tracked path matches exactly one slot. | product |
| R02 | `HFS_SLOT_REQUIRED_MISSING` | A slot is missing a required file (feature `index.ts`, app `main.ts`, FE `global-error.tsx`), or the root README breaks its standard shape (title, description, standard sections in order, Work pointer, live badges only, no private URL). | product |
| R03 | `HFS_UNTRACKED_ROOT_ENTRY` | No untracked or ignored entry outside an `ignored` slot. | product |
| R04 | `HFS_GITIGNORE_BLOCK_DRIFT` | The managed `.gitignore` block equals its render. | product |
| R05 | `HFS_MANAGED_FILE_DRIFT` | A managed file equals its template render. | product |
| R06 | `HFS_PLAINTEXT_SECRET` | Secrets exist only as `.starcistacks/<env>/secrets/<slug>.enc`. | product |
| R07 | `HFS_AGENT_DATA_TRACKED` | `.starciwork` holds product records only. | product |
| R08 | `HFS_WORK_NODE_RETIRED` | Only flat family records, never `work/node`. | product |
| R09 | `HFS_IDENTITY_CUSTODY` | An identity points its secret at `secrets/identity-<slug>.enc`; UAT chooses by role. | product |
| R10 | `HFS_STACKS_SHAPE` | `.starcistacks` has the standard shape and the host Sonar owner. | product |
| R11 | `HFS_SONAR_CONFIG` | Sonar config is generated, with no host URL, importing the be lcov with the logic of be/src/modules (the coverage scope derived from the slot manifest) as the only coverage scope. | product |
| R12 | `HFS_E2E_IN_AUTOMATIC_GATE` | e2e never joins husky, coverage or automatic CI. | product |
| R13 | `HFS_CI_MISSING_CANON` | CI runs the pinned `hfs lint` (`npm run lint`), and a clone never redirects `core.hooksPath` away from husky. | product |
| R14 | `HFS_DEP_VERSION_SKEW` | One version per dependency in the workspace, a root `overrides` pin included, and npm is the only package manager. | product |
| R15 | `HFS_CANON_PIN_DRIFT` | Canon packages and frameworks match `canon-pins.yaml`. | product |
| R16 | `HFS_TOOL_CONFIG_LOCAL` | Configs only call the factories; no local rules. | product |
| R17 | `HFS_RULE_OFF_WITHOUT_REPLACEMENT` | The ESLint configuration (and a front end's stylelint configuration) is the rendered one-liner, so no rule is off, warned or redefined in a repository. | product |
| R18 | `HFS_INLINE_SUPPRESSION` | No inline suppression of any kind. | product |
| R19 | `HFS_FORMAT` | Prettier is the only formatter. | product |
| R20 | `HFS_SIZE_GROWTH` | Over-budget files do not grow; new files are inside budget. | product |
| R21 | `HFS_DUPLICATE_CODE` | No duplicated blocks or twice-defined helpers. | product |
| R22 | `HFS_TS_STRICT` | tsconfig extends `@starci/tsconfig` and lowers no flag; no assertion, `!` or `any` in product source. | product |
| R23 | `HFS_CONTRACT_SNAPSHOT_DRIFT` | The be side commits its contract snapshot and it equals the emit; the fe side reads it in place (be/contracts/). | product |
| R24 | `HFS_ARCH_CONFIG_UNREAD` | The machine reads `hfs.json`; zero files analysed is red. | product |
| R25 | `HFS_UNUSED_EXPORT` | No public export without a consumer; no source file nothing reaches. | product |
| R26 | `BE_TIER_DIRECTION` | The tier direction matrix; a shared package never imports an app. | product |
| R27 | `ARCH_OWNER_CYCLE` | No owner cycles, type-only included. | product |
| R28 | `BE_FEATURE_IMPORTS_FEATURE` | A feature never imports a feature. | product |
| R29 | `BE_FEATURE_SHAPE` | Feature root is `index.ts`, module, `application/`, `transport/<protocol>/`; `application/` never imports `transport/` or a protocol framework. | product |
| R30 | `BE_PUBLIC_SURFACE` | Every owner has one `index.ts`; cross-owner imports use it, same-owner imports are relative and never go through it; it holds only named `export { }` lines, no `export *`, no alias re-export (`export { X as Y }`, `export const Y = X`, `export type Y = X`, `export interface Y extends X {}`: one declaration has one name), at most 60 exports; cross-package imports use the package name and a declared export. | product |
| R31 | `BE_FEATURE_NOT_COMPOSED` | Every feature, transport module and capability module is composed by an app. | product |
| R32 | `BE_APP_COMPOSITION_ONLY` | Apps compose only; an app is proven by the e2e world (`useTestWorld({ apps })`), never by a unit spec. | product |
| R33 | `BE_ENTRYPOINT_ONLY_IN_APPS` | Entrypoints only in `be/apps/*/src`. | product |
| R34 | `BE_SCHEMA_AUTHORITY` | Migrations are the only schema authority, run only by the cli migrate command and the test world; `synchronize` is `false`. | product |
| R35 | `BE_SCHEMA_OWNER` | Entities and migrations live in the owning capability's `persistence/`; its `<c>Entities` and `<c>Migrations` are registered under exactly one declared connection, which every `Inject<Conn>EntityManager` of the capability names (no `CONNECTION` alias); only a platform capability the manifest lists as `perConnection` (the event-bus outbox, the job table) registers on several. | product |
| R36 | `BE_SQL_OUTSIDE_PERSISTENCE` | Raw SQL is `sql`-tagged `SqlText` in `persistence/<name>.sql.ts` of the owning capability; `.query()` takes only `SqlText`; no QueryBuilder. | product |
| R37 | `BE_ENTITY_IN_CONTRACT` | No ORM entity in a contract or transport type. | product |
| R38 | `BE_ERROR_HOME` | Errors live in the owning capability's `errors/` and extend `DomainError`. | product |
| R39 | `BE_ERROR_MASKED` | One filter per app; undeclared errors are masked. | product |
| R40 | `BE_LOGGER_REQUIRED` | `platform/logging` exists and its `Logger` port is the only logger; every `catch` logs, rethrows or returns a reasoned outcome, and a log call names its event with a member of an owner's `<owner>.log-events.ts` enum. | product |
| R41 | `BE_DEFAULT_DENY` | APP_GUARD plus `@Public({ reason: PublicReason.X })`; no `@UseGuards`; typed bodies; `timingSafeEqual`. | product |
| R42 | `BE_INPUT_BOUNDED` | Bounded input, cursor-only pagination, depth limits, rate limits; every property of an input class carries the `class-validator` decorators its type calls for; a door opened for `PublicReason.AuthHandshake` or `PublicReason.SignedWebhook` carries `RateTier.Strict` of `platform/http-security`. | product |
| R43 | `BE_CONFIG_OWNER` | Only `platform/config` reads `process.env`; config per capability. | product |
| R44 | `BE_SECRET_DEFAULT` | No default for a secret key or infrastructure URL. | product |
| R45 | `BE_MODULE_SHAPE` | `@Global` nowhere and `isGlobal: true` only at app roots; no cross-owner module imports; typed options; one module per transport; every handler and provider registered exactly once. | product |
| R46 | `BE_BACKGROUND_UNOWNED` | Every sweep, outbox or retry has a job or consumer composed by an app: the service that owns it (an api app) or a worker app scaled apart. | product |
| R47 | `BE_TEST_TOPOLOGY` | One jest config, projects `unit`, `integration`, `e2e` and `contract`, live by folder, `diagnostics: false`; unit specs are `<name>.<role>.spec.ts` beside the file they test: required for the roles of `ruleParams.be.unitRoles` (`<name>.service.spec.ts` beside a `<name>.service.ts`, `<name>.cli.spec.ts` beside a cli command `<name>.cli.ts` of `src/features/cli`), optional for any other logic role (`ruleParams.be.logicRoles`) inside a slot whose `coverage` is required, and nowhere else but beside a webhook or realtime door that has no service of its own (`<provider>.webhook.spec.ts`, `<channel>.gateway.spec.ts`, `<x>.subscription.spec.ts`) (every unit-tested subject has exactly one; any other `*.spec.ts` outside `be/src/tests/{world,integration,e2e,contract}` is a finding, including specs in apps), and the unit project collects coverage from the logic roles of the measured roots only (the scope derived from the slot manifest, R204) with a per-file threshold of 100 on lines, branches, functions and statements (`test` runs `--coverage`; `importHelpers` and `tslib`); `be/src/tests/world/` is the ONLY test infrastructure: `global-setup.ts` starts the app's own stack (`.starcistacks/<env>`, named by `stack` in `test-world.config.ts`, the declaration of the test-world library in its one named form `export const { useTestWorld, useSandbox } = defineTestWorld({...})` (a default export is not read): every service it declares runs REAL, behind toxiproxy, images and versions read from the stack at run time, never spelled in test source) or attaches to a warm one that answers, and runs the migrations once over the cli app's connections (the runner of the cli migrate command); `global-teardown.ts` stops only what its setup started; `use-test-world.ts` exports `useTestWorld({ apps } \| { modules })` (`world.apps.<name>.api`, `world.db.<connection>`, `world.infra.<service>` with `latency(ms)`, `cut()` and `restore()` on the real service, `world.fake.<provider>`, `world.waitFor`) and `fakes/<provider>/` holds the network-edge fakes (`failNext`, `replayWebhook`, `delay`, payload fixtures) of external SaaS the team does not operate ONLY: a fake of a service the stack declares is refused, except stateless compute that needs special hardware or an external model (GPU inference, a self-hosted embedding model), whose `stacks` entry in `test-world.config.ts` declares `{ fakedBy: <fake>, reason }` with a non-empty `reason` (a stateful service, or one with a persistent volume, is never accepted); it alone owns containers, DataSource, migrations and `process.env`; nothing under `be/src/tests` overrides a provider or DI token; `be/src/tests/integration/<capability>/*.integration-spec.ts` (`{ modules }`, with the real peer apps its client calls beside them as `apps`; real infrastructure, no HTTP door of ours), `be/src/tests/e2e/<area>/*.e2e-spec.ts` (`{ apps }`) and `be/src/tests/contract/<provider>/*.contract-spec.ts` (provider sandboxes, skipped without sandbox config, run only by `test:contract`, never by `test` or `test:e2e`) agree folder with suffix; an integration or e2e spec passes `useTestWorld` one object literal with plain keys (no variable, spread or computed key) and calls it; the contract layer skips only through the test-world library's `useSandbox(...)` when the sandbox config is absent (`sandbox.describe(...)`), and every `fakes/<provider>/` that serves payload fixtures (`payloads/*.json`) has a `contract/<provider>/*.contract-spec.ts` that references those fixtures and asserts `shapeOf(real)` equals `shapeOf(fixture)` (the helper `shapeOf` is named by `ruleParams.be.contractShape` of the slot manifest; fakes the test-world library provides are guarded by the library); no `.test.ts`, `int-spec` or `harness-spec`, no `live/` and no `be/src/tests/e2e/world`. | product |
| R48 | `BE_SPEC_QUALITY` | No source-reading specs; a spec asserts results or state, not only calls; no `as` and no `x!` in a spec (the borrowed rules of R72), no return-only generic (`<T>(value: unknown): T`), `unknown` handed back as a concrete type, `JSON.parse(JSON.stringify(x))` or `Object.assign(new X(), y)` returned as another type in a spec or a test fixture, and no `Date.now()`, argless `new Date()` or `process.env` (R79, R43); a unit spec (`<name>.service.spec.ts`) builds its subject with `Test.createTestingModule({ providers: [...] }).compile()` and `moduleRef.get(Subject)`: no `new` of the service, no `imports` key, no `override*` call, and no `jest.mock`, `jest.doMock`, `jest.unstable_mockModule` or `jest.requireMock` of an own module or a third-party library; it provides each infrastructure token from its `@starci/jest-preset` double (`mockEntityManager(...)` for an EntityManager token, `new FakeClock(...)`, `recordingEventBus()`, `recordingQueueOutbox()`, `fakeCache(...)`, `fakeLock(...)`, `fakeIds()`, `builder(...)(...)` or a plain literal of real values for an options token, `mock<T>()` for everything else; the token table is `ruleParams.be.specDoubles` of the slot manifest) and takes its EntityManager only from the kit's `mockEntityManager()` or `fakeTransaction()`, never an ad-hoc `jest.fn` object, and asserts exact values: ids from `fakeIds()` and dates from `FakeClock` are compared as themselves, never `expect.any(String)`, `expect.any(Number)` or `expect.any(Date)`; an e2e enters through transport, waits with `waitFor`, boots through `useTestWorld`, reads persisted state back and reaches no model provider. Test data is arranged by builders, which R98 to R101 hold. No spec of any layer skips, focuses or marks a test todo (`skip`, `skipIf`, `runIf`, `todo`, `only`, `xit`, `xdescribe`, `xtest`) and none selects its runner conditionally, and no file of the test tree (world, fixtures, kit) writes one either; the only skip is the test-world library's `useSandbox(...)` (`@starci/test-world`), which skips a contract spec when the sandbox config is absent. | product |
| R49 | `FE_ENV_OWNER` | Only `modules/config` reads the environment; no localhost fallback. | product |
| R50 | `FE_TRANSPORT_OWNER` | One `fetch` per front end, in the transport client: `fe/apps/<app>/src/modules/api/client.ts` of a one-app front end or `fe/packages/<family>-api/src/client.ts` shared by every app; timeout and abort; a client read is SWR whose key carries the identity of its result, and a mutation is tied to its resource. | product |
| R51 | `FE_HTTP_STATUS_COLLAPSE` | One `Outcome<T>` union per front end (the api slot's `outcome.ts`); 401 and 403 become `refused`. | product |
| R52 | `FE_WIRE_GENERATED` | Wire types generated from the be contract snapshots the fe side reads. | product |
| R53 | `FE_ERROR_BOUNDARY_MISSING` | Global, locale error, not-found and loading boundaries exist. | product |
| R54 | `FE_ROUTE_FILES_THIN` | Route files mount one owner; Next conventions (`proxy.ts`, metadata). | product |
| R55 | `FE_CLIENT_BOUNDARY` | Server first; `"use client"` only where allowed. | product |
| R56 | `FE_HOOKS_ARE_HOOKS` | `hooks/` hold hooks and one shared file per domain; a product hook is defined only there and imported through its index. | product |
| R57 | `FE_OWNER_REACHABLE` | Every owner is mounted; every href resolves to a route. | product |
| R58 | `FE_I18N_LITERAL` | No display text at any tier, no escape comment. | product |
| R59 | `FE_I18N_PLACEMENT` | `next-intl` with `[locale]`; the next-intl stack is written once per front end: `fe/packages/<family>-i18n` (`createAppI18n`) called by each app's `modules/i18n/index.ts`, or the only app's `modules/i18n/`. | product |
| R60 | `FE_I18N_CATALOG` | Same keys in every catalog, `pick` for clients. | product |
| R61 | `FE_STYLE_TOKEN_ONLY` | Token-only CSS; colour only in `brand.css`; every `@source` resolves (sub-check `FE_STYLE_SOURCE_UNRESOLVED`). Status colours follow HeroUI soft pairs: every status tone has `--<tone>-soft` and `--<tone>-soft-foreground` in light and dark, the soft foreground reaches 3:1 on its tint and on `--background`, body text 4.5:1, a solid tone is never text below 4.5:1, and text and icons take the soft foreground, never the solid tone. | product |
| R62 | `FE_NATIVE_FORM_CONTROL` | No raw form controls, native images or raw structural tags in product tiers; the grammar renders them. | product |
| R63 | `FE_PACKAGE_SHAPE` | Packages build to `dist` with explicit exports and no dead unit. | product |
| R64 | `FE_APP_ISOLATION` | Apps never import apps; ui-screen declares `app`. | product |
| R65 | `FE_SIZE_AND_STATE_BUDGET` | Hook and state budgets; no hand-written poll loop; keyed lists; everything an effect starts is released by its cleanup; no swallowed error or console. | product |
| R68 | `BE_SQL_INTERPOLATED` | SQL text carries no runtime substitution; values are numbered parameters. | product |
| R69 | `BE_QUERY_UNBOUNDED` | A read that can return many rows states `take`, `limit` or `LIMIT`, or pages by cursor. | product |
| R70 | `BE_HTTP_TIMEOUT` | Every outbound `fetch`, axios or HttpService call states a timeout or an abort signal. | product |
| R71 | `BE_LOG_SECRET` | A `Logger` call carries no `Secret` or `Pii` value and no credential or personal identifier by name; log an id or a masked form. A constructed error carries no `Secret` value and no text value named like a credential. | product |
| R72 | `BE_TYPE_ESCAPE` | No type escape in any file, specs included: no `as X` (only `as const`), `<X>y`, `x!` or `any` (the factory turns on the typescript-eslint rules `consistent-type-assertions` with `never`, `no-non-null-assertion` and `no-explicit-any`), no `Function` type, no `eval`. | product |
| R73 | `BE_ASYNC_NO_AWAIT` | An `async` function contains an `await`; otherwise it is not `async`. | product |
| R74 | `BE_MIGRATION_REVERSIBLE` | Every migration declares a `down()` that reverses its `up()`; never empty, never a bare throw. | product |
| R75 | `BE_RETURN_TYPE` | Handlers and public methods of an Injectable, Resolver or Controller declare their return type. | product |
| R76 | `BE_JSON_PARSE_UNGUARDED` | `JSON.parse` sits inside a `try` in its own function and fails as a typed outcome. | product |
| R77 | `BE_QUERY_IN_LOOP` | A read through the shared EntityManager does not run once per element of a loop; read once before the loop by key list. | product |
| R78 | `BE_USER_COPY_LITERAL` | A literal exception message, notification text or response copy comes from the per-capability messages catalog through the typed `MessageCatalog` port, not from source. | product |
| R79 | `BE_AMBIENT_CLOCK` | `Date.now`, a bare `new Date()`, `performance.now`, `process.hrtime` and `Temporal.Now` are referenced only inside `platform/clock`, specs included; code asks the injected `Clock` port and specs use `FakeClock`. | product |
| R80 | `BE_INBOX_DEDUPE_MISSING` | Every service method that takes a delivery (a public method of a `*.service.ts` whose first parameter has an `eventId`) makes `claim(source, eventId)` on the `Inbox` port its first awaited expression and returns early when the claim answers `false`; consumers and `SignedWebhook` controllers stay thin doors (R88) and dispatch to the handler whose service claims. | product |
| R81 | `BE_HAND_ROLLED_RETRY` | A loop that catches an error and waits before trying again goes through the shared `platform/retry` helper, never a hand-written loop. | product |
| R82 | `BE_TRANSACTION_EXTERNAL_CALL` | No transaction spans an external call; commit first and call out after, or write an outbox message inside the transaction. | product |
| R83 | `BE_UNNAMED_DATA_ACCESS` | The database is reached through the shared EntityManager, injected as a constructor parameter by the `Inject<Conn>EntityManager()` of a declared connection and called directly; no bare `@InjectEntityManager()`, `getRepository`, repository, QueryBuilder or property injection; a `DataSource` or `QueryRunner` only in `platform/database`, the cli (`be/apps/cli`, `be/src/features/cli`) and the test world `be/src/tests/world`, whose `world.db.<connection>` EntityManager the specs use. No class outside an application handler, a domain service or a platform persistence capability takes, holds or returns an `EntityManager`, `Repository`, `DataSource` or `QueryRunner` (a repository under any name, a store, dao, gateway or persistence wrapper included), no exported function whose first parameter is an `EntityManager` (a statement module), and no wrapper return type, awaited value or `provide:` token hands out a connection object. | product |
| R84 | `BE_CONNECTION_DUPLICATE` | One physical database is one connection and one `Inject<Conn>EntityManager()` injector declared once in `platform/database`; `hfs.json` connections, connection files, injectors and module registrations correspond one to one. | product |
| R85 | `BE_RAW_INJECT` | Every injected infrastructure dependency arrives through a zero-argument `Inject<Thing>()` from its owner's `<owner>.decorators.ts` over a `unique symbol` token; raw `@Inject(` exists only there, and every such token is exported so a spec can provide it; a constructor parameter of a provider is typed by a class or carries an `Inject<Thing>()`, never a bare primitive, `Map`, union or interface; the parameter that injects a port of the table `ruleParams.be.paramNames` of `slots.yaml` (`Clock`, `Logger`, `Cache`, `CommandBus`, `QueryBus`, `EntityManager`, an `*Options`) carries the name that table gives it. | product |
| R86 | `BE_SQL_TABLE_OWNER` | SQL writes only the tables of its own capability's entities, reads only tables of its own context (its own capability's, or a same-context capability it may import; a cross-context JOIN is refused), and every multi-row SELECT is bounded. | product |
| R87 | `BE_CQRS_SHAPE` | The application layer is CQRS: typed `Command<R>`/`Query<R>` messages carrying one `params`, handlers extending `ICQRSHandler` that override `process`, where `process` is one `return this.<service>.<method>(...)` and the handler injects only `*Service` classes and the Logger (no EntityManager, no branch, no loop, no second call); no use-case classes, forwarder services or in-process events (`EventBus`, `EventEmitter`, an RxJS `Subject`, a stored listener list); a message and an injected dependency are `readonly`. | product |
| R88 | `BE_TRANSPORT_SHAPE` | A transport handler (a controller, resolver, gateway, consumer or job; a cli command is an action runner, R149) maps its input, dispatches exactly one command or query through the injected bus and maps the result; it injects nothing else (no EntityManager, no Inbox), holds no branch, loop or other call besides pure mapper functions and `unwrapOutcome` of `platform/primitives`, returns no envelope and takes no `GraphQLJSON`. | product |
| R89 | `BE_SOURCE_FORM` | Files use the closed role-suffix vocabulary of the slot manifest, `ruleParams.be.suffixes`; named exports only; every export has English JSDoc (its public members: R109); no emoji, and no Vietnamese in identifiers, string literals, comments or test titles outside message catalogs and the i18n fixtures slot; a public input or output is a named contract, never an inline object type; no `Mock*`, `Fake*` or `Stub*` class, function or constant in production source. | product |
| R90 | `BE_INFRA_OWNER` | Each raw infrastructure library (HTTP, cache, queue, scheduler, logger, date, config, events) is imported or referenced only by its one owning platform or integration capability, and the `HttpClient` port of `platform/http` is called only by an `integrations` capability. | product |
| R91 | `FE_SOURCE_FORM` | Front-end files sit in their tier folder with the fixed names, export arrow functions named after the folder, carry English JSDoc, no emoji, and no Vietnamese in identifiers, string literals, comments or test titles outside the i18n catalogs and the i18n e2e fixtures slot. | product |
| R92 | `FE_COMPONENT_API` | A component exposes the canon surface: typed named props and slots, a presentational twin for every connected block, status through the slot view, no className or CSS doors, no resting twin or placeholder prop, class names in the colocated file; a pure component reaches no hook, router, locale or API. | product |
| R93 | `FE_VENDOR_BOUNDARY` | Vendor primitives and icons reach components only through their named owner: heroicons through the icon leaf at the glyph scale, every vendor primitive behind a named owner; the Grammar package is imported only through its selected code and style entry and keeps its declared contract. | product |
| R94 | `FE_SLOT_FILE_ROLE` | A front-end file is owned by a slot and named by it: a slot that owns a directory (route, feature, components, hooks, api module) holds only the files its `allows` list names, and holds them inside a folder of its own. | product |
| R95 | `BE_OPERATION_CONTRACT` | A versioned operation is declared once in the app's typed operation table (`OperationContract<Input, Output, RefusalCode>` registered by `defineOperations`): its input and output are closed types (never `any`, `unknown` or `Record<string, unknown>`), its refusal codes a closed union of string literals, and the route that serves the table takes `OperationRequest<Table>` and answers `Promise<OperationReply<Table>>` of that one table. | product |
| R96 | `HFS_DOC_NOT_ENGLISH` | Every Markdown and YAML document under a side's docs/, src/ and apps/ (be/, fe/) and under the runtime's knowledge/ and docs/ is English, code fences included; only YAML data in a message-catalog or i18n-fixtures slot may hold another language. | product |
| R97 | `FE_NO_TESTS` | The front end (`fe/`) has no tests by standard: no `*.spec.*`, `*.test.*` or `*-spec.*` file, no `e2e/`, `__tests__/`, `__mocks__/` or `test-support/` directory, no vitest, Playwright, jest or Cypress configuration or setup file, no test script, and no test-runner, test-environment, testing-library or axe dependency in any `package.json`; there is no exception, `scripts/` included. | product |
| R98 | `BE_TEST_BUILDER_HOME` | A test data builder lives only in `be/src/tests/fixtures/builders/<area>.builder.ts` (slot `be.tests.fixtures.builders`, its SQL text in `<area>.sql.ts` beside it): a `*.repository.ts`, `*.factory.ts` or `*.fixture.ts` under `be/src/tests` and a `*.builder.ts` elsewhere are BE_SOURCE_FORM findings, and any other module of the test tree that exports a function creating persisted rows through an EntityManager, DataSource or QueryRunner is a builder in the wrong place. | product |
| R99 | `BE_TEST_ROW_BY_BUILDER` | A unit, integration or e2e spec never hand-builds rows: no raw INSERT/UPDATE/DELETE text, no `save`, `insert`, `upsert`, `update`, `delete` or `remove` on an EntityManager, DataSource or QueryRunner, and no persistence entity built as an object literal more than once in the spec; rows come from the area's builder. | product |
| R100 | `BE_TEST_CONSTRAINTS_ON` | Nothing under `be/src/tests` disables or drops a database constraint: no `session_replication_role`, `SET CONSTRAINTS ... DEFERRED`, `DEFERRABLE INITIALLY DEFERRED`, `ALTER TABLE ... DISABLE`, `DISABLE TRIGGER`, `DROP CONSTRAINT`, and no `dropForeignKey(s)`, `dropCheckConstraint(s)` or `dropUniqueConstraint(s)` on a QueryRunner; a builder creates the parent chain instead. | product |
| R101 | `BE_TEST_BUILDER_ARRANGES` | A test data builder arranges data only: it imports no assertion or test-framework global (`expect`, `jest`, `@jest/globals`) and its defaults are deterministic (no `Date.now()`, argless `new Date()`, `Math.random()`, `randomUUID()` or `crypto.random*`). | product |
| R102 | `BE_SPEC_PLACEMENT` | A back-end spec or test file lives in one of the four test layers and nowhere else: a unit spec of a unit-tested role (`ruleParams.be.unitRoles`: `<name>.service.spec.ts` beside its service, `<name>.cli.spec.ts` beside its cli command), or an integration, e2e or contract spec under `be/src/tests/{integration,e2e,contract}`; a `*.spec.*`, `*.test.*` or `*-spec.*` file anywhere else, `scripts/` and `tools/` included, is a finding. | product |
| R103 | `HFS_REPO_LOCAL_CHECK` | A repository keeps no check, lint rule or lint plugin of its own: no `check-*` file in `scripts/` or `tools/`, no `eslint-local-rules*` or local eslint plugin, no script that runs one; every check lives in the `.claude` runtime and the canons. | product |
| R104 | `HFS_LINT_SUPPRESSION_FILE` | A repository keeps no lint-suppression file, script or option: no `eslint.suppressions*`, no `lint:suppressions` script, no eslint `--suppress-all` or `--suppressions-location` flag and no suppressions configuration passed to eslint; a finding is fixed in the code. | product |
| R105 | `HFS_PROOF_COMMAND_FILE_MISSING` | A proof command of a `.starciwork` record (`requiresProof.<kind>.command`) is runnable as written: every repository file it names exists. | product |
| R106 | `FE_I18N_KEYS` | The catalogs of a front-end app and its source agree both ways: a literal key read through `next-intl` (`useTranslations`, `getTranslations`, `t`, `t.rich`, `t.raw`, `t.markup`) exists in every locale, and a catalog key that no string of the app's or the shared packages' source can be reading is deleted. | product |
| R107 | `FE_COOKIE_ATTRIBUTES` | A cookie the front end writes through Next's response cookies (`response.cookies.set`, `cookies().set`) states `httpOnly` as a literal (`true` for a session, `false` only for a preference page script reads), carries `secure` and has `sameSite` `lax` or `strict`. | product |
| R108 | `BE_ERROR_CAUSE_DROPPED` | A `throw` that escapes a `catch` (or a promise `.catch` handler) rethrows the caught value or carries it: the replacement capability error takes the exact caught value as `cause`; a `catch` with no binding throws nothing new. | product |
| R109 | `BE_MEMBER_DOC_MISSING` | Every public member of an exported class, interface or object type alias in product source opens with English JSDoc: methods, accessors, fields and signatures; a private, protected or `#` member, the constructor, an index signature and a property set to a literal or a named constant are not judged, and overloads of one name share one doc. | product |
| R110 | `FE_PROPS_MUTABLE` | The props type of an exported rendering function in front-end product source is readonly all the way down: every field and index signature is `readonly`, and every collection it holds, directly or in a nested object, is `readonly T[]`, `readonly [A, B]` or `ReadonlyArray<T>`. | product |
| R111 | `HFS_PEER_INTEGRATION_MISSING` | An app declares the runtime peer every driver integration it uses needs: when the app root package.json depends on every package of a pair of knowledge/hfs/peer-integrations.yaml (at the named major), it declares the pair's `requires` in its dependencies (`@nestjs/apollo` on `@nestjs/platform-express` 11, Express 5, needs `@as-integrations/express5`). | product |
| R112 | `BE_INTEGRATION_SPEC_MISSING` | Every integration of a back end (`src/modules/integrations/<provider>/` holding `<provider>.config.ts`) has at least one `src/tests/integration/<provider>/*.integration-spec.ts` that, read as a syntax tree, calls `useTestWorld({ modules })` with a factory registering the integration's own module (`<Provider>Module.register`, imported from the integration folder; an inline array, a local const or an exported const of another file), references the ErrorCode enum the integration exports, and drives an outage through the world (`world.infra.<service>.cut\|latency\|during\|connection`, `world.fake.<name>.failNext`, `world.apps.<peer>.during`, `world.interruptDatabase`); the finding sits on the integration folder. | product |
| R113 | `FE_GRAPHQL_CONTRACT` | Every GraphQL operation a front end keeps in a `.graphql` file under `fe/` is one its back end serves: it is judged against the contract snapshot (`be/contracts/<service>/schema.graphql`) whose root type declares its first root field, and every selected field, argument and input field must be declared there, every required argument and required input field given, every variable passed with the argument's named type, every leaf selected without and every object with a selection, and every declared variable used; a root field no contract declares is a finding too. | product |
| R114 | `RT_EXTERNAL_OWNER` | In the runtime repository a process, the network, SQLite or an external binary is reached only by its owner in ruleParams.runtime.infraOwners of knowledge/hfs/runtime-slots.yaml: an owned module specifier, global or spawned program word is used only by the files of scripts/api/<system> or engine/db that the map names. | runtime |
| R115 | `RT_TIER_DIRECTION` | Every relative import between two runtime owners goes from a tier to a tier its mayImport lists in tiers.runtime of knowledge/hfs/runtime-slots.yaml; owner cycles are ARCH_OWNER_CYCLE. | runtime |
| R116 | `RT_BASE_IMPURE` | The runtime base tier (the engine foundation and scripts/lib) never writes the filesystem and reads process.env only in a declared seam of ruleParams.runtime.baseEnvSeams. | runtime |
| R117 | `RT_API_SHAPE` | A call file of scripts/api/<system>/ exports exactly one function named in camelCase after the file; only the files of its own system import its lib.mjs; no api system imports another; a system with a calls contract has a call file only for a call id the contract declares. | runtime |
| R118 | `RT_SPEC_PLACEMENT` | A runtime spec is tests/<area>/<module>[.<topic>].spec.mjs, shared spec code is tests/helpers/<name>.mjs, preloads tests/setup/<name>.mjs and data tests/fixtures/**; a package spec sits beside its source as <name>.spec.*; no file uses the .test. suffix. | runtime |
| R119 | `RT_SOURCE_NAME` | A runtime source file is named <kebab-name>.mjs, never a one-off of ruleParams.runtime.oneOffNames (_*, tmp-*, fix-*, *-backfill, migrate-*, *-old, *.bak*), and its basename is unique inside its tier except lib.mjs and index.mjs. | runtime |
| R120 | `RT_RETIRED_PRESENT` | No path of retired[] and no `from` of moved[] in modules/kernel/retired-paths.yaml is tracked again, and no symbol of its retiredSymbols[] is declared in runtime production code. | runtime |
| R121 | `RT_GENERATED_DRIFT` | A generated root of ruleParams.runtime.generated is git-ignored output of its declared generatedBy: the repo's check regenerates every root, the runtime copies (packages/hfs/runtime, packages/eslint/be/runtime, packages/eslint/fe/runtime) are judged equal to what scripts/hfs/sync-runtime.mjs writes from the single source, and no git-tracked path lies under a generated root. | runtime |
| R122 | `RT_CITED_PATH_MISSING` | A runtime path cited by live prose or contracts (modules outside the contract history, docs, skills, knowledge, CONTEXT.md, README.md, CONTRIBUTING.md, init, the ui docs) exists; a retired or moved path is cited only by history. | runtime |
| R124 | `RT_PINNED_PATH_MOVED` | A pinned path of ruleParams.runtime.pinned (persisted outside git) exists, or moved through a modules/kernel/retired-paths.yaml moved[] entry marked quiesced: true, landed with the workers stopped. | runtime |
| R125 | `RT_NODE_MODULES_LINK` | No runtime source creates a junction or a symlink for a node_modules folder, through node:fs (symlink, symlinkSync, directly or through a local wrapper) or a spawned link command (mklink /J or /D, New-Item -ItemType Junction or SymbolicLink, ln -s): every checkout installs its own dependencies with a real npm ci from the cache. | runtime |
| R126 | `RT_CONTROL_CHARACTER` | Tracked text source of the runtime (*.mjs, *.cjs, *.js, *.ts, *.tsx, *.yaml, *.yml, *.md, *.json outside the generated copies) holds no raw control character (U+0000 to U+001F except tab, LF and CR, and U+007F); the character is written as its escape. | runtime |
| R127 | `RT_ABSOLUTE_PATH` | No tracked file of the runtime holds a hard-coded absolute host path: a drive-letter path, a user-profile path (/Users/<name>/, /home/<name>/) or an expanded AppData path. Paths resolve from the runtime root, os.tmpdir(), the config or a state-root helper, and a spec builds every path and prompt fixture from its temp dir; %LOCALAPPDATA% as an unexpanded name is clean. In source the rule reads string and template literals and comments through the syntax tree (a URL and a generic drive-pattern regular expression are not paths); in yaml, json and md it reads line text. | runtime |
| R141 | `BE_COOKIE_ATTRIBUTES` | A cookie a back-end door writes through the response of Express or Fastify (`cookie`, `setCookie`) states `httpOnly: true`, `secure: true` and `sameSite` `lax` or `strict` in options typed with those literals, and `Set-Cookie` is never written as a header (`setHeader`, `append`, `header`); the call is recognised by where its signature is declared, never by the receiver's name. | product |
| R142 | `BE_AMBIENT_ID` | `randomUUID` of Node's crypto (named, namespace or global), the `v1`, `v4`, `v6` and `v7` generators of `uuid`, `nanoid` and `ulid` are used only inside `platform/ids`, specs included; code asks the injected `Ids` port (`ids.next()`) and specs use `fakeIds()`. | product |
| R143 | `HFS_MONO_WORKSPACES` | Every app is a monorepo, even with one service: the app root package.json declares `workspaces` exactly `["fe/apps/*", "fe/packages/*"]`, `packageManager` as `npm@<exact version>` and `turbo` in its devDependencies (at the canon pin), the app root holds the one `package-lock.json` and the managed `turbo.json` (app.task-graph: build, dev, lint and typecheck, build depending on `^build` with cached `.next` and `dist` outputs). | product |
| R144 | `HFS_MONO_FE_WORKSPACE` | Every fe app `fe/apps/<app>` is an npm workspace: its `package.json` is named `@<project>/<app>`, is private, declares its own runtime dependencies and has exactly the scripts `build: next build`, `dev: next dev`, `lint: hfs lint --workspace .`, `start: next start` and `typecheck: tsc --noEmit`; every fe package `fe/packages/<pkg>` is private with `build`, `typecheck` and the same workspace `lint` script. | product |
| R145 | `HFS_MONO_NEST_PROJECTS` | The back end is a Nest monorepo of `be/apps/<app>`, even with one service: `be/nest-cli.json` is `"monorepo": true`, its default project (`root`, `sourceRoot`) is an api app, and its `projects` are exactly the be apps hfs.json declares, each `{"type": "application", "root": "apps/<app>", "sourceRoot": "apps/<app>/src"}`. | product |
| R146 | `HFS_MONO_WORKSPACE_DEP` | An fe workspace declares every package its files import (read with TypeScript's import pre-processor, its tsconfig path aliases excluded) in its own `package.json`, a sibling workspace package at `"*"`; the app root `package.json` never declares a workspace package. | product |
| R147 | `BE_CLI_REQUIRED` | Every one-off action of a back end lives in ONE app, `be/apps/cli` (kind cli, named cli): a back end that declares a connection (its migrations run as `cli migrate run`) or tracks a command under `src/features/cli/` declares exactly that app, and tracks its image `be/apps/cli/Dockerfile` (one image, run as `cli <group> <command>`). | product |
| R148 | `BE_CLI_BOOTSTRAP` | The cli app boots in its `main.ts` with `CommandFactory.run(...)` of nest-commander and never serves: `NestFactory.create*` of `@nestjs/core`, a `.listen()`, a microservice connection, an `@nestjs/platform-*` adapter or `@nestjs/microservices` in the cli app is refused (by the import that binds each name). | product |
| R149 | `BE_CLI_COMMAND_SHAPE` | A nest-commander command (`@Command` or `@SubCommand`, by the import that binds the decorator) is declared only in the cli feature root `src/features/cli/`: a group `@Command` in `<group>/<group>.cli.ts`, a `@SubCommand` extending `CommandRunner` in `<group>/subs/<name>.cli.ts`, one command per file, and every sub-command has its unit spec `<name>.cli.spec.ts` beside it (a command is an action runner, not a thin transport: R88 does not apply to it). `.cli.ts`, because `.command.ts` is the CQRS message. | product |
| R150 | `BE_CLI_OWNER` | `nest-commander` is imported only by the cli app and the cli feature root, and no back-end source parses command-line arguments itself: `process.argv` and the parsers commander, yargs and minimist are refused everywhere; a one-off action anywhere but a cli command is a door the rule closes. | product |
| R151 | `BE_EVENT_CLASS_CONTRACT` | Every typed event class `be/src/modules/events/<service>/<event>.event.ts` (one class with literal `static readonly eventName` and `version`, in a file named after its event: dots become dashes) equals an entry of the vendored contract `be/contracts/<service>/events.json` at the same name and version, and every entry of a vendored contract has its class; a class the contract does not list, a version mismatch, a contract entry with no class or a misnamed file is a finding (pattern event-bus). | product |
| R152 | `BE_OUTBOX_WRITE_TX` | The outbox is written only by a domain service, with the manager of its own transaction: `eventBus.publish(event, tx)` and a queue producer's `enqueueX(payload, tx)` are called only in a file of `modules/domain` (the test world, e2e and fixtures aside), and `tx` is the `manager` parameter of a `.transaction(async (manager) => ...)` callback or a function parameter typed `EntityManager`; the injected shared manager, an alias, an outer manager or a missing argument is a finding. The call is found by the receiver's TYPE (the `EventBus` port of platform/event-bus) or by the resolved signature's declaring tier (queues), never by a name. | product |
| R153 | `BE_EVENT_CONSUMER_SHAPE` | A class that implements the `EventConsumer` port of platform/event-bus (by type origin) is `transport/message/<event>.consumer.ts` (slot be.transport.message), its file stem is the kebab form of its event class's literal `eventName` (dots become dashes), and its `handle` reads `delivery.eventId` so the dispatched command carries the id the domain service claims in platform/inbox; a `.consumer.ts` that implements no `EventConsumer` is a finding. | product |
| R154 | `BE_QUEUE_PRODUCER_SHAPE` | In `modules/queues/<queue>/<queue>.queue.ts` every exported function or class method that writes the `QueueOutbox` port of platform/queue declares a `tx` parameter typed `EntityManager` and passes that parameter as the first argument of the write; a write with another manager, an outer manager or none is a finding (pattern queue). | product |
| R155 | `BE_PATTERN_SPEC_MISSING` | Every pattern a back end declares (hfs.json sides.be.patterns) is proven on the test world: each scenario id of ruleParams.be.patternScenarios.<pattern> has a test titled `<pattern>/<scenario>: ...` (the first argument of `it(` or `test(`) in an e2e or integration spec under be/src/tests; a declared pattern with a missing scenario is a finding. | product |
| R156 | `BE_KIND_ISOLATION` | No trigger kind imports another: a feature whose owner slot names one `trigger` (api, webhooks, realtime, saga, reactors, jobs, cli) never imports (static, dynamic, re-export or type-only) a feature of another kind; each kind imports only `modules/*` and only be/apps/* compose features. The kinds meet through the event bus: a domain service publishes `eventBus.publish(event, tx)` and the other kind consumes it. The importing and imported owners are read from the slot view (slot field `trigger`), never from a folder name; the finding replaces BE_FEATURE_IMPORTS_FEATURE when both features name different kinds. | product |
| R157 | `BE_JOB_WRITE_OUTSIDE_OWNER` | The job entity (the class `platform/jobs` declares in its persistence) is written only by `platform/jobs`: an `update`, `increment`, `decrement`, `save`, `insert`, `upsert`, `delete`, `remove`, `softDelete` or a query-builder write on it in any other file (the test world, e2e and fixtures aside) is a finding. The entity is found by the type origin of the call's arguments or builder chain, never by a name; raw SQL is judged by BE_SQL_TABLE_OWNER (pattern fenced-job). | product |
| R158 | `BE_JOB_FENCE_REQUIRED` | Every `JobClaims` method that takes a job (a parameter type with `jobId`) declares a required, non-nullable `expectedFencingToken: number`; no call on `JobClaims` outside `platform/jobs` casts around it (`as`, a type assertion or `!` in an argument); and a `catch` around a `JobClaims` write rethrows, so a `JobFencedOut` stops the zombie with no further effect (pattern fenced-job). | product |
| R159 | `BE_JOB_RUN_KEY` | In a job step (slot be.feature.jobs.steps) every call on a receiver typed by an `integrations` owner passes an argument of the `RunKey` type of `platform/jobs`, produced by `JobClaims.runKey(job, step)` (it includes the fencing token), never built with a cast; a read belongs in the application layer, not in a step (pattern fenced-job). | product |
| R160 | `BE_JOB_SHAPE` | A `<job>.processor.ts` exists only in `features/jobs/<job>/transport/queue/`, is named after its job and declares a class extending the `FencedProcessor` of `platform/jobs`; a `steps/<step>.step.ts` exists only in `features/jobs/<job>/steps/` and declares a class implementing `JobStep`; a class implementing `JobStep` exists nowhere else (pattern fenced-job). | product |
| R161 | `BE_PROJECTION_WRITE_OWNER` | A projection's entity (a class of `<name>.projection-entity.ts` in `modules/projections/<name>/`) is written only by the `<name>.projection.ts` of the same folder (the test world, e2e and fixtures aside): a write on it from a domain service, a handler, another projection or another file of the folder is a finding. The entity is found by the type origin of the write's arguments or builder chain (pattern projection). | product |
| R162 | `BE_PROJECTION_SHAPE` | Every public method of a `<name>.projection.ts` class is `recompute*` (idempotent write from the source facts) or `get*` (read); the `index.ts` of a projection exports nothing from a `.projection-entity` file; and a feature whose kind is api calls no `recompute*` method of a projection (it reads through `get*`). The kind is read from the owner slot's `trigger` (pattern projection). | product |
| R163 | `HFS_SERVICE_PLACEMENT` | A back-end service lives only at `be/apps/<service>/`: a folder with a `Dockerfile` of its own, or with a `package.json` other than the app root's and those of the fe workspaces (`fe/apps/<app>`, `fe/packages/<pkg>`), outside `be/apps/<service>/` (and outside a front end's `fe/apps/<app>/Dockerfile`) is a second service root and a finding; a service is a Nest app of the one repository that shares the `be/src` libraries and the one package.json, and its image is built from its own Dockerfile. | product |
| R164 | `HFS_IMAGE_UNPINNED` | In a product with more than one service (two or more be apps of kind api or worker) every component `image` of `.starcistacks/application-stacks.yaml` is pinned: a digest (`@sha256:<64 hex>`) or an exact version tag (`x.y.z`, optionally with a suffix); no tag, `latest`, a branch word or a major or minor-only tag is a finding. An own service image is `<repo>/<service>:<x.y.z>`, built from `be/apps/<service>/Dockerfile`; a service the product does not own stays a pinned third-party image. | product |
| R165 | `HFS_SERVICE_STACK_DECLARATION` | Every api or worker app `be/apps/<service>` of a product with more than one service is a component of the same name with `role: service` in `.starcistacks/application-stacks.yaml`. | product |
| R166 | `HFS_EVENT_CONTRACT` | The async contract between services is vendored under `be/contracts/<service>/events.json` (`starci/event-contract@1`, emitted by `hfs emit-contracts` from the literal `EVENTS` table of `be/apps/<service>/src/events.ts`, never written by hand) and equals that table; an event that undoes the step of another declares `compensates: "<event>"` and the named event must exist in a contract; a consumer declares what it reads in the literal `CONSUMES` table of `be/apps/<app>/src/consumes.ts` (service, event, version), every entry must exist in the provider's vendored snapshot at the same version, and a missing or stale snapshot, an unknown event or a version mismatch is a finding. | product |
| R167 | `BE_ASYNC_SPEC_MISSING` | Every event an app consumes (an entry of its `consumes.ts`) is named by an e2e spec, a file `be/src/tests/e2e/<area>/*.e2e-spec.ts` that boots the apps through `useTestWorld` (it publishes the event, reads the effect back and redelivers it); when the contract of the event declares `compensates: "<event>"` it is a saga step, and a spec naming it also names the compensated event, so the spec drives the whole flow: the step, the failure, then the compensated state. | product |
| R168 | `BE_SERVICE_ISOLATION` | A service app (`be/apps/<service>/`) imports no file of a sibling service app: the app that owns the importing file and the app that owns the file a specifier resolves to (a relative path or an alias of the program's own `compilerOptions.paths`) are read from the HFS slot view, and two different apps is a finding; services share only the `be/src` libraries and meet through the wire (a client of the sibling's API, or the events of its vendored contract under `be/contracts/<service>/`). | product |
| R169 | `BE_SAGA_STEP_COMPENSATION` | In a product that declares the `saga` pattern (`patterns: ["saga"]` in hfs.json sides.be) a saga is the folder `be/src/features/saga/<saga>/` (`<saga>.saga.ts` the orchestrator, `steps/<step>.step.ts`, `compensations/<step>.compensation.ts`): every step has a compensation of the same name and every compensation a step, the orchestrator imports every step and every compensation of its folder, and a folder of steps or compensations has an orchestrator; the folders themselves are slots enabled only by the declared pattern, so an undeclared saga is `HFS_SLOT_NOT_ENABLED`. | product |
| R170 | `BE_SAGA_STATE_VERSIONED` | Every saga orchestrator has `<saga>.saga-state.ts` beside it, whose exported state type declares `status` and `version: number`, and imports the fenced store of `platform/saga`: the persisted state of a run moves only through the store, every transition naming the version it read, so a zombie delivery cannot move a run twice. | product |
| R171 | `BE_SAGA_EVENT_CONTRACT` | A saga step and a saga compensation each name their event (`readonly event = "<name>"`), both events are declared in a vendored contract (`be/contracts/<service>/events.json`), and the contract of the compensation's event declares `compensates: "<event of the step of the same name>"`. | product |
| R172 | `BE_SAGA_CONSUMER_DEDUPE` | A consumer of a saga (`be/src/features/saga/<saga>/transport/message/<event>.consumer.ts`) passes the id of the delivery on (`message.eventId`) to the command it dispatches: the saga takes every event through the inbox (R80), so the consumer must hand it the dedupe key. | product |
| R173 | `BE_SAGA_E2E_MISSING` | Every compensation path of a saga has an e2e spec (`be/src/tests/e2e/<area>/*.e2e-spec.ts` through `useTestWorld`) that names the event of the compensation and injects a failure through the world (an outage of an infra service or an app with `during`, `cut` or `latency`, a fake's `failNext`, `interruptDatabase`): the compensation is proven under a fault, not only on the happy flow. | product |
| R174 | `BE_CONTEXT_OWNER` | A connection of hfs.json is a bounded context owned by one api or worker app (`owner`, `isolation` database or schema): an app composes only the connections and capabilities of the contexts it owns, and the migrate and cli apps compose every declared connection (migrations run only through them, once per connection). | product |
| R175 | `BE_CONTEXT_COUPLING` | Contexts are coupled only by events: no entity relation, no migration foreign key and no import (entities, services or SQL) of a domain or projection capability reaches a capability of another context. | product |
| R176 | `BE_CONTEXT_TRANSACTION` | One transaction touches one context's connection: inside `transaction(async (manager) => ...)` of a connection's entity manager no entity manager of another connection is used and no capability of another context is called; work across contexts is a saga. | product |
| R177 | `BE_CONTRACT_BREAKING` | An event contract evolves only additively: `be/contracts/<service>/events.json` against its pinned previous copy `events.pin.json` keeps every event, stream, version, payload field and type, adds only optional fields, and a breaking change is a new `<event>.v2` key. | product |
| R178 | `BE_CONTEXT_PLATFORM_TABLES` | A platform capability the manifest lists as `perConnection` (the event-bus outbox, the job table) has its entities and migrations registered on every connection whose entity manager is passed to it. | product |
| R179 | `BE_KIND_DECLARATION` | `hfs.json` `sides.be.kinds` lists exactly the trigger kinds (api, webhooks, realtime, saga, reactors, jobs, cli) the back end uses: a kind in use that is not declared, a declared kind with no feature, a declared kind whose patterns (`ruleParams.be.kindPatterns`, e.g. jobs needs fenced-job and queue) are missing from `sides.be.patterns`, and a declared kind whose platform capabilities (the tier-platform slots naming those patterns) are not tracked are each a finding. A kind is declared only when it is used; `hfs add <noun> <name>` creates the first member, the platform capabilities it needs and the registration. | product |
| R180 | `BE_KIND_EMPTY` | A kind folder `be/src/features/<kind>/` holds only instance folders `<kind>/<name>/`, and each instance holds TypeScript source: a file directly in the kind folder (a feature named like a kind, a `.gitkeep`) and an instance with no TypeScript file are findings; an empty kind folder is never kept. | product |
| R181 | `BE_SQL_RETURNING_SHAPE` | A `sql` constant that UPDATEs or DELETEs with RETURNING is wrapped as `WITH changed AS (UPDATE ... RETURNING ...) SELECT ... FROM changed`, because EntityManager.query returns a bare UPDATE or DELETE with RETURNING as `[rows, affectedCount]`, not as rows. | product |
| R182 | `BE_WEBHOOK_SHAPE` | A provider webhook door (`src/features/webhooks/<provider>/transport/http/<provider>.webhook.ts`) is one `@Controller` with one `@Post` handler declared `@Public({ reason: PublicReason.SignedWebhook })`; it injects only the `WebhookSignatureService` of `platform/http-security` and services of `modules/domain`, and its handler holds no branch, loop or `try`, calls only `verify` on the signature service and exactly one method of a domain service (the intake that records the delivery and publishes the event in its own transaction), and returns nothing. | product |
| R183 | `BE_WEBHOOK_UNVERIFIED` | The first statement of a webhook handler is the unconditional `verify` call of the `WebhookSignatureService` (signature and replay window): a delivery that fails the proof throws before any other code runs, so no path reaches the domain intake unproven. | product |
| R184 | `BE_REALTIME_SHAPE` | A realtime file is the one door its role names: `<channel>.gateway.ts` holds one `@WebSocketGateway` class with `@SubscribeMessage` handlers and `<x>.subscription.ts` holds one `@Resolver` class with `@Subscription` operations, and neither carries a query, a mutation, a field resolver, a REST route or the other protocol. | product |
| R185 | `BE_REALTIME_WRITES` | A realtime door reads and pushes only: the one value injected into it is the `RealtimeHub` of `platform/realtime`; no `EntityManager`, bus, queue, event bus or domain service reaches it. | product |
| R186 | `BE_REALTIME_TOPIC_SCOPE` | The topic a realtime handler passes to `RealtimeHub.subscribe` is built from the handler's `@CurrentPrincipal()` parameter of `domain/identity`, so a client can only listen to channels its principal owns. | product |
| R187 | `HFS_DOCKER_BUILD_CONTEXT` | Every app image is built from the app root: the header comment of an app's Dockerfile states `docker build -f <be\|fe>/apps/<app>/Dockerfile -t <image> .` for its own path, and no COPY or ADD source leaves the build context (a `..` segment or an absolute path). | product |
| R188 | `HFS_DOCKER_STAGES` | An app Dockerfile is multi-stage: a stage named `build` and a last stage named `runtime`; the runtime stage ends as `USER node` and runs no build (`npm run build*`, tsc, next, turbo, nest); every install is `npm ci`, never `npm install`; a back-end runtime runs `npm ci --omit=dev --ignore-scripts` and a front-end runtime installs nothing. | product |
| R189 | `HFS_DOCKER_ENTRY` | The runtime stage starts the app's own built entry in exec form (be `node be/dist/apps/<app>/src/main.js`, fe `node` on the standalone `server.js` of the app); an api or Next app sets `ENV PORT` and EXPOSEs the same port and carries a HEALTHCHECK, a worker carries a process HEALTHCHECK and exposes nothing, a cli app says `HEALTHCHECK NONE` and exposes nothing; a Next app's build stage runs `turbo run build --filter=@<project>/<app>` and its `next.config.ts` sets `output: "standalone"`. | product |
| R190 | `HFS_DOCKER_BASE_PIN` | Every FROM of an app Dockerfile is a prior stage, the one node base image of the canon (an exact node version on an exact alpine release, `NODE_IMAGE` in scripts/hfs/rules/docker.mjs), or an image pinned by `@sha256` digest; never a moving tag, never an unresolved build argument. | product |
| R191 | `HFS_DOCKER_SECRETS` | No secret enters an image: no COPY or ADD of an `.env*` file (except `.env.example`) or of a path under `.starcistacks`, `.secrets`, `.volume`, a key, certificate or kubeconfig; no ADD of a URL; no ARG or ENV whose name is a credential (PASSWORD, SECRET, TOKEN, KEY, CREDENTIAL, PRIVATE), `NEXT_PUBLIC_*` excepted because it is published by design. | product |
| R192 | `RT_FACT_FALSE` | Every claim of knowledge/hfs/facts.yaml holds against knowledge/hfs/slots.yaml (the one source of the product shape), and no prose of knowledge/**, docs/** or a README states the opposite of a fact (for example that an fe app lacks its own package.json, which fe.app.next requires); prose quotes a fact id or a slot id and never restates the claim. | runtime |
| R193 | `RT_RULE_ID_UNKNOWN` | Every rule id (R<digits>) that tracked knowledge, docs, code or data names is a rule of this catalog, and the ids run from R01 to the last rule with no undeclared gap: an id with no rule is listed under `retired` with its reason (RT_RULE_ID_GAP), and every rule of the catalog is named by the `hfsRules:` of at least one knowledge/patterns topic or carries `scope: runtime` (RT_RULE_UNCITED). A retired id is a history name that only the contract changes and the changelogs may still spell; specs and generated copies are not read. | runtime |
| R194 | `RT_GENERATED_BLOCK_STALE` | The app map (section 4), the back-end source tree (5.1), the tier matrix (5.2), the front-end source tree (6.1) and the rule catalog (12) of knowledge/hfs/README.md are generated blocks, rendered by scripts/hfs/readme-blocks.mjs from knowledge/hfs/slots.yaml and rules.yaml between hfs:generated markers and equal to the render byte for byte; the README never restates them by hand. Likewise the `verification.automated` list of a pattern rule is the failure codes of the rules its `hfsRules` names, the `slot` of a `files:` entry is the slot that owns its path, and the `code` of a why-map entry is the code of the catalog rule that lists the lint rule: scripts/hfs/derived-fields.mjs writes them and they equal the derivation byte for byte. | runtime |
| R195 | `RT_PROSE_PATH_NO_SLOT` | Every product path the knowledge, the docs and the READMEs name (a be/ or fe/ path, whole or with placeholders, globs and braces) is owned by a slot of knowledge/hfs/slots.yaml or is a folder above one; a path no slot owns is prose that invented a place or kept one a slot no longer has. App names are free: a literal app name is one the examples or the starter declare, a placeholder stands for any; a ** glob and a topic file of the knowledge are not paths. | runtime |
| R196 | `RT_PROSE_RESTATES_SLOTS` | Knowledge, docs and READMEs never restate knowledge/hfs/slots.yaml: no fenced block or line names three or more product paths a slot owns, and no sentence lists three or more of the root or side file names the slots declare; a slot is referenced by its id, and the only allowed copy is a generated block between hfs:generated markers. The slot and rule catalogs, the example READMEs and the templates are sources or snapshots, not prose. | runtime |
| R202 | `CI_UPLOAD_NOT_SILENT` | A coverage upload of a CI workflow never skips or fails silently: every step that uses codecov/codecov-action, in a root workflow, an example workflow or a template workflow of packages/hfs, authenticates by OIDC (`use_oidc: true`, with `permissions: id-token: write` on the job or the workflow), sets `fail_ci_if_error: true`, has no `continue-on-error`, and has no `if` that reads a secret or CODECOV_TOKEN, so a missing token can never turn the upload into a skipped step. | runtime |
| R203 | `BE_FEATURE_THIN` | A feature file (a role of ruleParams.be.thinRoles inside a slot of tier feature: handler, resolver, controller, consumer, processor, step, saga, saga-step, compensation, webhook, gateway, subscription, cli, mapper, the saga orchestrator service) maps its parameters and makes ONE delegating call into modules/ (a service, the command or query bus, the event bus, a queue producer): no branch, loop, ternary, try or throw and no computation. Business logic lives in modules/**, where every logic file owes 100 per file; orchestration (step order, compensation, claim, fencing, retry) lives in platform/*; the feature layer is proven by integration and e2e. The gate calls a kind requires are not delegation: a webhook's `verify` and a job step's `JobClaims` fence (`advance`, `runKey`); a logger call, a pure mapper function and a modules function in argument position are free too; a mapper may map a collection item by item (`map`) and write a date as text (`toISOString`), and a cli group command shows its help. | product |
| R204 | `HFS_COVERAGE_SCOPE_DRIFT` | What a back end measures at 100 per file is derived once from the slot manifest (the `coverage: required\|none` field of every be slot and ruleParams.be.logicRoles, scripts/hfs/coverage-scope.mjs), and the three files that state it are its render: be/jest.config.js (thresholds), the `sonar.coverage.exclusions` line of sonar-project.properties, and codecov.yml (paths and one component per service app plus platform, each at 100). A difference is drift; the scope is never edited by hand. | product |
| R205 | `RT_DOC_NO_OWNER` | Every tracked docs/*.md declares exactly one ownership header on its first line — "Owner: <knowledge/ or modules/ path that exists>" when the document explains a machine-owned source, "Task: <one task>" for a how-to — no two documents carry the same task, and two documents whose titles share two or more topic words while at least 30% of the shorter one's sentences appear in the other are one document merged, not two. | runtime |
| R206 | `RT_EXAMPLE_COUPLING` | Runtime source never couples to a product or its example: no tracked file under scripts/, engine/, packages/, ui/src or ui/api - and no managed template under packages/hfs/templates/ - spells a literal examples/<name>, one of the product names this runtime shipped against (the closed PRODUCT_NAMES list of scripts/lib/example-refs.mjs), an inc-<hash> a product name prefixes, or a host drive path. Specs, tests, the generated runtime copies, contract-change history, changelogs and .starciwork records are out of scope; a read the runtime genuinely makes at run time is declared once in scripts/lib/example-refs.mjs and every consumer names that constant. | runtime |
| R207 | `RT_RETIRED_NAME_LIVE` | A name the retired registry declares dead never appears in a live tracked file — not in prose, a comment, a string literal or a path: every retired[].path and moved[].from of modules/kernel/retired-paths.yaml, and every retiredNames[] naming that is not a path (a deleted app, a layer naming, a verb prefix). History (the contract changes, a changelog, a benchmark finding, a .starciwork record), the registry itself and the files of the check may name what was deleted; a slot manifest's forbids value or forbidden-presence tombstone declares a refusal, not a use. | runtime |
| R208 | `RT_PORT_RESTATED` | Every port literal of the runtime is spelled once, by its owner, and every other file references the owner: the harness UI ports live in modules/models/runtimes.yaml statusApp.port/devPort read through ui/ports.mjs, the local SonarQube host in scripts/gates/sonar-local.mjs DEFAULT_HOST. No in-scope file that is not the owner spells an owned literal in a port position (a scheme://host:NNNN or host:NNNN authority, a *port*/PORT assignment, a listen(NNNN) call), and an unowned literal in a port position of two or more runtime source files gets one owning exported constant the rest reference. Specs, tests, node_modules, the generated runtime copies, contract-change history, changelogs, .starciwork and the product stack declarations (.starcistacks, starcistacks-services - a product owns the ports of the services it runs) are out of scope. | runtime |
| R209 | `RT_CONFIG_DEFAULT_TWICE` | Every documented configuration default is stated once, by its owner, and read through it: a camelCase leaf or lowercase key of config.example.yaml, or a value an owner declares - scripts/machine/home.mjs DEFAULTS (supervisor workers, the land gate, frozenMinutes, pollIntervalMs), engine/config.mjs (connector, ask, UAT, spec and allocation defaults, and DEFAULT_OWNER_LANGUAGE which scripts/machine/home.mjs re-exports), engine/orca-config.mjs (worker depth), scripts/reconciler/state.mjs (the controller mode) - is never restated as a literal fallback (?? or \|\|, a parameter default, or a language ternary) in any other runtime source file; the reader calls the owner accessor (supervisorSettings(), configuredMode(), ownerLanguage(), ...). Specs, tests, the generated runtime copies, stories and the HFS templates are out of scope, and a bare identifier or a computed value is a read, not a restatement. | runtime |
| R210 | `RT_VERSION_RESTATED` | knowledge/hfs/canon-pins.yaml spells the version of every @starci package and every canon-pinned dependency once; a package.json is the declared install site and a lockfile its resolution. Anywhere else a semver literal equal to a pin - or a name@x.y.z specifier naming one - restates it, except on the declared binding keys a refresher owns and rewrites in place (canon.version of the code-pattern bindings held by check-canon-pins.mjs, provenance.version and identity.version of the grammar snapshots rewritten by scripts/work/ui/grammar-knowledge.mjs). Package manifests, lockfiles, changelogs, contract-change history, specs, tests, the generated runtime copies and .starciwork are out of scope; a restatement is fixed by naming the pin, never the literal. | runtime |
| R211 | `RT_SLOT_ID_SHAPE` | A slot id follows the grammar its manifest declares, read from the manifest not from a list: dot-separated lowercase kebab segments, a first segment of naming.prefixes in knowledge/hfs/slots.yaml (profiles in knowledge/hfs/runtime-slots.yaml), <side>.app.<kind> naming a kind of appKinds.<side>, and every deeper id extending a declared id - an explicit parent field, or a family at least two slots share; a lone deep orphan invents a family. The role-suffix vocabulary holds no synonym pairs: a profile's suffixes never share a word with bannedSuffixes, no naming.refusedPairs pair is live in suffixes on both sides, and naming.sameConceptPairs is the one declared exception (step + saga-step), live on both sides or dropped; naming.glossary binds the five incoming-thing names (consumer, subscription, webhook, processor, handler) to their distinct kinds. | runtime |
| R221 | `CI_TRIGGERS_RELEASE_ONLY` | The only workflow triggers are a push of release tags and a person dispatching it: every tracked workflow of the runtime, its examples and the hfs app templates (so every scaffolded app inherits it) declares an `on` that holds only `push` filtered to `tags: ['v*']` (no branches, paths or ignore filter beside it) and `workflow_dispatch`. A branch push, a pull_request, a schedule, a workflow_call or any other event refuses the workflow: CI runs once per release, on its tag, and Codecov and Sonar upload only from that run. | runtime |
| R222 | `RELEASE_NOTES` | A release tag `v<version>` on HEAD has its CHANGELOG.md section `## [<version>]` with no TODO, PENDING or TBD left in it and no `in preparation` mark: the tag message and the GitHub Release are that section, so a tag is never cut over an unfinished or missing section. | runtime |
| R223 | `RIGHTS_ROLE_DENIED` | By the caller's role, the command guard refuses git push, git tag, raw git commit/add/rm/mv, raw git synchronization writes, npm publish, a whole-suite run outside the release cut and unit.verify/e2e.verify, npm ci without the host lock, a release cut, and raw side-effecting tools; modules/kernel/command-policy.yaml is the one rule table read by both the PreToolUse guard and the PATH shim. | runtime |
| R224 | `RIGHTS_PROTECTED_ZONE` | The protected zone declared once in modules/kernel/protected-zone.yaml is edited only by the owner path; a supervisor self-upgrade files an owner proposal, and an op never writes the .claude runtime checkout. | runtime |
| R225 | `RT_HOOK_SHAPE` | The app hook templates keep the gate model: pre-commit is L0 only (no typecheck, no test run); pre-push checks the release gate (the starci-release L4 record, refs/backup/, v[0-9] tags) and runs no npm test, jest, typecheck or lint. | runtime |
| R226 | `RT_SPEC_OVER_BUDGET` | Every recorded spec duration should stay within the shared per-file land budget in modules/kernel/spec-durations.yaml: for alpha.4 an over-budget spec is an advisory info finding ranked by its excess (it does not fail the check stage; the budget turns blocking in alpha.5), and every recorded spec path must still exist. An over-budget spec is repaired without removing tests or assertions: share a per-process fixture, remove per-test install or boot, inject the clock and never lengthen a timeout; stale rows are refreshed from the current land record. | runtime |
| R227 | `RT_SYNTAX_INVALID` | Every git-tracked .mjs, .cjs and .js file parses as JavaScript, including tests and package sources; node_modules, generated roots of ruleParams.runtime.generated and vendored build output are outside the authored-source scope. The runtime folder's Node-exact syntax pass remains in place, while this batched in-process pass extends coverage to the whole tracked repository and reports every parser diagnostic at its file and line. | runtime |
<!-- hfs:generated-end rules -->
