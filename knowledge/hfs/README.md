# StarCi HFS - the one source and storage standard

HFS is the single standard for the tree, the source ownership, the storage and the
shared tooling of every StarCi product repository, backend and frontend, and of `.claude` itself and every example
under `examples/`. This file is the canonical statement. Where another runtime document disagrees with it, this file
wins and the other document is wrong.

The machine-readable parts live next to this file and are read by every check, lint factory, template and message:

| File | Owns |
| --- | --- |
| `slots.yaml` | Every kind of content allowed to exist in a repository: path, presence, tracking, tier, required files, tests, budget, managed template. Versioned `MAJOR.MINOR.PATCH`. |
| `rules.yaml` | The rule catalog (ids from `R01`, no gaps) with finding code, gates and the Vietnamese why text (catalog below). |
| `canon-pins.yaml` | The exact versions of every `@starci/*` package and framework this major supports. |

The pattern cases in `knowledge/patterns/{be,fe,repo}/` explain how to write code and structure files inside these
slots. Each case cites the rule id it implements (`hfsRules`) and the finding code that judges it.

## 1. Principles

1. **One source of law.** The slot manifest and the rule catalog in `.claude` are the only rules. A repository carries
   no rule of its own, no allowlist, no baseline, no suppression file and no local copy of a canon config.
2. **Growth is addition.** A new kind of content is a new slot. A slot is never edited in place inside a major.
3. **One machine at every gate.** Pre-commit, pre-push, op settle, land gate and CI run the same `@starci/hfs` at the
   pinned version. There is no rule only agents can run.
4. **Zero findings is necessary, not sufficient.** A repository is done only when the behavioural conditions in
   section 11 also hold: the real application boots, every feature is composed, every owner is mounted, the contracts
   match, the logger exists.
5. **No backward compatibility.** The day a major lands the previous major stops being valid. A repository without a
   current `hfs.json` accepts migration goals only. There is no compatibility window, alias, shim or dual path.

## 2. Slots, presence and tracking

A slot has an `id`, the `profiles` it exists in (`be`, `fe`), a `path` pattern, a `presence`, a `tracked` state and
optionally a `tier`, `requires`, `allows`, `forbids`, `tests`, `budget`, `managedBy`, `rules` and lifecycle fields.

- `presence`: `required`, `optional`, `opt-in` (legal only when `hfs.json` lists the slot or declares an app of its
  kind) or `forbidden`.
- `tracked`: `tracked` (committed), `ignored` (may exist, must be gitignored, because a tool needs it in place) or
  `external` (must not exist in the working tree at all; `goesTo` names where it lives).
- Every tracked path matches exactly one slot (`HFS_SLOT_UNDECLARED`). A directory that matches a slot with
  `owner: true` is an owner, the unit that imports and cycles are judged on. There is no hand-written owner list.
- A file with `managedBy` is rendered from a template by `hfs sync`; any difference is `HFS_MANAGED_FILE_DRIFT`.

### 2.1 Versioning

- **Patch**: wording, why text, examples. No check result changes.
- **Minor**: add a slot (always `optional` or `opt-in`), an app kind, a protocol, a rule at severity `warn`, or tighten
  a budget that no pinned repository exceeds. Every repository on the same major stays green without edits.
- **Major**: change or remove a slot, make an optional slot required, raise a rule from `warn` to `error`, change the
  direction matrix. It needs owner approval and one migration lane per repository.
- A retired slot gets `retiredIn` and a successor id; afterwards a path matching it belongs to no slot and is `HFS_SLOT_UNDECLARED`.
- A repository pins only the major (`"hfs": 1`) and always runs the newest minor of that major.

### 2.2 Adding something without breaking HFS

| To add | Do | Bump |
| --- | --- | --- |
| Helper or type used by one feature only | `application/support/<name>.ts` (`be.feature.application.support`, optional), a spec beside each file; another feature cannot import it, a second user moves it to a `domain` capability | minor |
| Command line entry | `transport/cli/<name>.cli.ts` in the feature plus an app of kind `cli` (`be.feature.transport.cli`, opt-in); it dispatches one command or query | minor |
| Queue consumer | `transport/message/` in the feature plus an app of kind `worker` | none, declared in `hfs.json` |
| Cron, sweep, outbox publisher | `transport/schedule/<job>.job.ts` | none |
| Another api app or a cli | `apps/<name>` plus its kind in `hfs.json` | none |
| New app kind or protocol | new slot `be.app.<kind>` or `be.transport.<protocol>` | minor |
| Integration (payment, LLM) | `modules/integrations/<provider>/` | none |
| Model code | client in `integrations`, training code in a new slot `repo.ml-artifact`, weights in an object store | minor |
| Human documentation | `docs/{adr,runbooks,guides}/` (`repo.docs`, opt-in) | none |
| Infrastructure | `.starcistacks/<env>/infra/{compose,k8s,terraform}/` | none |
| Mobile app | new slot `fe.app.expo` | minor |
| Shared package | `packages/<pkg>` (`repo.packages`, opt-in, built to `dist`) | none |

## 3. The repository declaration: `hfs.json`

The only file a repository adds. It declares the profile, the project binding, the apps with their kinds, the opt-in slots and the database connections.

```json
{
  "hfs": 1,
  "profile": "be",
  "project": "nivo",
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
}
```

`profile` is `be` or `fe`. `apps` lists every `apps/<name>` with its kind (`api`, `worker`, `migrate`, `cli` for
backends; `next` for frontends). `connections` (backend only) lists every physical database as `{ name, envPrefix }`: the logical name (never the engine) and the prefix of its `<PREFIX>_*` environment keys. A missing `hfs.json`, or a machine
run that analysed zero files for a declared profile, is a failure (`HFS_ARCH_CONFIG_UNREAD`), never "unavailable".
Owners are derived from slots; `hfs.json` holds no owner list, path or disabled rule.

## 4. Repository map: where everything lives

| Content | BE | FE | State | Slot |
| --- | --- | --- | --- | --- |
| `README.md`, `hfs.json`, `package.json`, `package-lock.json`, `.gitignore`, `.gitattributes` | required | required | tracked | `repo.*` |
| `tsconfig*.json`, `eslint.config.mjs`, `.editorconfig`, `.nvmrc`, `.npmrc`, `.prettierignore` | required | required | tracked, thin `extends` stubs | `repo.tool-config` |
| `sonar-project.properties`, `codecov.yml` | required | required | tracked, generated by `hfs sync` | `repo.quality-config` |
| `.husky/`, `.github/workflows/{ci,e2e}.yml` | required | required | tracked, generated by `hfs sync` | `repo.hooks`, `repo.ci` |
| `apps/<app>/` | required | required | tracked | `be.app.*`, `fe.app.*` |
| `apps/<app>/Dockerfile`, `.dockerignore` | optional | optional | tracked | `repo.app-image` |
| `src/{features,modules,tests}` | required | forbidden | tracked | `be.*` |
| `packages/<pkg>/` | opt-in | opt-in | tracked, must build | `repo.packages`, `fe.package.ui` |
| `scripts/<name>.mjs` | optional | optional | tracked, lasting tooling only | `repo.scripts` |
| `docs/{adr,runbooks,guides}/` | opt-in | opt-in | tracked, images at most 500 KB | `repo.docs` |
| `e2e/` at the root | forbidden | optional | tracked | `fe.e2e` |
| `contracts/<app>/schema.graphql` | opt-in | none | tracked, the one committed machine-emitted file | `be.contract.*` |
| `apps/<app>/src/modules/api/contract/*` | none | opt-in | tracked, hash-checked copy | `fe.contract.copy` |
| `.starciwork/` | required | forbidden | tracked, product records only | `be.starciwork` |
| `.starcistacks/`, `.sops.yaml` | required | forbidden | tracked, secrets only as `*.enc` | `be.starcistacks`, `be.sops` |
| `node_modules`, `dist`, `.next`, `coverage`, `test-results`, `playwright-report`, `next-env.d.ts`, `*.tsbuildinfo` | may exist | may exist | ignored | `repo.build-output` |
| `__generated__/`, Nest `schema.gql` | may exist | may exist | ignored, produced by `codegen` | `repo.generated` |
| `.eslintcache`, `.turbo`, `.scannerwork`, `.jest-cache`, `.cache`, `.tools` | forbidden | forbidden | external to `%LOCALAPPDATA%/StarCi/cache/<repo>/<tool>/` | `repo.tool-cache` |
| Worktrees | forbidden | forbidden | external to `D:/starci-lanes/<project>/<lane>/` | `repo.worktrees` |
| Agent output (reports, logs, `nul`, `.qwen*`, `.artifacts`, `design-plans/`, draw rounds, UAT captures) | forbidden | forbidden | external: scratchpad or blob store, cited by `{name, sha256}` | `repo.agent-output` |
| Plaintext secrets (`.env*`, `.secrets/`, `*.pem`, `runtime/files/*`) | forbidden | forbidden | external: sealed at `.starcistacks/<env>/secrets/<slug>.enc` | `repo.plaintext-env` |

**Agent evidence is not tracked.** Evidence, logs, captures, UAT runs and draw rounds live in the blob store and the
runtime ledger; a record cites them by hash. The single exception is the accepted design direction image of a
ui-screen (`features/<feature>/ui/<name>/assets/<file>`), which is product content and is tracked. Initial and
intermediate draw images and prompt files are agent data.

## 5. Backend

The rules of this section are the owner-locked back-end convention of 2026-09-30. Each rule id (R..) is a row of the
catalog in section 12; the pattern files in `knowledge/patterns/be/` cite them and give the code forms.

### 5.1 Source tree

```text
apps/<app>/src/                       kind api | worker | migrate | cli, declared in hfs.json
  main.ts                             at most 80 lines: build EnvSource once, parse options, bootstrap, handle startup failure
  app.module.ts                       at most 250 lines: AppModule.register(options), each capability once with isGlobal true, transports
  <app>.options.ts                    the options type of the app
  <app>.composition.spec.ts           required: boots the REAL AppModule with stubbed options, resolves real tokens
src/features/<feature>/
  index.ts                            module class and the contract an app needs; no export *
  <feature>.module.ts                 application module (handlers)
  application/                        <action>.command.ts | <action>.query.ts, <action>.handler.ts, <action>.contracts.ts, specs
  application/support/                opt-in by need: helpers and types local to this one feature, a spec beside each file
  transport/graphql/                  <feature>-graphql.module.ts, <action>.resolver.ts, <action>.mapper.ts, dto/
  transport/http/                     opt-in: <feature>-http.module.ts, <action>.controller.ts, dto/ (webhooks, OAuth, health, byte streams)
  transport/websocket/                opt-in: <feature>-websocket.module.ts, <channel>.gateway.ts
  transport/message/                  opt-in: <feature>-message.module.ts, <event>.consumer.ts
  transport/schedule/                 opt-in: <feature>-schedule.module.ts, <job>.job.ts
  transport/cli/                      opt-in: <feature>-cli.module.ts, <name>.cli.ts; composed only by an app of kind cli
  messages/                           opt-in: <feature>.messages.ts (vi and en copy)
src/modules/domain/<capability>/      index.ts, module, module-definition, options, config, decorators, log-events, errors/, persistence/, messages/, services
src/modules/platform/<capability>/    composition, config, errors, primitives, logging, clock, cqrs are required; database, http, retry, inbox, outbox, ... by need
src/modules/integrations/<provider>/  index.ts, <provider>.config.ts, <provider>.decorators.ts, <provider>.client.ts, errors/
src/tests/e2e/<area>/*.e2e-spec.ts    plus e2e/live/<area>/ and e2e/setup/
src/tests/fixtures/                   typed builders, mock<T>() doubles, database.ts; never imports a feature
contracts/<app>/schema.graphql        opt-in committed contract
```

Nothing else exists at `src/` level, and no `types`, `constants`, `utils`, `helpers`, `shared`, `common`, `testing` or
`exceptions` folder exists under `src/modules` or `src/features` (R01, R89). Files carry a role suffix from the closed
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
outside `persistence/migrations/**`, no entity or migration glob. `apps/migrate` is the only process that runs migrations,
once per connection, before api and worker start. Entities and migrations live in `persistence/{entities,migrations}/` of
the capability that owns the table; the owner's `index.ts` exports `<c>Entities` and `<c>Migrations` and the app composes
them per connection. Migrations are `<epochMs13>-<kebab-name>.ts`.

One physical database is one connection (`hfs.json` `connections`), one `<conn>.connection.ts`, one `<conn>.config.ts` and
one injector `Inject<Conn>EntityManager()` in `platform/database` (R84). The database is reached through that shared
`EntityManager`, injected with the named injector and called directly: `getRepository`, `@InjectRepository`,
`Repository<T>`, repository or store classes, QueryBuilder, a `DataSource` or `QueryRunner` outside `platform/database`,
`apps/migrate` and the test bootstrap `src/tests/fixtures` do not exist; specs use the fixture's `EntityManager` (R83). A handler opens the transaction with
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
`extends ICQRSHandler` and overrides `process`; there is no use-case class, forwarder service or in-process event (R87).
A transport injects only the command or query bus, dispatches exactly one message, returns no envelope and takes no
`GraphQLJSON` (R88). Each transport has exactly one Nest module `<feature>-<protocol>.module.ts`, plus one application
module; never one module per operation.

A capability module is `@Module` extending `ConfigurableModuleClass` from a typed `ConfigurableModuleBuilder<Options>`, and
its only registration method is `register`. Each capability has one representative module, registered exactly once per app
in `apps/<app>/src/app.module.ts` as `X.register({ isGlobal: true, ...options.x })`; it may import its own sub-modules as
plain imports. No module imports another capability's representative module; other capabilities reach it through its
injectors. `isGlobal: true` appears only at an app root and `@Global()` nowhere (R45).

Every infrastructure dependency arrives through a zero-argument `Inject<Thing>()` exported from its owner's
`<owner>.decorators.ts` over a `unique symbol` token; raw `@Inject(`, `ModuleRef`, `forwardRef` and property injection do
not exist (R85). Every feature and every transport module is composed by at least one app. Apps hold only `main.ts`,
`app.module.ts`, `<app>.options.ts` and the composition spec. Entrypoints exist only in `apps/*/src` (R33).

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
expression of a consumer or signed-webhook handler is `inbox.claim(source, eventId)` on a receiver typed `Inbox`, and a
`false` answer returns without effect (R80). A loop that catches an error and waits before trying again goes through
`platform/retry` (bounded attempts, exponential backoff with jitter, an abort signal), never a loop written at the call
site (R81). No transaction spans an external call: commit first and call out after, or enqueue an outbox message inside
the transaction (R82). Each has an `eslint-be` enforcer in `@starci/eslint-canon-be`.

## 6. Frontend

### 6.1 Source tree

```text
apps/<app>/
  package.json, next.config.ts, tsconfig.json, postcss.config.mjs, vitest.config.ts, Dockerfile?, public/
  src/app/                            global-error.tsx, [locale]/{layout,error,not-found}.tsx, [locale]/**/page.tsx, globals.css
  src/proxy.ts | instrumentation*.ts  framework-pinned root files; middleware.ts is refused (Next 16 uses proxy.ts)
  src/features/{pages,layouts,overlays}/<Name>/
  src/components/{blocks,composites,branches,leaves}/<Name>/
  src/hooks/<domain>/                 use<Name>.ts and one <domain>.shared.ts
  src/modules/api/                    client.ts, outcome.ts, <domain>/read-*.ts, <domain>/*.graphql, contract/, __generated__/
  src/modules/config/                 the only reader of the environment
  src/modules/i18n/                   config.ts, routing.ts, navigation.ts, request.ts, messages/<locale>.json
  src/modules/routes/                 every href builder
  src/modules/brand/brand.css         the only app file holding colour values
packages/<family>-ui/                 opt-in, built to dist
e2e/<area>/*.e2e-spec.ts              plus e2e/{support,fixtures}/, playwright.config.ts, tsconfig.e2e.json at the root
```

### 6.2 Rules

- **Direction.** route to feature; feature to components, hooks, modules; components descend blocks to composites to
  branches to leaves; hooks to modules; modules to modules, acyclic; apps never import each other (R27, R64).
- **`hooks/` are hooks (R56).** `hooks/<domain>/` holds React hooks (`use*.ts`, one hook per file) and one
  `<domain>.shared.ts` for shared non-hook helpers. Server readers (fetch and map, no React) live in
  `modules/api/<domain>/read-*.ts`, wrapped in React `cache()` when several blocks call them in one request.
- **Data transport (R50 to R52).** One client per app: `modules/api/client.ts` is the only `fetch`, with a timeout and
  `AbortSignal` and no module-level `let` for a token or locale. It returns
  `Outcome<T> = ok | refused (401/403, code) | invalid (issues) | not-found | unavailable (code, retryable)`. `401` and
  `403` become `refused`; a status is never collapsed into null and server text is never shown as a reason. Wire types
  are generated from the contract copy (`codegen` writes the ignored `__generated__/`); GraphQL documents are `.graphql`
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
  `as-needed`, and `src/proxy.ts` (not `middleware.ts`) for locale routing. `modules/i18n/` holds `config.ts`,
  `routing.ts`, `navigation.ts`, `request.ts` and `messages/<locale>.json`. No display text at any tier (block, page,
  layout, `aria-label`, `title`, `placeholder`, `alt`) in any language; there is no escape comment. A single-language app
  still uses `next-intl` with one locale. Catalogs of all locales have the same key set and specs use the real catalog.
  `<html lang>` is set by the `[locale]` layout.
- **CSS and tokens (R61, R62).** Only Grammar tokens. The Common tier reads only Grammar role tokens; a family supplies
  their values. `app/globals.css` contains only `@import` and `@source` in the standard order and every `@source`
  resolves. Colour values live only in `modules/brand/brand.css`, set only declared Grammar brand tokens, in light and
  dark, checked against the brand record. Forbidden: `*.module.css`, class selectors in app CSS, `!important`, hex, oklch
  or rgb outside `brand.css`, declaring `--<family>-*` in an app, breakpoints outside the Grammar scale, raw `<select>`,
  `<input>`, `<textarea>`, `<button>` in product tiers. `@starci/stylelint-canon` runs like the ESLint canon.
- **Packages (R63).** A shared UI package is `packages/<family>-ui`, built to `dist`, explicit `exports`, no
  `export *`, only composites, branches and leaves, no colour literal, no unused export. Family token values are a
  family entry of `@starci/grammar`.
- **Multiple apps (R64).** One independent `apps/<app>` per app; shared code only through `packages/*`. A design draft
  is a branch, not a second app. The `work/ui-screen@2` record declares `app`, a name from `hfs.json.apps`.
- **Budgets (R65).** Connected units have at most 6 data hooks and 6 `useState`; component 300 lines; `index.tsx` 200;
  hook 200; module 400.

## 7. Tests

- Two kinds only: unit `<name>.spec.ts(x)` beside the subject, and e2e `*.e2e-spec.ts`. Backend e2e sits in
  `src/tests/e2e/<area>/`, environment code in `src/tests/e2e/setup/`, data in `src/tests/fixtures/`. Frontend e2e sits
  in the root `e2e/`, Playwright only.
- E2E runs by hand: no husky, lint-staged, default typecheck, coverage, Codecov or automatic CI; the e2e workflow is
  `workflow_dispatch` only (R12).
- Backend: one `jest.config.js` (preset `@starci/jest-preset`) with exactly the projects `unit` and `e2e`; ts-jest
  `diagnostics: false` and `isolatedModules: true`; types are checked by `typecheck` (unit specs included) at pre-push
  and CI and by `typecheck:e2e` for e2e. `test:e2e` is `npm run typecheck:e2e && jest --selectProjects e2e`.
  `test:e2e:live` filters by the folder `src/tests/e2e/live/` (`E2E_LIVE=1`), never by file name, and differs from
  `test:e2e` (R47).
- Backend e2e boots the real `AppModule` and overrides providers; it never hand-assembles a lane module. Fixtures are
  typed builders and `mock<T>()` from `@starci/jest-preset`, not `as never` or `as unknown as`; they never import a
  feature. No `testing/` folder in `src/modules`. A spec does not read source code with `fs` (R48).
- Frontend: Playwright projects for 1440x900, 768x1024 and 390x844; no absolute path, docker call or write to another
  repository; no `test.skip` for a missing environment; one axe assertion per connected screen; no class-string pinning
  in component specs (R66, R67).
- Write or update the spec of the source you change and run only the affected specs. The whole suite runs only at push.

## 8. `.starciwork`, `.starcistacks`, secrets

- `.starciwork` (backend only) holds flat product records `features/<f>/<family>/<name>/index.yaml`, `br/<rule>/ac/<name>/`,
  `workspace.yaml`, `brand/`, `shell/index.yaml`, `_resources/{identities,environments,fixtures}/<slug>/resource.yaml`
  and accepted ui-screen assets. There is no `work/node` record (R08). `_derived/` is generated and not tracked.
- An identity record holds role, provider, realm and `custody.sealed: .starcistacks/<env>/secrets/identity-<slug>.enc`
  (R09). UAT `accounts.yaml` selects an identity by role; several flows share one identity per role. A record that holds
  no secret uses `custody.provider: none`.
- `.starcistacks` (backend only) is `application-stacks.yaml` plus `<env>/{README.md, environment.json,
  infra/{compose,k8s,terraform}, runtime/{config,env}, secrets/<slug>.enc, seeds/}`. There is no `runtime/files/`.
  `runtime/env/KEYS.md` names slugs only. The Sonar block is `owner: host` and points at `.claude/ext/sonar`. Root
  `DESIGN.md`, `deployment.json` and `k8s/` do not exist (R10).
- Secrets exist only as sops `*.enc` at `.starcistacks/<env>/secrets/<slug>.enc`. A decrypted value is never written into
  the repository tree, ignored or not; it lives in memory or under `%LOCALAPPDATA%/StarCi/secrets/<project>/<env>/`
  and is passed by `*_FILE` (R06). Agents never read, print or commit a secret value and never generate or rotate keys.
  Owner ruling 2026-09-29: ONE shared master age identity (`~/.starci/master.identity`) decrypts every project's SOPS
  custody; every project's envelopes are encrypted to that one master recipient, and the stack text says so.

## 9. Shared tooling, formatter, pins, budgets

- Every config is a thin call into a `.claude` package: `starciBeConfig({ hfs })`, `starciFeConfig({ hfs })`,
  `@starci/tsconfig/{be,fe,e2e}.json`, `@starci/prettier-config`, `@starci/jest-preset`, `@starci/vitest-preset`,
  `@starci/playwright-preset`, `@starci/stylelint-canon`, and the `@starci/hfs` CLI (`check`, `sync`, `contract:*`).
  Files that cannot extend (husky, workflow, `.gitignore` block, sonar, codecov) are generated by `hfs sync` and
  hash-checked. A repository defines and disables no rule (R16, R17). `noInlineConfig: true`: no `eslint-disable`, no
  `@ts-ignore`, no `@ts-expect-error` (R18). `@starci/grammar` is installed from the npm registry at the pinned version; the other packages are consumed from the runtime checkout (`STARCI_HOME`) and are not published.
- **Formatter.** Prettier only: `printWidth` 120, `tabWidth` 4, `semi` false, `singleQuote` false, `trailingComma`
  `all`. No ESLint formatting rule exists. Pre-commit runs `prettier --write` on staged files, CI `prettier --check` (R19).
- **Pins.** `canon-pins.yaml` holds exact versions. One version per dependency in the workspace, root `overrides` for
  react, next and grammar, no nested copies (R14, R15). Raising a version is a change in `.claude` first, then
  `hfs sync` raises the repositories. `tsconfig` extends `@starci/tsconfig` with `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `allowJs: false` and never lowers a flag (R22).
- **Size budgets.** Backend file 500 lines, function 80, `app.module.ts` 250, `index.ts` 60 exports, feature 250 source
  files. Frontend component 300, connected `index.tsx` 200, hook 200, module 400. The mechanism is no-growth
  (`HFS_SIZE_GROWTH`): a new file is inside the budget, a file already over its budget gains no lines against its parent
  commit. There is no baseline and no allowlist (R20). A duplicated block at or above the one threshold
  `ruleParams.<profile>.duplicateBlock` of `slots.yaml`, and a helper defined twice under the same name, fail (R21).
- **Contracts.** The backend commits `contracts/<app>/schema.graphql` (CI re-emits and compares); a frontend keeps a
  hash-checked copy (R23).

## 10. Gates

| Gate | Runs | Target | Rules |
| --- | --- | --- | --- |
| PC pre-commit | lint-staged: Prettier, ESLint canon on staged files, stylelint, secrets guard | under 10 s | R06, R07, R18, R19, R34, R40, R41, R43 to R45, R49, R55, R58, R61, R62 |
| PP pre-push | `typecheck`, `lint:check`, `hfs check --fast`, affected unit specs | under 2 min | PC plus R01, R03 to R05, R12 to R15, R22, R26, R27, R30 |
| OS op settle | `hfs check --paths <owned paths>` and ESLint on the op's paths; a red result does not settle | per op | every file-level and owner-level rule in scope |
| LG land gate | full `hfs check` including reachability, composition, contract, size growth, duplicates; canon scan; unit; build | per repo | every rule |
| CI GitHub | the same pinned `npx @starci/hfs check`, lint, typecheck, unit with coverage, build, `prettier --check` | | as LG except R23 on the frontend |
| SQ Sonar | duplication, cognitive complexity, coverage on new code | | R20, R21 (second gate) |

A rule's gates are data in `rules.yaml`; adding a rule to a gate edits the manifest, not a repository.

## 11. Done for a repository

1. `hfs check` has zero findings for every rule at the pinned version, and CI runs it.
2. The composition spec of every app boots the real `AppModule` and is green.
3. No feature or owner is left uncomposed or unmounted; no dead export.
4. The backend and frontend contracts match by hash.
5. `typecheck`, `lint:check`, `build`, `test:unit`, `prettier --check` and the Sonar gate are green.
6. `typecheck:e2e` and `lint:e2e` are green; e2e still runs by hand.
7. `git status` is clean, with no untracked entry outside a slot marked `ignored`.

## 12. Rule catalog

Every rule is an error from 2.0. Finding code, then the rule. The pattern files cite these ids.

**Repository, slots, storage**

| Id | Code | Rule |
| --- | --- | --- |
| R01 | `HFS_SLOT_UNDECLARED` | Every tracked path matches exactly one slot. |
| R02 | `HFS_SLOT_REQUIRED_MISSING` | A slot is missing a required file (feature `index.ts`, app composition spec, FE `global-error.tsx`). |
| R03 | `HFS_UNTRACKED_ROOT_ENTRY` | No untracked or ignored entry outside an `ignored` slot. |
| R04 | `HFS_GITIGNORE_BLOCK_DRIFT` | The managed `.gitignore` block equals its render. |
| R05 | `HFS_MANAGED_FILE_DRIFT` | A managed file equals its template render. |
| R06 | `HFS_PLAINTEXT_SECRET` | Secrets exist only as `.starcistacks/<env>/secrets/<slug>.enc`. |
| R07 | `HFS_AGENT_DATA_TRACKED` | `.starciwork` holds product records only. |
| R08 | `HFS_WORK_NODE_RETIRED` | Only flat family records, never `work/node`. |
| R09 | `HFS_IDENTITY_CUSTODY` | An identity points its secret at `secrets/identity-<slug>.enc`; UAT chooses by role. |
| R10 | `HFS_STACKS_SHAPE` | `.starcistacks` has the standard shape and the host Sonar owner. |
| R11 | `HFS_SONAR_CONFIG` | Sonar config is generated, with no host URL and matching coverage exclusions. |
| R12 | `HFS_E2E_IN_AUTOMATIC_GATE` | e2e never joins husky, coverage or automatic CI. |
| R13 | `HFS_CI_MISSING_CANON` | CI runs the pinned `@starci/hfs check`; pre-push runs typecheck and lint; a clone never redirects `core.hooksPath` away from husky. |
| R14 | `HFS_DEP_VERSION_SKEW` | One version per dependency in the workspace. |
| R15 | `HFS_CANON_PIN_DRIFT` | Canon packages and frameworks match `canon-pins.yaml`. |
| R16 | `HFS_TOOL_CONFIG_LOCAL` | Configs only call the factories; no local rules. |
| R17 | `HFS_RULE_OFF_WITHOUT_REPLACEMENT` | A rule is off only when its replacement check is in a repository gate. |
| R18 | `HFS_INLINE_SUPPRESSION` | No inline suppression of any kind. |
| R19 | `HFS_FORMAT` | Prettier is the only formatter. |
| R20 | `HFS_SIZE_GROWTH` | Over-budget files do not grow; new files are inside budget. |
| R21 | `HFS_DUPLICATE_CODE` | No duplicated blocks or twice-defined helpers. |
| R22 | `HFS_TS_STRICT` | tsconfig extends `@starci/tsconfig` and lowers no flag; no assertion, `!` or `any` in product source. |
| R23 | `HFS_CONTRACT_SNAPSHOT_DRIFT` | Contract snapshot equals the emit, the FE copy equals the BE. |
| R24 | `HFS_ARCH_CONFIG_UNREAD` | The machine reads `hfs.json`; zero files analysed is red. |
| R25 | `HFS_UNUSED_EXPORT` | No public export without a consumer; no source file nothing reaches. |

**Backend**

| Id | Code | Rule |
| --- | --- | --- |
| R26 | `BE_TIER_DIRECTION` | The tier direction matrix. |
| R27 | `ARCH_OWNER_CYCLE` | No owner cycles, type-only included. |
| R28 | `BE_FEATURE_IMPORTS_FEATURE` | A feature never imports a feature. |
| R29 | `BE_FEATURE_SHAPE` | Feature root is `index.ts`, module, `application/`, `transport/<protocol>/`. |
| R30 | `BE_PUBLIC_SURFACE` | Every owner has one `index.ts`; cross-owner imports use it, same-owner imports are relative and never go through it; it holds only named `export { }` lines, no `export *`, no alias re-export, at most 60 exports. |
| R31 | `BE_FEATURE_NOT_COMPOSED` | Every feature and transport module is composed by an app. |
| R32 | `BE_APP_COMPOSITION_ONLY` | Apps compose only; the composition spec boots the real module. |
| R33 | `BE_ENTRYPOINT_ONLY_IN_APPS` | Entrypoints only in `apps/*/src`. |
| R34 | `BE_SCHEMA_AUTHORITY` | Migrations are the only schema authority; `synchronize` is `false`. |
| R35 | `BE_SCHEMA_OWNER` | Entities and migrations live in the owning capability's `persistence/`. |
| R36 | `BE_SQL_OUTSIDE_PERSISTENCE` | Raw SQL is `sql`-tagged `SqlText` in `persistence/<name>.sql.ts` of the owning capability; `.query()` takes only `SqlText`; no QueryBuilder. |
| R37 | `BE_ENTITY_IN_CONTRACT` | No ORM entity in a contract or transport type. |
| R38 | `BE_ERROR_HOME` | Errors live in the owning capability's `errors/` and extend `DomainError`. |
| R39 | `BE_ERROR_MASKED` | One filter per app; undeclared errors are masked. |
| R40 | `BE_LOGGER_REQUIRED` | `platform/logging` exists and its `Logger` port is the only logger; every `catch` logs, rethrows or returns a reasoned outcome, and a log call names its event with a member of an owner's `<owner>.log-events.ts` enum. |
| R41 | `BE_DEFAULT_DENY` | APP_GUARD plus `@Public({ reason: PublicReason.X })`; no `@UseGuards`; typed bodies; `timingSafeEqual`. |
| R42 | `BE_INPUT_BOUNDED` | Bounded input, cursor-only pagination, depth limits, rate limits; every property of an input class carries the `class-validator` decorators its type calls for. |
| R43 | `BE_CONFIG_OWNER` | Only `platform/config` reads `process.env`; config per capability. |
| R44 | `BE_SECRET_DEFAULT` | No default for a secret key or infrastructure URL. |
| R45 | `BE_MODULE_SHAPE` | `@Global` nowhere and `isGlobal: true` only at app roots; no cross-owner module imports; typed options; one module per transport. |
| R46 | `BE_BACKGROUND_UNOWNED` | Every sweep, outbox or retry has a job or consumer run by a worker app. |
| R47 | `BE_TEST_TOPOLOGY` | One jest config, projects `unit` and `e2e`, live by folder, `diagnostics: false`; a handler, domain service, consumer, job, guard, mapper, policy, client and row mapper has a twin spec beside it; no `.test.ts`, `int-spec` or `harness-spec`. |
| R48 | `BE_SPEC_QUALITY` | No source-reading specs; a spec asserts results or state, not only calls; no `as` and no `x!` in a spec (the borrowed rules of R72); an e2e enters through transport, waits with `waitFor`, boots through `src/tests/e2e/setup`, reads persisted state back and reaches no model provider. |
| R68 | `BE_SQL_INTERPOLATED` | SQL text carries no runtime substitution; values are numbered parameters. |
| R69 | `BE_QUERY_UNBOUNDED` | A read that can return many rows states `take`, `limit` or `LIMIT`, or pages by cursor. |
| R70 | `BE_HTTP_TIMEOUT` | Every outbound `fetch`, axios or HttpService call states a timeout or an abort signal. |
| R71 | `BE_LOG_SECRET` | A `Logger` call carries no `Secret` or `Pii` value and no credential or personal identifier by name; log an id or a masked form. |
| R72 | `BE_TYPE_ESCAPE` | No type escape in any file, specs included: no `as X` (only `as const`), `<X>y`, `x!` or `any` (the factory turns on the typescript-eslint rules `consistent-type-assertions` with `never`, `no-non-null-assertion` and `no-explicit-any`), no `Function` type, no `eval`. |
| R73 | `BE_ASYNC_NO_AWAIT` | An `async` function contains an `await`; otherwise it is not `async`. |
| R74 | `BE_MIGRATION_REVERSIBLE` | Every migration declares a `down()` that reverses its `up()`; never empty, never a bare throw. |
| R75 | `BE_RETURN_TYPE` | Handlers and public methods of an Injectable, Resolver or Controller declare their return type. |
| R76 | `BE_JSON_PARSE_UNGUARDED` | `JSON.parse` sits inside a `try` in its own function and fails as a typed outcome. |
| R77 | `BE_QUERY_IN_LOOP` | A repository, entity-manager or query-builder read does not run once per element of a loop; read once before the loop by key list. |
| R78 | `BE_USER_COPY_LITERAL` | A literal exception message, notification text or response copy comes from the per-capability messages catalog through the typed `MessageCatalog` port, not from source. |
| R79 | `BE_AMBIENT_CLOCK` | `Date.now`, a bare `new Date()`, `performance.now`, `process.hrtime` and `Temporal.Now` are referenced only inside `platform/clock`, specs included; code asks the injected `Clock` port and specs use `FakeClock`. |
| R80 | `BE_INBOX_DEDUPE_MISSING` | Every consumer and every `SignedWebhook` handler makes `claim(source, eventId)` on the `Inbox` port its first awaited expression and returns early when the claim answers `false`. |
| R81 | `BE_HAND_ROLLED_RETRY` | A loop that catches an error and waits before trying again goes through the shared `platform/retry` helper, never a hand-written loop. |
| R82 | `BE_TRANSACTION_EXTERNAL_CALL` | No transaction spans an external call; commit first and call out after, or write an outbox message inside the transaction. |
| R83 | `BE_UNNAMED_DATA_ACCESS` | The database is reached through the shared EntityManager, injected as a constructor parameter by the `Inject<Conn>EntityManager()` of a declared connection and called directly; no bare `@InjectEntityManager()`, `getRepository`, repository, QueryBuilder or property injection; a `DataSource` or `QueryRunner` only in `platform/database`, `apps/migrate` and the test bootstrap `src/tests/fixtures`, whose EntityManager the specs use. |
| R84 | `BE_CONNECTION_DUPLICATE` | One physical database is one connection and one `Inject<Conn>EntityManager()` injector declared once in `platform/database`; `hfs.json` connections, connection files, injectors and module registrations correspond one to one. |
| R85 | `BE_RAW_INJECT` | Every injected infrastructure dependency arrives through a zero-argument `Inject<Thing>()` from its owner's `<owner>.decorators.ts` over a `unique symbol` token; raw `@Inject(` exists only there. |
| R86 | `BE_SQL_TABLE_OWNER` | SQL writes only the tables of its own capability's entities, reads only tables of owners it may import, and every multi-row SELECT is bounded. |
| R87 | `BE_CQRS_SHAPE` | The application layer is CQRS: typed `Command<R>`/`Query<R>` messages carrying one `params`, handlers extending `ICQRSHandler` that override `process`; no use-case classes, forwarder services or in-process events. |
| R88 | `BE_TRANSPORT_SHAPE` | A transport handler maps its input, dispatches exactly one command or query through the injected bus and maps the result; it injects nothing else, returns no envelope and takes no `GraphQLJSON`. |
| R89 | `BE_SOURCE_FORM` | Files use the closed role-suffix vocabulary of the slot manifest; named exports only; every export and public member has English JSDoc; no emoji or Vietnamese outside message catalogs. |
| R90 | `BE_INFRA_OWNER` | Each raw infrastructure library (HTTP, cache, queue, scheduler, logger, date, config, events) is imported or referenced only by its one owning platform or integration capability. |

**Frontend**

| Id | Code | Rule |
| --- | --- | --- |
| R49 | `FE_ENV_OWNER` | Only `modules/config` reads the environment; no localhost fallback. |
| R50 | `FE_TRANSPORT_OWNER` | One `fetch` in `modules/api/client.ts`, with timeout and abort. |
| R51 | `FE_HTTP_STATUS_COLLAPSE` | One `Outcome<T>`; 401 and 403 become `refused`. |
| R52 | `FE_WIRE_GENERATED` | Wire types generated from the contract copy. |
| R53 | `FE_ERROR_BOUNDARY_MISSING` | Global, locale error, not-found and loading boundaries exist. |
| R54 | `FE_ROUTE_FILES_THIN` | Route files mount one owner; Next conventions (`proxy.ts`, metadata). |
| R55 | `FE_CLIENT_BOUNDARY` | Server first; `"use client"` only where allowed. |
| R56 | `FE_HOOKS_ARE_HOOKS` | `hooks/` hold hooks and one shared file per domain. |
| R57 | `FE_OWNER_REACHABLE` | Every owner is mounted; every href resolves to a route. |
| R58 | `FE_I18N_LITERAL` | No display text at any tier, no escape comment. |
| R59 | `FE_I18N_PLACEMENT` | `next-intl`, `[locale]`, `modules/i18n/`. |
| R60 | `FE_I18N_CATALOG` | Same keys in every catalog, real catalog in specs, `pick` for clients. |
| R61 | `FE_STYLE_TOKEN_ONLY` | Token-only CSS; colour only in `brand.css`; every `@source` resolves (sub-check `FE_STYLE_SOURCE_UNRESOLVED`). |
| R62 | `FE_NATIVE_FORM_CONTROL` | No raw form controls in product tiers. |
| R63 | `FE_PACKAGE_SHAPE` | Packages build to `dist` with explicit exports and no dead unit. |
| R64 | `FE_APP_ISOLATION` | Apps never import apps; ui-screen declares `app`. |
| R65 | `FE_SIZE_AND_STATE_BUDGET` | Hook and state budgets; no hand-written poll loop; keyed lists; timers cleared; no swallowed error or console. |
| R66 | `FE_E2E_SHAPE` | Playwright shape, three viewports, no environment coupling. |
| R67 | `FE_SPEC_QUALITY` | No class pinning, no barrel specs, axe per connected screen. |
| R91 | `FE_SOURCE_FORM` | Front-end files sit in their tier folder with the fixed names, export arrow functions named after the folder, carry English JSDoc and no emoji. |
| R92 | `FE_COMPONENT_API` | A component exposes the canon surface: typed named props and slots, a presentational twin for every connected block, status through the slot view, no className or CSS doors, no resting twin or placeholder prop, class names in the colocated file. |
| R93 | `FE_VENDOR_BOUNDARY` | Vendor primitives and icons reach components only through their named owner: heroicons through the icon leaf at the glyph scale, every vendor primitive behind a named owner, no internal StarCi href. |
