# StarCi HFS - the one source and storage standard

HFS is the single standard for the tree, the source ownership, the storage and the shared tooling of every StarCi app,
of `.claude` itself and of every example under `examples/`. This file is the canonical statement. Where another runtime
document disagrees with it, this file wins and the other document is wrong; where this file disagrees with an enforcer
(`slots.yaml`, `rules.yaml`, a check, a canon rule), the enforcer wins and this file is fixed.

A product is ONE app repository, `<app>/`. Its root holds the one `package.json`, the one `package-lock.json`, the one
`node_modules`, the one `hfs.json` (kind `app`), the CI, the hooks, the formatter, the Sonar configuration, `scripts/` and
`.starciwork`. Its two sides are `be/` (the back end) and `fe/` (the front end); each side holds everything a standalone
back-end or front-end repository root used to hold, except `package.json`, the lockfile and the other files the root
owns. Every path in this file is relative to the app root: a back-end path starts with `be/`, a front-end path with
`fe/`. The only cross-side reach is the front end reading `be/contracts/` (its codegen input), declared in `hfs.json`
`sides.fe.reads`. `hfs lint`, `hfs sync` and `hfs scaffold app` run at the app root.

The machine-readable parts live next to this file and are read by every check, lint factory, template and message:

| File | Owns |
| --- | --- |
| `slots.yaml` | Every kind of content allowed to exist in an app: path, presence, tracking, tier, required files, tests, budget, managed template, the two sides and their allowed cross-side reads. Versioned `MAJOR.MINOR.PATCH`. |
| `rules.yaml` | The rule catalog (ids from `R01`, no gaps) with finding code, gates and the Vietnamese why text (catalog below). |
| `canon-pins.yaml` | The exact versions of every `@starci/*` package and framework this major supports. |

The pattern cases in `knowledge/patterns/{be,fe,repo}/` explain how to write code and structure files inside these
slots. Each case cites the rule id it implements (`hfsRules`) and the finding code that judges it. A code-writing op
READs the pattern files of the slots it touches before it codes (`knowledge/op-gate.yaml`).

## 1. Principles

1. **One source of law.** The slot manifest and the rule catalog in `.claude` are the only rules. An app carries no rule
   of its own, no allowlist, no baseline, no suppression file and no local copy of a canon config.
2. **Growth is addition.** A new kind of content is a new slot. A slot is never edited in place inside a major.
3. **One machine at every gate.** Pre-commit, pre-push, the op gate (`scripts/checks/gate.mjs`), the Kernel's landing
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
  `repo.*`). A side slot's path is relative to its side folder: `src/features/<feature>/` of profile `be` is
  `be/src/features/<feature>/` of the app. `hfs check` judges the root slots once and each side's slots under its folder
  (the side view of `scripts/lib/hfs-slots.mjs`); every finding path is app-relative.
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
| Helper or type used by one feature only | `be/src/features/<feature>/application/support/<name>.ts` (`be.feature.application.support`, optional); another feature cannot import it, a second user moves it to a `domain` capability | minor |
| Command line entry | `transport/cli/<name>.cli.ts` in the feature plus a back-end app of kind `cli` (`be.feature.transport.cli`, opt-in); it dispatches one command or query | minor |
| Queue consumer | `transport/message/` in the feature plus a back-end app of kind `worker` | none, declared in `hfs.json` |
| Cron, sweep, outbox publisher | `transport/schedule/<job>.job.ts` | none |
| Another api app or a cli | `be/apps/<name>` plus its kind in `hfs.json` `sides.be.apps` | none |
| Another Next app | `fe/apps/<name>` plus kind `next` in `hfs.json` `sides.fe.apps` | none |
| New app kind or protocol | new slot `be.app.<kind>` or `be.transport.<protocol>` | minor |
| Integration (payment, LLM) | `be/src/modules/integrations/<provider>/` | none |
| Model code | client in `integrations`, training code in a new slot, weights in an object store | minor |
| Human documentation | `be/docs/{adr,runbooks,guides}/` or `fe/docs/{adr,runbooks,guides}/` (`repo.docs`, opt-in) | none |
| Infrastructure | `.starcistacks/<env>/infra/{compose,k8s,terraform}/` | none |
| Mobile app | new slot `fe.app.expo` | minor |
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
        { "name": "worker", "kind": "worker" },
        { "name": "migrate", "kind": "migrate" }
      ],
      "optionalSlots": ["be.transport.message", "be.transport.schedule", "be.contract.graphql", "repo.docs"],
      "connections": [
        { "name": "primary", "envPrefix": "PRIMARY_DB" },
        { "name": "agentos", "envPrefix": "AGENTOS_DB" }
      ]
    },
    "fe": {
      "apps": [{ "name": "web", "kind": "next" }],
      "reads": ["be/contracts/"]
    }
  }
}
```

`sides.be.apps` lists every `be/apps/<name>` with its kind (`api`, `worker`, `migrate`, `cli`); `sides.fe.apps` every
`fe/apps/<name>` (`next`). App names are unique across both sides. `connections` (back end only) lists every physical
database as `{ name, envPrefix }`: the logical name (never the engine) and the prefix of its `<PREFIX>_*` environment
keys. `reads` is a subset of the manifest's `sides.<side>.reads`. A missing `hfs.json`, or a machine run that analysed
zero files for a side, is a failure (`HFS_ARCH_CONFIG_UNREAD`), never "unavailable". Owners are derived from slots;
`hfs.json` holds no owner list, path or disabled rule. `hfs scaffold app <name>` writes a new app with its declaration.

## 4. App map: where everything lives

| Content | State | Slot |
| --- | --- | --- |
| `hfs.json`, `README.md`, `package.json`, `package-lock.json`, `.gitignore`, `.gitattributes` | app root, required, tracked; the `scripts` block of `package.json` is generated and compared as parsed JSON | `app.declaration`, `app.readme`, `app.package-manifest`, `app.lockfile`, `app.git-meta` |
| `.editorconfig`, `.nvmrc`, `.npmrc` (optional) | app root, tracked, the app's own dotfiles | `app.tool-config`, `app.tool-config-optional` |
| `.prettierrc`, `.prettierignore` | app root, generated by `hfs sync` | `app.format-config` |
| `sonar-project.properties` | app root, generated by `hfs sync` | `app.quality-config` |
| `.husky/{pre-commit,pre-push}`, `.github/workflows/ci.yml` | app root, generated by `hfs sync` | `app.hooks`, `app.ci` |
| `.github/workflows/e2e.yml` | app root, optional, generated by `hfs sync`, `workflow_dispatch` only | `app.ci-e2e` |
| `scripts/{.gitkeep,*.mjs,*.cjs,*.ps1,*.sh}` | app root, optional, tracked; operational scripts only (the managed `codegen.mjs` among them); no spec, no check, no lint source | `app.scripts` |
| `.starciwork/` | app root, required, tracked, product records only | `app.starciwork` |
| A tool configuration at the root (`tsconfig.json`, an eslint, stylelint, jest or lint-staged config) | forbidden: each side holds its own managed set | `app.tool-config-local` |
| `package.json`, lockfile, `hfs.json`, `README.md`, git, CI, hook, formatter or Sonar files, `scripts/` or `.starciwork/` inside a side | forbidden: the root owns them | `repo.side-root-forbidden` |
| `be/{tsconfig.json,tsconfig.build.json,src/tests/tsconfig.json,eslint.config.mjs,jest.config.js}`, `be/nest-cli.json` | required, generated by `hfs sync` and hash-checked (`nest-cli.json` is the scaffold's); no other tool config may exist | `be.tool-config`, `be.nest-cli`, `be.tool-config-local` |
| `fe/{tsconfig.json,eslint.config.mjs,stylelint.config.mjs}` | required, generated by `hfs sync` and hash-checked; a front end has no test configuration at all (R97) | `fe.tool-config`, `fe.tool-config-local` |
| `fe/turbo.json` | optional, tracked; the front end's own task graph, which no preset can render | `fe.tool-config-repo` |
| `be/apps/<app>/src/` | required, tracked | `be.app.*` |
| `be/src/{features,modules,tests}` | required, tracked | `be.*` |
| `be/contracts/<app>/{schema.graphql,openapi.json}` | opt-in, tracked, the committed machine-emitted contracts; the front end reads them in place | `be.contract.*` |
| `.starcistacks/`, `.sops.yaml` (app root) | required, tracked, secrets only as `*.enc`; never under a side (`HFS_STACKS_IN_SIDE`) | `app.starcistacks`, `app.sops` |
| `fe/apps/<app>/{next.config.ts,tsconfig.json,postcss.config.mjs}`, `fe/apps/<app>/src/` | required, tracked; an FE app has no `package.json` of its own | `fe.app.next`, `fe.route`, `fe.feature`, ... |
| `be/packages/<pkg>/`, `fe/packages/<pkg>/` | opt-in, tracked, must build; an npm workspace of the root `package.json` | `repo.packages`, `fe.package.*` |
| `be/apps/<app>/Dockerfile`, `fe/apps/<app>/Dockerfile`, a side's `.dockerignore` | optional, tracked | `repo.app-image`, `repo.dockerignore` |
| `be/docs/{adr,runbooks,guides}/`, `fe/docs/{adr,runbooks,guides}/` | opt-in, tracked, images at most 500 KB | `repo.docs`, `repo.docs-media` |
| `node_modules`, `dist`, `.next`, `coverage`, `reports`, `test-results`, `next-env.d.ts`, `*.tsbuildinfo` | may exist, ignored | `app.build-output`, `repo.build-output` |
| `__generated__/`, Nest `schema.gql` | may exist, ignored, produced by `codegen` | `repo.generated` |
| `.eslintcache`, `.turbo`, `.scannerwork`, `.sonar`, `.jest-cache`, `.cache`, `.tools` | forbidden, external to `%LOCALAPPDATA%/StarCi/cache/<repo>/<tool>/` | `app.tool-cache`, `repo.tool-cache` |
| Worktrees (`.worktrees/`, `worktrees/`, `.starciwork/worktrees/`) | forbidden as tracked content, external: a lane worktree lives at `D:/starci-lanes/<project>/<lane>/`; a runtime op worktree is git-excluded and removed when its op settles (`docs/workflow-kernel.md`) | `app.worktrees`, `repo.worktrees` |
| Agent output (reports, logs, `nul`, `.qwen*`, `.artifacts`, `design-plans/`, draw rounds, UAT captures) | forbidden, external: scratchpad or blob store, cited by `{name, sha256}` | `app.agent-output`, `repo.agent-output` |
| Plaintext secrets (`.env*`, `.secrets/`, `*.pem`, `*.key`) | forbidden, external: sealed at `.starcistacks/<env>/secrets/<slug>.enc` | `app.plaintext-env`, `repo.plaintext-env` |

**Agent evidence is not tracked.** Evidence, logs, captures, UAT runs and draw rounds live in the blob store and the
runtime ledger; a record cites them by hash. The single exception is the accepted design direction image of a
ui-screen (`.starciwork/features/<feature>/ui/<name>/assets/<file>`), which is product content and is tracked. Initial and
intermediate draw images and prompt files are agent data.

## 5. Backend

The rules of this section are the owner-locked back-end convention of 2026-09-30. Each rule id (R..) is a row of the
catalog in section 12; the pattern files in `knowledge/patterns/be/` cite them and give the code forms.

### 5.1 Source tree

```text
be/apps/<app>/src/                       kind api | worker | migrate | cli, declared in hfs.json sides.be.apps
  main.ts                                at most 80 lines: build EnvSource once, parse options, bootstrap, handle startup failure
  app.module.ts                          at most 250 lines: AppModule.register(options), each capability once with isGlobal true, transports
  <app>.options.ts                       the options type of the app
be/src/features/<feature>/
  index.ts                               module class and the contract an app needs; no export *
  <feature>.module.ts                    application module (handlers)
  application/                           <action>.command.ts | <action>.query.ts, <action>.handler.ts, <action>.contracts.ts; no spec
  application/support/                   opt-in by need: helpers and types local to this one feature; no spec
  transport/graphql/                     <feature>-graphql.module.ts, <action>.resolver.ts, <action>.mapper.ts, dto/
  transport/http/                        opt-in: <feature>-http.module.ts, <action>.controller.ts, dto/ (webhooks, OAuth, health, byte streams)
  transport/websocket/                   opt-in: <feature>-websocket.module.ts, <channel>.gateway.ts
  transport/message/                     opt-in: <feature>-message.module.ts, <event>.consumer.ts
  transport/schedule/                    opt-in: <feature>-schedule.module.ts, <job>.job.ts
  transport/cli/                         opt-in: <feature>-cli.module.ts, <name>.cli.ts; composed only by an app of kind cli
  messages/                              opt-in: <feature>.messages.ts (vi and en copy)
be/src/modules/domain/<capability>/      index.ts, module, module-definition, options, config, decorators, log-events, errors/, persistence/, messages/, services
be/src/modules/platform/<capability>/    composition, config, errors, primitives, logging, clock, cqrs are required; database, http, retry, inbox, outbox, ... by need
be/src/modules/integrations/<provider>/  index.ts, <provider>.config.ts, <provider>.decorators.ts, <provider>.client.ts, errors/
be/src/tests/world/                      the only test infrastructure: global-setup.ts, use-test-world.ts, fakes/<provider>/, test-world.config.ts
be/src/tests/fixtures/                   typed builders (the doubles come from `@starci/jest-preset`); never imports a feature
be/src/tests/integration/<capability>/*.integration-spec.ts   one capability module on the real database, no HTTP
be/src/tests/e2e/<area>/*.e2e-spec.ts    flows through the real apps
be/src/tests/contract/<provider>/*.contract-spec.ts   provider sandboxes, run only by test:contract
be/contracts/<app>/schema.graphql        opt-in committed contract (and openapi.json of a typed operation table)
```

Nothing else exists at `be/src/` level, and no `types`, `constants`, `utils`, `helpers`, `shared`, `common`, `testing` or
`exceptions` folder exists under `be/src/modules` or `be/src/features` (R01, R89). The unit specs are the
`<name>.service.spec.ts` files beside their services (section 7). Files carry a role suffix from the closed
list of the slot manifest (`module`, `command`, `handler`, `decorators`, `sql`, `rows`, ...); `use-case`, `repository`,
`store`, `worker`, `scheduler` and `dto` are not among them (R89).

### 5.2 Tiers and direction (R26 to R28)

| From \ to | app | feature | domain | integrations | platform | package |
| --- | --- | --- | --- | --- | --- | --- |
| app | - | index only | yes | yes | yes | yes |
| feature | no | no, not even another feature | yes | yes | yes | yes |
| domain | no | no | yes, acyclic | yes | yes | yes |
| integrations | no | no | no | no | yes | yes |
| platform | no | no | no | no | yes, acyclic | yes |

Type-only imports count. Every import across owners goes through the owner's single `index.ts`; inside one owner imports
are relative and never go through the owner's own `index.ts` (R30). Shared types that both platform and domain need go
down to platform or are passed as options. Only these three module tiers exist.

### 5.3 Persistence: one authority, one connection per database (R34 to R36, R83 to R86)

Schema changes only by migration. `synchronize` is the literal `false` everywhere, including e2e databases (e2e runs the
real migrations). There is no runtime DDL, no `dataSource.synchronize()`, no `migrationsRun`, no `CREATE|ALTER|DROP TABLE`
outside `persistence/migrations/**`, no entity or migration glob. `be/apps/migrate` is the only process that runs migrations,
once per connection, before api and worker start. Entities and migrations live in `persistence/{entities,migrations}/` of
the capability that owns the table; the owner's `index.ts` exports `<c>Entities` and `<c>Migrations` and the app composes
them per connection. Migrations are `<epochMs13>-<kebab-name>.ts`.

One physical database is one connection (`hfs.json` `sides.be.connections`), one `<conn>.connection.ts`, one `<conn>.config.ts` and
one injector `Inject<Conn>EntityManager()` in `platform/database` (R84). The database is reached through that shared
`EntityManager`, injected with the named injector and called directly: `getRepository`, `@InjectRepository`,
`Repository<T>`, repository or store classes, QueryBuilder, a `DataSource` or `QueryRunner` outside `platform/database`,
`be/apps/migrate` and the test world `be/src/tests/world` do not exist; specs use the world's `world.db.<connection>` `EntityManager` (R83). A handler opens the transaction with
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

Background work is a transport. `transport/schedule/<job>.job.ts` (a `ScheduledJob` with `run(at)`) and
`transport/message/<event>.consumer.ts` dispatch one command exactly as a resolver does. Mechanisms live in
`platform/scheduling` and `platform/messaging` (adapters over the queue and stream libraries, with lease and fencing).
Only an app of kind `worker` composes them; an api app never runs cron. A method named `sweep*`, `deliver*`,
`reconcile*`, `retry*` or `relay*` that no job or consumer calls is a failure. Producers publish through typed queues, and
a publish that must be atomic with a write goes through the outbox inside the transaction.

### 5.8 Modules, features and injection (R29 to R33, R45, R85, R87, R88)

A feature root holds `index.ts`, `<feature>.module.ts`, `application/`, `transport/<protocol>/` and, when it has copy,
`messages/` only. `application/` holds commands, queries, handlers and contracts: each message is a typed
`Command<R>`/`Query<R>` carrying one `params` (`ExecuteParams<T>` or `PublicExecuteParams<T>`), each handler
`extends ICQRSHandler` and overrides `process` as one call of an injected service; there is no use-case class, forwarder service or in-process event (R87).
A transport injects only the command or query bus, dispatches exactly one message, holds no logic, returns no envelope and takes no
`GraphQLJSON` (R88). Each transport has exactly one Nest module `<feature>-<protocol>.module.ts`, plus one application
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

## 6. Frontend

### 6.1 Source tree

```text
fe/apps/<app>/
  next.config.ts, tsconfig.json, postcss.config.mjs, Dockerfile?, public/   no package.json: the app root holds the one manifest
  src/app/                            global-error.tsx, [locale]/{layout,error,not-found,loading}.tsx, [locale]/**/page.tsx, globals.css
  src/proxy.ts | instrumentation*.ts  framework-pinned root files; middleware.ts is refused (Next 16 uses proxy.ts)
  src/features/{pages,layouts,overlays}/<Name>/
  src/components/{blocks,composites,branches,leaves}/<Name>/
  src/hooks/<domain>/                 use<Name>.ts and one <domain>.shared.ts
  src/modules/api/                    index.ts, <domain>/read-*.ts, <domain>/*.graphql, <domain>/<domain>.mapper.ts, __generated__/;
                                      client.ts + outcome.ts only in a one-app front end
  src/modules/config/                 the only reader of the environment
  src/modules/i18n/                   index.ts (calls the i18n package factory) and messages/<locale>.json; the whole
                                      next-intl stack (routing, navigation, request) only in a one-app front end
  src/modules/routes/                 every href builder
  src/modules/brand/brand.css         the only app file holding colour values
fe/packages/<family>-ui/              opt-in, built to dist; grammar tiers composites/branches/leaves under src/
fe/packages/<family>-api/             opt-in: src/client.ts (the one fetch) and src/outcome.ts (the one Outcome) of every app
fe/packages/<family>-i18n/            opt-in: the next-intl stack once, exported as createAppI18n
fe/packages/<pkg>/                    any other code two apps share (FE_CROSS_APP_DUPLICATE: an app never keeps a copy)
```

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

- Backend, four kinds by folder and suffix (R47): unit `<name>.service.spec.ts` beside its `<name>.service.ts` (only services are unit-tested); integration
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
  and fixtures included) at pre-push and CI and by `typecheck:tests` (`be/src/tests/tsconfig.json`) for the world,
  integration, e2e and contract trees. `test:integration`, `test:e2e` and `test:contract` are each
  `npm run typecheck:tests && cd be && jest --selectProjects <name>`; `test` is `cd be && jest --selectProjects unit --coverage` (per-file 100 on `be/src/**/*.service.ts`). Every script runs from the app root.
- A backend e2e boots the real apps through the world; it never hand-assembles a lane module. Fixtures are typed
  builders and doubles, not `as never` or `as unknown as`; they never import a feature. No `testing/` folder in
  `be/src/modules`. A spec does not read source code with `fs` (R48).
- Frontend: no tests by standard (R97): no spec, no e2e, no test runner, test script or test dependency under `fe/`, and no exception.
- Write or update the spec of the service you change; the op gate (`gate.mjs --tests`) and the hooks run only the affected unit specs. The whole suite runs only at push.

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
  `scaffold app`). Every managed file is generated by `hfs sync` at the app root and hash-checked (R05). The root's: the
  `scripts` block of `package.json`, `.prettierrc`, `.prettierignore`, the `.husky` hooks, the CI workflows, the Sonar file
  and the `.gitignore` block. The back end's: `be/tsconfig.json` (the preset and the three aliases),
  `be/tsconfig.build.json`, `be/src/tests/tsconfig.json` (the config of the world, integration, e2e and contract trees,
  found by typed lint and `typecheck:tests`), the one-line `be/eslint.config.mjs` and `be/jest.config.js`. The front end's:
  `fe/tsconfig.json` (the `next.json` preset and nothing else), the one-line `fe/eslint.config.mjs` and the one-line
  `fe/stylelint.config.mjs` (`appTokens` derived from the `globals.css` files by `loadAppTokens`). `lint` (`hfs lint`:
  ESLint over `be/` with the BE canon and over `fe/` with the FE canon, the app check, stylelint over `fe/`) is the one lint
  gate and `lint:fix` its `--fix`; there is no front-end test script. The list of managed files is the `managedBy` slots
  of `slots.yaml`. An app defines and disables no rule (R16, R17). `noInlineConfig: true`: no `eslint-disable`, no
  `@ts-ignore`, no `@ts-expect-error` (R18). Every `@starci/*` package is installed from the npm registry at the exact
  version of `canon-pins.yaml` (`packages/README.md`).
- **Formatter.** Prettier only: `printWidth` 120, `tabWidth` 4, `semi` false, `singleQuote` false, `trailingComma`
  `all`. No ESLint formatting rule exists. Pre-commit runs `prettier --check` on the staged files, pre-push and CI `npm run format:check` (R19).
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
| PC pre-commit | `hfs work-hygiene` (staged `.starciwork` and `.starcistacks` paths, the secrets guard), `typecheck`, ESLint per side on the staged files, stylelint on the staged CSS of `fe/`, `prettier --check` on the staged files, the unit specs of `be/` the staged files touch | seconds | R06, R07, R18, R19, R34, R40, R41, R43 to R45, R49, R55, R58, R61, R62 |
| PP pre-push | `typecheck`, `lint` (`hfs lint`), `format:check`, the unit specs of `be/` affected since `origin/main` | under 2 min | PC plus R01, R03 to R05, R12 to R15, R22, R26, R27, R30 |
| OS op settle | the op gate `scripts/checks/gate.mjs` over the op's changed files, forced every round of the op loop: the merge guard, `hfs lint --changed`, `codegen` and package builds, `tsc` per owning tsconfig, the slice's specs; only findings new against the base block; `api settle` re-reads the attached gate JSON and READ digest and refuses a red `done` | per op | every file-level and owner-level rule in scope |
| LG land | the Kernel's landing of a green op: the op branch rebased onto main, `gate.mjs` re-run over the rebased tree against main (merge guard included), then main fast-forwarded and pushed | per op | as OS, against the newest main |
| CI GitHub | `npm ci`, `npm run lint -- --sonar reports/lint.sonar.json` (the pinned `hfs lint`), `format:check`, `typecheck`, `npm test` (unit with the per-file coverage threshold), `build:be`, `build:fe`, the Sonar scan and gate | | every rule |
| SQ Sonar | the imported lint findings, duplication, cognitive complexity and coverage 100 on `be/src/**/*.service.ts` (overall, new code and per file; the be unit run's lcov, the same per-file 100 the unit project enforces) | | R20, R21 (second gate) |

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

**Repository, slots, storage**

| Id | Code | Rule |
| --- | --- | --- |
| R01 | `HFS_SLOT_UNDECLARED` | Every tracked path matches exactly one slot. |
| R02 | `HFS_SLOT_REQUIRED_MISSING` | A slot is missing a required file (feature `index.ts`, app `main.ts`, FE `global-error.tsx`), or the root README breaks its standard shape (title, description, standard sections in order, Work pointer, live badges only, no private URL). |
| R03 | `HFS_UNTRACKED_ROOT_ENTRY` | No untracked or ignored entry outside an `ignored` slot. |
| R04 | `HFS_GITIGNORE_BLOCK_DRIFT` | The managed `.gitignore` block equals its render. |
| R05 | `HFS_MANAGED_FILE_DRIFT` | A managed file equals its template render. |
| R06 | `HFS_PLAINTEXT_SECRET` | Secrets exist only as `.starcistacks/<env>/secrets/<slug>.enc`. |
| R07 | `HFS_AGENT_DATA_TRACKED` | `.starciwork` holds product records only. |
| R08 | `HFS_WORK_NODE_RETIRED` | Only flat family records, never `work/node`. |
| R09 | `HFS_IDENTITY_CUSTODY` | An identity points its secret at `secrets/identity-<slug>.enc`; UAT chooses by role. |
| R10 | `HFS_STACKS_SHAPE` | `.starcistacks` has the standard shape and the host Sonar owner. |
| R11 | `HFS_SONAR_CONFIG` | Sonar config is generated, with no host URL, importing the be lcov with the services as the only coverage scope. |
| R12 | `HFS_E2E_IN_AUTOMATIC_GATE` | e2e never joins husky, coverage or automatic CI. |
| R13 | `HFS_CI_MISSING_CANON` | CI runs the pinned `hfs lint` (`npm run lint`); pre-push runs typecheck and lint; a clone never redirects `core.hooksPath` away from husky. |
| R14 | `HFS_DEP_VERSION_SKEW` | One version per dependency in the workspace, a root `overrides` pin included, and npm is the only package manager. |
| R15 | `HFS_CANON_PIN_DRIFT` | Canon packages and frameworks match `canon-pins.yaml`. |
| R16 | `HFS_TOOL_CONFIG_LOCAL` | Configs only call the factories; no local rules. |
| R17 | `HFS_RULE_OFF_WITHOUT_REPLACEMENT` | The ESLint configuration (and a front end's stylelint configuration) is the rendered one-liner, so no rule is off, warned or redefined in a repository. |
| R18 | `HFS_INLINE_SUPPRESSION` | No inline suppression of any kind. |
| R19 | `HFS_FORMAT` | Prettier is the only formatter. |
| R20 | `HFS_SIZE_GROWTH` | Over-budget files do not grow; new files are inside budget. |
| R21 | `HFS_DUPLICATE_CODE` | No duplicated blocks or twice-defined helpers. |
| R22 | `HFS_TS_STRICT` | tsconfig extends `@starci/tsconfig` and lowers no flag; no assertion, `!` or `any` in product source. |
| R23 | `HFS_CONTRACT_SNAPSHOT_DRIFT` | The be side commits its contract snapshot and it equals the emit; the fe side reads it in place (be/contracts/). |
| R24 | `HFS_ARCH_CONFIG_UNREAD` | The machine reads `hfs.json`; zero files analysed is red. |
| R25 | `HFS_UNUSED_EXPORT` | No public export without a consumer; no source file nothing reaches. |

**Backend**

| Id | Code | Rule |
| --- | --- | --- |
| R26 | `BE_TIER_DIRECTION` | The tier direction matrix; a shared package never imports an app. |
| R27 | `ARCH_OWNER_CYCLE` | No owner cycles, type-only included. |
| R28 | `BE_FEATURE_IMPORTS_FEATURE` | A feature never imports a feature. |
| R29 | `BE_FEATURE_SHAPE` | Feature root is `index.ts`, module, `application/`, `transport/<protocol>/`; `application/` never imports `transport/` or a protocol framework. |
| R30 | `BE_PUBLIC_SURFACE` | Every owner has one `index.ts`; cross-owner imports use it, same-owner imports are relative and never go through it; it holds only named `export { }` lines, no `export *`, no alias re-export (`export { X as Y }`, `export const Y = X`, `export type Y = X`, `export interface Y extends X {}`: one declaration has one name), at most 60 exports; cross-package imports use the package name and a declared export. |
| R31 | `BE_FEATURE_NOT_COMPOSED` | Every feature, transport module and capability module is composed by an app. |
| R32 | `BE_APP_COMPOSITION_ONLY` | Apps compose only; an app is proven by the e2e world (`useTestWorld({ apps })`), never by a unit spec. |
| R33 | `BE_ENTRYPOINT_ONLY_IN_APPS` | Entrypoints only in `be/apps/*/src`. |
| R34 | `BE_SCHEMA_AUTHORITY` | Migrations are the only schema authority; `synchronize` is `false`. |
| R35 | `BE_SCHEMA_OWNER` | Entities and migrations live in the owning capability's `persistence/`; its `<c>Entities` and `<c>Migrations` are registered under exactly one declared connection, which every `Inject<Conn>EntityManager` of the capability names (no `CONNECTION` alias). |
| R36 | `BE_SQL_OUTSIDE_PERSISTENCE` | Raw SQL is `sql`-tagged `SqlText` in `persistence/<name>.sql.ts` of the owning capability; `.query()` takes only `SqlText`; no QueryBuilder. |
| R37 | `BE_ENTITY_IN_CONTRACT` | No ORM entity in a contract or transport type. |
| R38 | `BE_ERROR_HOME` | Errors live in the owning capability's `errors/` and extend `DomainError`. |
| R39 | `BE_ERROR_MASKED` | One filter per app; undeclared errors are masked. |
| R40 | `BE_LOGGER_REQUIRED` | `platform/logging` exists and its `Logger` port is the only logger; every `catch` logs, rethrows or returns a reasoned outcome, and a log call names its event with a member of an owner's `<owner>.log-events.ts` enum. |
| R41 | `BE_DEFAULT_DENY` | APP_GUARD plus `@Public({ reason: PublicReason.X })`; no `@UseGuards`; typed bodies; `timingSafeEqual`. |
| R42 | `BE_INPUT_BOUNDED` | Bounded input, cursor-only pagination, depth limits, rate limits; every property of an input class carries the `class-validator` decorators its type calls for; a door opened for `PublicReason.AuthHandshake` or `PublicReason.SignedWebhook` carries `RateTier.Strict` of `platform/http-security`. |
| R43 | `BE_CONFIG_OWNER` | Only `platform/config` reads `process.env`; config per capability. |
| R44 | `BE_SECRET_DEFAULT` | No default for a secret key or infrastructure URL. |
| R45 | `BE_MODULE_SHAPE` | `@Global` nowhere and `isGlobal: true` only at app roots; no cross-owner module imports; typed options; one module per transport; every handler and provider registered exactly once. |
| R46 | `BE_BACKGROUND_UNOWNED` | Every sweep, outbox or retry has a job or consumer run by a worker app. |
| R47 | `BE_TEST_TOPOLOGY` | One jest config, projects `unit`, `integration`, `e2e` and `contract`, live by folder, `diagnostics: false`; unit specs are `<name>.service.spec.ts` beside a `<name>.service.ts` and nowhere else (every service has exactly one; any other `*.spec.ts` outside `be/src/tests/{world,integration,e2e,contract}` is a finding, including specs in apps), and the unit project collects coverage from `be/src/**/*.service.ts` only with a per-file threshold of 100 on lines, branches, functions and statements (`test` runs `--coverage`; `importHelpers` and `tslib`); `be/src/tests/world/` is the ONLY test infrastructure: `global-setup.ts` starts the app's own stack (`.starcistacks/<env>`, named by `stack` in `test-world.config.ts`, the declaration of the test-world library in its one named form `export const { useTestWorld, useSandbox } = defineTestWorld({...})` (a default export is not read): every service it declares runs REAL, behind toxiproxy, images and versions read from the stack at run time, never spelled in test source) or attaches to a warm one that answers, and runs `be/apps/migrate` once; `global-teardown.ts` stops only what its setup started; `use-test-world.ts` exports `useTestWorld({ apps } | { modules })` (`world.apps.<name>.api`, `world.db.<connection>`, `world.infra.<service>` with `latency(ms)`, `cut()` and `restore()` on the real service, `world.fake.<provider>`, `world.waitFor`) and `fakes/<provider>/` holds the network-edge fakes (`failNext`, `replayWebhook`, `delay`, payload fixtures) of external SaaS the team does not operate ONLY: a fake of a service the stack declares is refused, except stateless compute that needs special hardware or an external model (GPU inference, a self-hosted embedding model), whose `stacks` entry in `test-world.config.ts` declares `{ fakedBy: <fake>, reason }` with a non-empty `reason` (a stateful service, or one with a persistent volume, is never accepted); it alone owns containers, DataSource, migrations and `process.env`; nothing under `be/src/tests` overrides a provider or DI token; `be/src/tests/integration/<capability>/*.integration-spec.ts` (`{ modules }`, real database, no HTTP), `be/src/tests/e2e/<area>/*.e2e-spec.ts` (`{ apps }`) and `be/src/tests/contract/<provider>/*.contract-spec.ts` (provider sandboxes, skipped without sandbox config, run only by `test:contract`, never by `test` or `test:e2e`) agree folder with suffix; an integration or e2e spec passes `useTestWorld` one object literal with plain keys (no variable, spread or computed key) and calls it; the contract layer skips only through the test-world library's `useSandbox(...)` when the sandbox config is absent (`sandbox.describe(...)`), and every `fakes/<provider>/` that serves payload fixtures (`payloads/*.json`) has a `contract/<provider>/*.contract-spec.ts` that references those fixtures and asserts `shapeOf(real)` equals `shapeOf(fixture)` (the helper `shapeOf` is named by `ruleParams.be.contractShape` of the slot manifest; fakes the test-world library provides are guarded by the library); no `.test.ts`, `int-spec` or `harness-spec`, no `live/` and no `be/src/tests/e2e/world`. |
| R48 | `BE_SPEC_QUALITY` | No source-reading specs; a spec asserts results or state, not only calls; no `as` and no `x!` in a spec (the borrowed rules of R72), no return-only generic (`<T>(value: unknown): T`), `unknown` handed back as a concrete type, `JSON.parse(JSON.stringify(x))` or `Object.assign(new X(), y)` returned as another type in a spec or a test fixture, and no `Date.now()`, argless `new Date()` or `process.env` (R79, R43); a unit spec (`<name>.service.spec.ts`) builds its subject with `Test.createTestingModule({ providers: [...] }).compile()` and `moduleRef.get(Subject)`: no `new` of the service, no `imports` key, no `override*` call, and no `jest.mock`, `jest.doMock`, `jest.unstable_mockModule` or `jest.requireMock` of an own module or a third-party library; it provides each infrastructure token from its `@starci/jest-preset` double (`mockEntityManager(...)` for an EntityManager token, `new FakeClock(...)`, `recordingOutbox()`, `fakeCache(...)`, `fakeLock(...)`, `fakeIds()`, `builder(...)(...)` or a plain literal of real values for an options token, `mock<T>()` for everything else; the token table is `ruleParams.be.specDoubles` of the slot manifest) and takes its EntityManager only from the kit's `mockEntityManager()` or `fakeTransaction()`, never an ad-hoc `jest.fn` object, and asserts exact values: ids from `fakeIds()` and dates from `FakeClock` are compared as themselves, never `expect.any(String)`, `expect.any(Number)` or `expect.any(Date)`; an e2e enters through transport, waits with `waitFor`, boots through `useTestWorld`, reads persisted state back and reaches no model provider. Test data is arranged by builders, which R98 to R101 hold. No spec of any layer skips, focuses or marks a test todo (`skip`, `skipIf`, `runIf`, `todo`, `only`, `xit`, `xdescribe`, `xtest`) and none selects its runner conditionally, and no file of the test tree (world, fixtures, kit) writes one either; the only skip is the test-world library's `useSandbox(...)` (`@starci/test-world`), which skips a contract spec when the sandbox config is absent. |
| R68 | `BE_SQL_INTERPOLATED` | SQL text carries no runtime substitution; values are numbered parameters. |
| R69 | `BE_QUERY_UNBOUNDED` | A read that can return many rows states `take`, `limit` or `LIMIT`, or pages by cursor. |
| R70 | `BE_HTTP_TIMEOUT` | Every outbound `fetch`, axios or HttpService call states a timeout or an abort signal. |
| R71 | `BE_LOG_SECRET` | A `Logger` call carries no `Secret` or `Pii` value and no credential or personal identifier by name; log an id or a masked form. A constructed error carries no `Secret` value and no text value named like a credential. |
| R72 | `BE_TYPE_ESCAPE` | No type escape in any file, specs included: no `as X` (only `as const`), `<X>y`, `x!` or `any` (the factory turns on the typescript-eslint rules `consistent-type-assertions` with `never`, `no-non-null-assertion` and `no-explicit-any`), no `Function` type, no `eval`. |
| R73 | `BE_ASYNC_NO_AWAIT` | An `async` function contains an `await`; otherwise it is not `async`. |
| R74 | `BE_MIGRATION_REVERSIBLE` | Every migration declares a `down()` that reverses its `up()`; never empty, never a bare throw. |
| R75 | `BE_RETURN_TYPE` | Handlers and public methods of an Injectable, Resolver or Controller declare their return type. |
| R76 | `BE_JSON_PARSE_UNGUARDED` | `JSON.parse` sits inside a `try` in its own function and fails as a typed outcome. |
| R77 | `BE_QUERY_IN_LOOP` | A read through the shared EntityManager does not run once per element of a loop; read once before the loop by key list. |
| R78 | `BE_USER_COPY_LITERAL` | A literal exception message, notification text or response copy comes from the per-capability messages catalog through the typed `MessageCatalog` port, not from source. |
| R79 | `BE_AMBIENT_CLOCK` | `Date.now`, a bare `new Date()`, `performance.now`, `process.hrtime` and `Temporal.Now` are referenced only inside `platform/clock`, specs included; code asks the injected `Clock` port and specs use `FakeClock`. |
| R80 | `BE_INBOX_DEDUPE_MISSING` | Every service method that takes a delivery (a public method of a `*.service.ts` whose first parameter has an `eventId`) makes `claim(source, eventId)` on the `Inbox` port its first awaited expression and returns early when the claim answers `false`; consumers and `SignedWebhook` controllers stay thin doors (R88) and dispatch to the handler whose service claims. |
| R81 | `BE_HAND_ROLLED_RETRY` | A loop that catches an error and waits before trying again goes through the shared `platform/retry` helper, never a hand-written loop. |
| R82 | `BE_TRANSACTION_EXTERNAL_CALL` | No transaction spans an external call; commit first and call out after, or write an outbox message inside the transaction. |
| R83 | `BE_UNNAMED_DATA_ACCESS` | The database is reached through the shared EntityManager, injected as a constructor parameter by the `Inject<Conn>EntityManager()` of a declared connection and called directly; no bare `@InjectEntityManager()`, `getRepository`, repository, QueryBuilder or property injection; a `DataSource` or `QueryRunner` only in `platform/database`, `be/apps/migrate` and the test world `be/src/tests/world`, whose `world.db.<connection>` EntityManager the specs use. No class outside an application handler, a domain service or a platform persistence capability takes, holds or returns an `EntityManager`, `Repository`, `DataSource` or `QueryRunner` (a repository under any name, a store, dao, gateway or persistence wrapper included), no exported function whose first parameter is an `EntityManager` (a statement module), and no wrapper return type, awaited value or `provide:` token hands out a connection object. |
| R84 | `BE_CONNECTION_DUPLICATE` | One physical database is one connection and one `Inject<Conn>EntityManager()` injector declared once in `platform/database`; `hfs.json` connections, connection files, injectors and module registrations correspond one to one. |
| R85 | `BE_RAW_INJECT` | Every injected infrastructure dependency arrives through a zero-argument `Inject<Thing>()` from its owner's `<owner>.decorators.ts` over a `unique symbol` token; raw `@Inject(` exists only there, and every such token is exported so a spec can provide it; a constructor parameter of a provider is typed by a class or carries an `Inject<Thing>()`, never a bare primitive, `Map`, union or interface. |
| R86 | `BE_SQL_TABLE_OWNER` | SQL writes only the tables of its own capability's entities, reads only tables of owners it may import, and every multi-row SELECT is bounded. |
| R87 | `BE_CQRS_SHAPE` | The application layer is CQRS: typed `Command<R>`/`Query<R>` messages carrying one `params`, handlers extending `ICQRSHandler` that override `process`, where `process` is one `return this.<service>.<method>(...)` and the handler injects only `*Service` classes and the Logger (no EntityManager, no branch, no loop, no second call); no use-case classes, forwarder services or in-process events (`EventBus`, `EventEmitter`, an RxJS `Subject`, a stored listener list); a message and an injected dependency are `readonly`. |
| R88 | `BE_TRANSPORT_SHAPE` | A transport handler maps its input, dispatches exactly one command or query through the injected bus and maps the result; it injects nothing else (no EntityManager, no Inbox), holds no branch, loop or other call besides pure mapper functions and `unwrapOutcome` of `platform/primitives`, returns no envelope and takes no `GraphQLJSON`. |
| R89 | `BE_SOURCE_FORM` | Files use the closed role-suffix vocabulary of the slot manifest; named exports only; every export has English JSDoc (its public members: R109); no emoji, and no Vietnamese in identifiers, string literals, comments or test titles outside message catalogs and the i18n fixtures slot; a public input or output is a named contract, never an inline object type; no `Mock*`, `Fake*` or `Stub*` class, function or constant in production source. |
| R90 | `BE_INFRA_OWNER` | Each raw infrastructure library (HTTP, cache, queue, scheduler, logger, date, config, events) is imported or referenced only by its one owning platform or integration capability, and the `HttpClient` port of `platform/http` is called only by an `integrations` capability. |

**Frontend**

| Id | Code | Rule |
| --- | --- | --- |
| R49 | `FE_ENV_OWNER` | Only `modules/config` reads the environment; no localhost fallback. |
| R50 | `FE_TRANSPORT_OWNER` | One `fetch` per front end, in the transport client: `fe/apps/<app>/src/modules/api/client.ts` of a one-app front end or `fe/packages/<family>-api/src/client.ts` shared by every app; timeout and abort; a client read is SWR whose key carries the identity of its result, and a mutation is tied to its resource. |
| R51 | `FE_HTTP_STATUS_COLLAPSE` | One `Outcome<T>` union per front end (the api slot's `outcome.ts`); 401 and 403 become `refused`. |
| R52 | `FE_WIRE_GENERATED` | Wire types generated from the be contract snapshots the fe side reads. |
| R53 | `FE_ERROR_BOUNDARY_MISSING` | Global, locale error, not-found and loading boundaries exist. |
| R54 | `FE_ROUTE_FILES_THIN` | Route files mount one owner; Next conventions (`proxy.ts`, metadata). |
| R55 | `FE_CLIENT_BOUNDARY` | Server first; `"use client"` only where allowed. |
| R56 | `FE_HOOKS_ARE_HOOKS` | `hooks/` hold hooks and one shared file per domain; a product hook is defined only there and imported through its index. |
| R57 | `FE_OWNER_REACHABLE` | Every owner is mounted; every href resolves to a route. |
| R58 | `FE_I18N_LITERAL` | No display text at any tier, no escape comment. |
| R59 | `FE_I18N_PLACEMENT` | `next-intl` with `[locale]`; the next-intl stack is written once per front end: `fe/packages/<family>-i18n` (`createAppI18n`) called by each app's `modules/i18n/index.ts`, or the only app's `modules/i18n/`. |
| R60 | `FE_I18N_CATALOG` | Same keys in every catalog, `pick` for clients. |
| R61 | `FE_STYLE_TOKEN_ONLY` | Token-only CSS; colour only in `brand.css`; every `@source` resolves (sub-check `FE_STYLE_SOURCE_UNRESOLVED`). Status colours follow HeroUI soft pairs: every status tone has `--<tone>-soft` and `--<tone>-soft-foreground` in light and dark, the soft foreground reaches 3:1 on its tint and on `--background`, body text 4.5:1, a solid tone is never text below 4.5:1, and text and icons take the soft foreground, never the solid tone. |
| R62 | `FE_NATIVE_FORM_CONTROL` | No raw form controls, native images or raw structural tags in product tiers; the grammar renders them. |
| R63 | `FE_PACKAGE_SHAPE` | Packages build to `dist` with explicit exports and no dead unit. |
| R64 | `FE_APP_ISOLATION` | Apps never import apps; ui-screen declares `app`. |
| R65 | `FE_SIZE_AND_STATE_BUDGET` | Hook and state budgets; no hand-written poll loop; keyed lists; everything an effect starts is released by its cleanup; no swallowed error or console. |
| R91 | `FE_SOURCE_FORM` | Front-end files sit in their tier folder with the fixed names, export arrow functions named after the folder, carry English JSDoc, no emoji, and no Vietnamese in identifiers, string literals, comments or test titles outside the i18n catalogs and the i18n e2e fixtures slot. |
| R92 | `FE_COMPONENT_API` | A component exposes the canon surface: typed named props and slots, a presentational twin for every connected block, status through the slot view, no className or CSS doors, no resting twin or placeholder prop, class names in the colocated file; a pure component reaches no hook, router, locale or API. |
| R93 | `FE_VENDOR_BOUNDARY` | Vendor primitives and icons reach components only through their named owner: heroicons through the icon leaf at the glyph scale, every vendor primitive behind a named owner; the Grammar package is imported only through its selected code and style entry and keeps its declared contract. |
| R94 | `FE_SLOT_FILE_ROLE` | A front-end file is owned by a slot and named by it: a slot that owns a directory (route, feature, components, hooks, api module) holds only the files its `allows` list names, and holds them inside a folder of its own. |
| R95 | `BE_OPERATION_CONTRACT` | A versioned operation is declared once in the app's typed operation table (`OperationContract<Input, Output, RefusalCode>` registered by `defineOperations`): its input and output are closed types (never `any`, `unknown` or `Record<string, unknown>`), its refusal codes a closed union of string literals, and the route that serves the table takes `OperationRequest<Table>` and answers `Promise<OperationReply<Table>>` of that one table. |
| R96 | `HFS_DOC_NOT_ENGLISH` | Every Markdown and YAML document under a side's docs/, src/ and apps/ (be/, fe/) and under the runtime's knowledge/ and docs/ is English, code fences included; only YAML data in a message-catalog or i18n-fixtures slot may hold another language. |
| R97 | `FE_NO_TESTS` | The front end (`fe/`) has no tests by standard: no `*.spec.*`, `*.test.*` or `*-spec.*` file, no `e2e/`, `__tests__/`, `__mocks__/` or `test-support/` directory, no vitest, Playwright, jest or Cypress configuration or setup file, no test script, and no test-runner, test-environment, testing-library or axe dependency in any `package.json`; there is no exception, `scripts/` included. |
| R98 | `BE_TEST_BUILDER_HOME` | A test data builder lives only in `be/src/tests/fixtures/builders/<area>.builder.ts` (slot `be.tests.fixtures.builders`, its SQL text in `<area>.sql.ts` beside it): a `*.repository.ts`, `*.factory.ts` or `*.fixture.ts` under `be/src/tests` and a `*.builder.ts` elsewhere are BE_SOURCE_FORM findings, and any other module of the test tree that exports a function creating persisted rows through an EntityManager, DataSource or QueryRunner is a builder in the wrong place. |
| R99 | `BE_TEST_ROW_BY_BUILDER` | A unit, integration or e2e spec never hand-builds rows: no raw INSERT/UPDATE/DELETE text, no `save`, `insert`, `upsert`, `update`, `delete` or `remove` on an EntityManager, DataSource or QueryRunner, and no persistence entity built as an object literal more than once in the spec; rows come from the area's builder. |
| R100 | `BE_TEST_CONSTRAINTS_ON` | Nothing under `be/src/tests` disables or drops a database constraint: no `session_replication_role`, `SET CONSTRAINTS ... DEFERRED`, `DEFERRABLE INITIALLY DEFERRED`, `ALTER TABLE ... DISABLE`, `DISABLE TRIGGER`, `DROP CONSTRAINT`, and no `dropForeignKey(s)`, `dropCheckConstraint(s)` or `dropUniqueConstraint(s)` on a QueryRunner; a builder creates the parent chain instead. |
| R101 | `BE_TEST_BUILDER_ARRANGES` | A test data builder arranges data only: it imports no assertion or test-framework global (`expect`, `jest`, `@jest/globals`) and its defaults are deterministic (no `Date.now()`, argless `new Date()`, `Math.random()`, `randomUUID()` or `crypto.random*`). |
| R102 | `BE_SPEC_PLACEMENT` | A back-end spec or test file lives in one of the four test layers and nowhere else: a unit spec `<name>.service.spec.ts` beside its service, or an integration, e2e or contract spec under `be/src/tests/{integration,e2e,contract}`; a `*.spec.*`, `*.test.*` or `*-spec.*` file anywhere else, `scripts/` and `tools/` included, is a finding. |
| R103 | `HFS_REPO_LOCAL_CHECK` | A repository keeps no check, lint rule or lint plugin of its own: no `check-*` file in `scripts/` or `tools/`, no `eslint-local-rules*` or local eslint plugin, no script that runs one; every check lives in the `.claude` runtime and the canons. |
| R104 | `HFS_LINT_SUPPRESSION_FILE` | A repository keeps no lint-suppression file, script or option: no `eslint.suppressions*`, no `lint:suppressions` script, no eslint `--suppress-all` or `--suppressions-location` flag and no suppressions configuration passed to eslint; a finding is fixed in the code. |
| R105 | `HFS_PROOF_COMMAND_FILE_MISSING` | A proof command of a `.starciwork` record (`requiresProof.<kind>.command`) is runnable as written: every repository file it names exists. |
| R106 | `FE_I18N_KEYS` | The catalogs of a front-end app and its source agree both ways: a literal key read through `next-intl` (`useTranslations`, `getTranslations`, `t`, `t.rich`, `t.raw`, `t.markup`) exists in every locale, and a catalog key that no string of the app's or the shared packages' source can be reading is deleted. |
| R107 | `FE_COOKIE_ATTRIBUTES` | A cookie the front end writes through Next's response cookies (`response.cookies.set`, `cookies().set`) states `httpOnly` as a literal (`true` for a session, `false` only for a preference page script reads), carries `secure` and has `sameSite` `lax` or `strict`. |
| R108 | `BE_ERROR_CAUSE_DROPPED` | A `throw` that escapes a `catch` (or a promise `.catch` handler) rethrows the caught value or carries it: the replacement capability error takes the exact caught value as `cause`; a `catch` with no binding throws nothing new. |
| R109 | `BE_MEMBER_DOC_MISSING` | Every public member of an exported class, interface or object type alias in product source opens with English JSDoc: methods, accessors, fields and signatures; a private, protected or `#` member, the constructor, an index signature and a property set to a literal or a named constant are not judged, and overloads of one name share one doc. |
| R110 | `FE_PROPS_MUTABLE` | The props type of an exported rendering function in front-end product source is readonly all the way down: every field and index signature is `readonly`, and every collection it holds, directly or in a nested object, is `readonly T[]`, `readonly [A, B]` or `ReadonlyArray<T>`. |
| R111 | `HFS_PEER_INTEGRATION_MISSING` | An app declares the runtime peer every driver integration it uses needs: when the app root package.json depends on every package of a pair of knowledge/hfs/peer-integrations.yaml (at the named major), it declares the pair's `requires` in its dependencies (`@nestjs/apollo` on `@nestjs/platform-express` 11, Express 5, needs `@as-integrations/express5`). |
