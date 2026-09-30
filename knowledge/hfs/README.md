# StarCi HFS - the one source and storage standard

HFS is the single standard for the tree, the source ownership, the storage and the
shared tooling of every StarCi product repository, backend and frontend, and of `.claude` itself and every example
under `examples/`. This file is the canonical statement. Where another runtime document disagrees with it, this file
wins and the other document is wrong.

The machine-readable parts live next to this file and are read by every check, lint factory, template and message:

| File | Owns |
| --- | --- |
| `slots.yaml` | Every kind of content allowed to exist in a repository: path, presence, tracking, tier, required files, tests, budget, managed template. Versioned `MAJOR.MINOR.PATCH`. |
| `rules.yaml` | The rule catalog `R01` to `R83` with finding code, gates and the Vietnamese why text (catalog below). |
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
- A retired slot gets `retiredIn` and a successor id; afterwards a path matching it is `HFS_SLOT_RETIRED`.
- A repository pins only the major (`"hfs": 1`) and always runs the newest minor of that major.

### 2.2 Adding something without breaking HFS

| To add | Do | Bump |
| --- | --- | --- |
| Helper or type used by one feature only | `application/support/<name>.ts` (`be.feature.application.support`, optional), a spec beside each file; another feature cannot import it, a second user moves it to a `domain` capability | minor |
| Command line entry | `transport/cli/<command>.command.ts` in the feature plus an app of kind `cli` (`be.feature.transport.cli`, opt-in); it calls application use cases only | minor |
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
  "connections": ["primary", "agentos"]
}
```

`profile` is `be` or `fe`. `apps` lists every `apps/<name>` with its kind (`api`, `worker`, `migrate`, `cli` for
backends; `next` for frontends). `connections` (backend only) names the databases. A missing `hfs.json`, or a machine
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

### 5.1 Source tree

```text
apps/<app>/src/                       kind api | worker | migrate | cli, declared in hfs.json
  main.ts                             read EnvSource once, parse options, bootstrap, handle startup failure
  app.module.ts                       AppModule.register(options): feature transport modules and capability modules
  <app>.options.ts                    optional options type of the app
  <app>.composition.spec.ts           required: boots the REAL AppModule with stubbed options, resolves real tokens
src/features/<feature>/
  index.ts                            module class and the contract an app needs; no export *
  <feature>.module.ts                 application module (use cases)
  application/                        <action>.use-case.ts, <action>.contracts.ts, optional command/query/handler, specs
  application/support/                opt-in by need: helpers and types local to this one feature, a spec beside each file
  transport/http/                     <feature>-http.module.ts, <action>.controller.ts, dto/
  transport/graphql/                  <feature>-graphql.module.ts, <action>.resolver.ts, dto/
  transport/message/                  opt-in: <feature>-message.module.ts, <event>.consumer.ts
  transport/schedule/                 opt-in: <feature>-schedule.module.ts, <job>.job.ts
  transport/cli/                      opt-in: <feature>-cli.module.ts, <command>.command.ts; composed only by an app of kind cli
src/modules/domain/<capability>/      index.ts, module, config, options, errors/, persistence/, policies, services, contracts
src/modules/platform/{config,logging,errors,primitives,database,...}/   config, logging, errors, primitives are required
src/modules/integrations/<provider>/  index.ts, <provider>.config.ts, errors/, client
src/tests/e2e/<area>/*.e2e-spec.ts    plus e2e/live/<area>/ and e2e/setup/
src/tests/fixtures/                   typed builders and mock<T>() doubles; never imports a feature
contracts/<app>/schema.graphql        opt-in committed contract
```

### 5.2 Tiers and direction (R26 to R28)

| From \ to | app | feature | domain | integrations | platform | package |
| --- | --- | --- | --- | --- | --- | --- |
| app | - | index only | yes | yes | yes | yes |
| feature | no | no, not even another feature | yes | yes | yes | yes |
| domain | no | no | yes, acyclic | yes | yes | yes |
| integrations | no | no | no | no | yes | yes |
| platform | no | no | no | no | yes, acyclic | yes |

Type-only imports count. Every import across owners goes through the owner's `index.ts`. Shared types that both platform
and domain need go down to platform or are passed as options. Only these three module tiers exist.

### 5.3 One schema authority (R34 to R36)

Schema changes only by migration. `synchronize` is the literal `false` everywhere, including e2e databases (e2e runs
the real migrations). There is no runtime DDL, no `dataSource.synchronize()`, no `migrationsRun` in an api or worker
app, no `CREATE|ALTER|DROP TABLE` outside `persistence/migrations/**`, no entity or migration glob. `apps/migrate` is
the only process that runs migrations, once per connection, before api and worker start. Entities and migrations live
in `persistence/` of the capability that owns the table (`domain/<cap>/persistence/` or `platform/<cap>/persistence/`
for technical tables such as outbox and lease). `persistence/connection.ts` names one connection from
`hfs.json.connections`; each capability exports explicit `entities` and `migrations` lists from its `index.ts` and the
app composes them into `PlatformDatabaseModule.register({ connection, entities, migrations })`. Raw SQL only in
`*.repository.ts`.

### 5.4 Errors, logging, filters (R37 to R40)

One error profile. `platform/errors` owns `DomainError` (stable UPPER_SNAKE `code`, `cause`), one HTTP
`ExceptionFilter`, one GraphQL `formatError`, the code to status table the transport owns, and masking of undeclared
errors (a 500 with a generic message, detail only in the log). Each capability declares its errors in `errors/`.
Expected outcomes (refused, pending) are typed unions, not exceptions. A domain never throws a platform error
(`EnvError`, `PersistenceError`); repositories translate driver errors into capability errors. `platform/logging`
(`Logger` port, enum identity, structured payload) is mandatory; `console.*` and the Nest logger are forbidden. Each
app registers exactly one filter through `APP_FILTER`. Every `catch` logs, rethrows or returns a typed outcome that
carries the cause; an empty `catch {}` is forbidden.

### 5.5 Default deny (R41, R42)

`domain/identity` exports `AuthGuard`, `@Public({ reason })` and `@Roles()`. Every api app registers `APP_GUARD`. A
public operation carries `@Public({ reason })` (auth, signed webhook, health). Webhooks use the shared signature
verifier and compare secrets with `timingSafeEqual`. No `@Body() x: unknown`, no `GraphQLJSON` parameter, no
`switch (input.operation)` in transport. Input strings are bounded, GraphQL has depth and complexity limits, and the
auth and webhook doors are rate limited.

### 5.6 Configuration and secrets (R43, R44)

Only `platform/config` (`EnvSource`, which also resolves `*_FILE`) touches `process.env`. Each capability and provider
has `<name>.config.ts` (`parse<Name>Config(env): <Name>Options`, zod) and `<name>.options.ts`. `main.ts` reads the
environment once and passes options to `AppModule.register(options)`; modules receive options through DI. Keys
matching `PASSWORD|SECRET|TOKEN|KEY|CREDENTIAL` and infrastructure URLs have no default; a missing value stops boot with
an error that names the key. There is one config path; dotfile env preloaders do not exist. No `process.cwd()` joined
with `src` or `.starcistacks`.

### 5.7 Background work (R46)

Background work is a transport. `transport/schedule/<job>.job.ts` (cron, sweep, outbox publisher) and
`transport/message/<event>.consumer.ts` (queue) call use cases exactly as a controller does. Mechanisms live in
`platform/scheduling` and `platform/messaging`. Only an app of kind `worker` composes them; an api app never runs
cron. A method named `sweep*`, `deliver*`, `reconcile*` or `retry*` that no job or consumer calls is a failure.

### 5.8 Modules and features (R29 to R33, R45)

A feature root holds `index.ts`, `<feature>.module.ts`, `application/` and `transport/<protocol>/` only. `application/`
has no protocol-named folder. Each transport has exactly one Nest module `<feature>-<protocol>.module.ts`, plus one
application module; never one module per operation. `@Global()` only on `platform/{config,logging,database}`;
`ConfigurableModuleBuilder<Options>` always carries a real options type; `register` is `static`; no module-level `let`;
no `new` of an `@Injectable`. Every feature and every transport module is composed by at least one app. Apps hold only
`main.ts`, `app.module.ts`, `<app>.options.ts` and the composition spec. Entrypoints (`main.ts`, `bootstrap()`,
top-level `void x()`) exist only in `apps/*/src`.

### 5.9 Query, transport and runtime safety (R68 to R77)

A statement is text plus numbered parameters; a runtime value never becomes part of the text (R68). A list read states its
bound, and a caller that needs every row pages by keyset instead of truncating (R69); a read never runs once per element of a
loop, the keys are read once (R77). Every outbound HTTP call carries a
timeout or an abort signal (R70). A logger call names no credential and no personal identifier (R71). `as never` and `x!`
are not used (R72). An `async` function awaits (R73). A migration's `down()` reverses its `up()` (R74). A handler and a
public method of an Injectable, Resolver or Controller declare their return type (R75). `JSON.parse` of outside text sits
inside a `try` (R76). Each has an `eslint-be` enforcer in `@starci/eslint-canon-be`; the input classes of R42 carry a
`class-validator` decorator on every property (`dto-needs-validator`).

### 5.10 Copy, time, delivery and transactions (R78 to R82)

Text a user reads - an exception's message, a notification's subject or body, a response's `message` or
`description` - comes from a per-capability `messages` catalog (Vietnamese and English) through the typed
`platform/i18n` `MessageCatalog` port, never a literal in source (R78). The catalog lookup takes an explicit
locale: `platform/i18n`'s `RequestLocale` provider resolves it inside a request (the authenticated user's stored
preference, else the first of `vi`/`en` named in `Accept-Language`, else `vi`) and a job resolves it from the
message's recipient (their stored preference, else `vi`) - never a call-site guess (knowledge/patterns/be/
messages.yaml). The ambient clock (`Date.now()`, a bare `new Date()`, `performance.now()`) is read only inside
`platform/clock`; business code asks the injected `Clock` port, so a spec can drive time with a `FakeClock` (R79).
Delivery that can repeat - a webhook a sender resends, an outbox or queue redelivering a message - is claimed
through a shared inbox (`inbox_claims`, unique on `(source, event id)`, owned by `platform/inbox`) keyed by
`(source, event id)` before it acts, so a repeat is a no-op; a consumer is recognized by a decorated handler
(`@EventPattern`, `@MessagePattern`, `@OnEvent`, `@Process`) or a `*Consumer`/`*OutboxConsumer` class name as well
as the `<event>.consumer.ts` filename, and an outbox producer that only publishes is not asked for a claim (R80).
A loop that catches an error and waits before trying again goes through the shared `platform/retry` helper
(bounded attempts, exponential backoff with jitter, an abort signal), never a loop written at the call site (R81).
No transaction spans an external call: commit first and call out after, or write an outbox message inside the
transaction (R82). Each has an `eslint-be` enforcer in `@starci/eslint-canon-be`.

The database is reached through the shared `EntityManager`, injected by a named injector (`InjectPrimaryEntityManager()`,
`InjectAgentOsEntityManager()`, `InjectExpertAcademyEntityManager()` or `@InjectEntityManager(<CONNECTION_TOKEN>)`) and
called directly. A bare `@InjectEntityManager()`, `.getRepository(...)`, `@InjectRepository(...)`, `Repository<T>` and an
injected `DataSource` are refused; only the platform database module and `apps/migrate` hold a `DataSource` (R83).

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
  commit. There is no baseline and no allowlist (R20). Duplicated blocks of 8 lines or more, and helpers defined twice
  under the same name, fail (R21).
- **Contracts.** The backend commits `contracts/<app>/schema.graphql` (CI re-emits and compares); a frontend keeps a
  hash-checked copy (R23).

## 10. Gates

| Gate | Runs | Target | Rules |
| --- | --- | --- | --- |
| PC pre-commit | lint-staged: Prettier, ESLint canon on staged files, stylelint, secrets guard | under 10 s | R06, R07, R18, R19, R34, R40, R41, R43 to R45, R49, R55, R58, R61, R62 |
| PP pre-push | `typecheck`, `lint:check`, `hfs check --fast`, affected unit specs | under 2 min | PC plus R01, R03 to R05, R12 to R15, R22, R26, R27, R30 |
| OS op settle | `hfs check --paths <owned paths>` and ESLint on the op's paths; a red result does not settle | per op | every file-level and owner-level rule in scope |
| LG land gate | full `hfs check` including reachability, composition, contract, size growth, duplicates; canon scan; unit; build | per repo | all 77 |
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
| R13 | `HFS_CI_MISSING_CANON` | CI runs the pinned `@starci/hfs check`; pre-push runs typecheck and lint. |
| R14 | `HFS_DEP_VERSION_SKEW` | One version per dependency in the workspace. |
| R15 | `HFS_CANON_PIN_DRIFT` | Canon packages and frameworks match `canon-pins.yaml`. |
| R16 | `HFS_TOOL_CONFIG_LOCAL` | Configs only call the factories; no local rules. |
| R17 | `HFS_RULE_OFF_WITHOUT_REPLACEMENT` | A rule is off only when its replacement check is in a repository gate. |
| R18 | `HFS_INLINE_SUPPRESSION` | No inline suppression of any kind. |
| R19 | `HFS_FORMAT` | Prettier is the only formatter. |
| R20 | `HFS_SIZE_GROWTH` | Over-budget files do not grow; new files are inside budget. |
| R21 | `HFS_DUPLICATE_CODE` | No duplicated blocks or twice-defined helpers. |
| R22 | `HFS_TS_STRICT` | tsconfig extends `@starci/tsconfig` and lowers no flag. |
| R23 | `HFS_CONTRACT_SNAPSHOT_DRIFT` | Contract snapshot equals the emit, the FE copy equals the BE. |
| R24 | `HFS_ARCH_CONFIG_UNREAD` | The machine reads `hfs.json`; zero files analysed is red. |
| R25 | `HFS_UNUSED_EXPORT` | No public export without a consumer. |

**Backend**

| Id | Code | Rule |
| --- | --- | --- |
| R26 | `BE_TIER_DIRECTION` | The tier direction matrix. |
| R27 | `ARCH_OWNER_CYCLE` | No owner cycles, type-only included. |
| R28 | `BE_FEATURE_IMPORTS_FEATURE` | A feature never imports a feature. |
| R29 | `BE_FEATURE_SHAPE` | Feature root is `index.ts`, module, `application/`, `transport/<protocol>/`. |
| R30 | `BE_PUBLIC_SURFACE` | Cross-owner imports use `index.ts`; no `export *`; at most 60 exports. |
| R31 | `BE_FEATURE_NOT_COMPOSED` | Every feature and transport module is composed by an app. |
| R32 | `BE_APP_COMPOSITION_ONLY` | Apps compose only; the composition spec boots the real module. |
| R33 | `BE_ENTRYPOINT_ONLY_IN_APPS` | Entrypoints only in `apps/*/src`. |
| R34 | `BE_SCHEMA_AUTHORITY` | Migrations are the only schema authority; `synchronize` is `false`. |
| R35 | `BE_SCHEMA_OWNER` | Entities and migrations live in the owning capability's `persistence/`. |
| R36 | `BE_SQL_OUTSIDE_REPOSITORY` | Raw SQL only in `*.repository.ts`. |
| R37 | `BE_ENTITY_IN_CONTRACT` | No ORM entity in a contract or transport type. |
| R38 | `BE_ERROR_HOME` | Errors live in the owning capability's `errors/` and extend `DomainError`. |
| R39 | `BE_ERROR_MASKED` | One filter per app; undeclared errors are masked. |
| R40 | `BE_LOGGER_REQUIRED` | `platform/logging` exists; every `catch` logs, rethrows or returns a reasoned outcome. |
| R41 | `BE_DEFAULT_DENY` | `APP_GUARD` plus `@Public({ reason })`; typed bodies; `timingSafeEqual`. |
| R42 | `BE_INPUT_BOUNDED` | Bounded input, depth limits, rate limits; every property of an input class carries a `class-validator` decorator. |
| R43 | `BE_CONFIG_OWNER` | Only `platform/config` reads `process.env`; config per capability. |
| R44 | `BE_SECRET_DEFAULT` | No default for a secret key or infrastructure URL. |
| R45 | `BE_MODULE_SHAPE` | `@Global` only on config, logging, database; typed options; one module per transport. |
| R46 | `BE_BACKGROUND_UNOWNED` | Every sweep, outbox or retry has a job or consumer run by a worker app. |
| R47 | `BE_TEST_TOPOLOGY` | One jest config, projects `unit` and `e2e`, live by folder, `diagnostics: false`. |
| R48 | `BE_SPEC_QUALITY` | No source-reading specs, no cast doubles; `lint:e2e` is green. |
| R68 | `BE_SQL_INTERPOLATED` | SQL text carries no runtime substitution; values are numbered parameters. |
| R69 | `BE_QUERY_UNBOUNDED` | A read that can return many rows states `take`, `limit` or `LIMIT`, or pages by cursor. |
| R70 | `BE_HTTP_TIMEOUT` | Every outbound `fetch`, axios or HttpService call states a timeout or an abort signal. |
| R71 | `BE_LOG_SECRET` | A logger call carries no credential and no personal identifier by name; log an id or a masked form. |
| R72 | `BE_TYPE_ESCAPE` | No `as never` and no `x!` outside the test lanes. |
| R73 | `BE_ASYNC_NO_AWAIT` | An `async` function contains an `await`; otherwise it is not `async`. |
| R74 | `BE_MIGRATION_REVERSIBLE` | Every migration declares a `down()` that reverses its `up()`; never empty, never a bare throw. |
| R75 | `BE_RETURN_TYPE` | Handlers and public methods of an Injectable, Resolver or Controller declare their return type. |
| R76 | `BE_JSON_PARSE_UNGUARDED` | `JSON.parse` sits inside a `try` in its own function and fails as a typed outcome. |
| R77 | `BE_QUERY_IN_LOOP` | A repository, entity-manager or query-builder read does not run once per element of a loop; read once before the loop by key list. |
| R78 | `BE_USER_COPY_LITERAL` | A literal exception message, notification text or response copy comes from the per-capability messages catalog through the typed `MessageCatalog` port, not from source. |
| R79 | `BE_AMBIENT_CLOCK` | `Date.now()`, a bare `new Date()` and `performance.now()` are read only inside `platform/clock`; business code asks the injected `Clock` port. |
| R80 | `BE_INBOX_DEDUPE_MISSING` | Every `@Public()` webhook handler and outbox/queue consumer claims the event through the shared inbox, keyed by `(source, event id)`, before it acts. |
| R81 | `BE_HAND_ROLLED_RETRY` | A loop that catches an error and waits before trying again goes through the shared `platform/retry` helper, never a hand-written loop. |
| R82 | `BE_TRANSACTION_EXTERNAL_CALL` | No transaction spans an external call; commit first and call out after, or write an outbox message inside the transaction. |
| R83 | `BE_UNNAMED_DATA_ACCESS` | The database is reached through the shared EntityManager injected by a named injector and called directly; no bare `@InjectEntityManager()`, `getRepository`, `@InjectRepository`, `Repository<T>` or injected `DataSource` (outside the platform database module). |

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
| R65 | `FE_SIZE_AND_STATE_BUDGET` | Hook and state budgets; no hand-written poll loop. |
| R66 | `FE_E2E_SHAPE` | Playwright shape, three viewports, no environment coupling. |
| R67 | `FE_SPEC_QUALITY` | No class pinning, no barrel specs, axe per connected screen. |
