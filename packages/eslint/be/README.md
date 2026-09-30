# @starci/eslint-canon-be

**ESLint rules, grouped by law (the count is `Object.keys(rules)`; knowledge/hfs/rules.yaml names the HFS rule each one enforces), that hold a NestJS-shaped back end to one way of being written.**

Not a style pack. These rules enforce *architecture*: which layer may import which, whether a
failure carries its own identity, where a query is allowed to be built, what an end-to-end test is
permitted to assume. Prettier decides how code looks; this decides what it is allowed to be.

```bash
npm i -D @starci/eslint-canon-be
```

## Use it

`eslint.config.mjs` of a back end is a managed file (`hfs sync` renders it; `hfs check` refuses any other content):

```js
import { loadHfs, starciBeConfig } from "@starci/eslint-canon-be"

export default starciBeConfig({ hfs: loadHfs(import.meta.url) })
```

That is the whole configuration. `loadHfs` reads the repository's `hfs.json` beside the config file and the slot
manifest this package ships in `runtime/` (a byte copy of `knowledge/hfs/slots.yaml`, refreshed by
`packages/hfs/scripts/sync-runtime.mjs`). `starciBeConfig` returns the flat config: typed linting
(`parserOptions.projectService`) over every `.ts/.mts/.cts/.js/.mjs/.cjs`, ignores `dist/`, `coverage/` and
`node_modules/` only, `noInlineConfig` with unused-disable reporting, the borrowed typescript-eslint rules, every canon
rule at `error`, and `settings.starci.hfs` - the slot view each path-scoped rule asks (`lib/hfs.mjs`). The factory takes
no globs, ignores or rule overrides, and refuses a recommendation with any rule not at `error`. A rule the standard no
longer holds is deleted from the plugin; every rule that ships is on.

Also exported: `rules`, `ruleOwners`, `lawOwners`, `ruleDeclarations`, `recommended`, `linterOptions`.

## What it actually catches

A sample, not the list:

| Area | What the rules hold |
|---|---|
| **Errors** | A `catch` rethrows, calls a method on a `Logger` receiver (typed, from `platform/logging`) or returns an outcome carrying its cause; a `DomainError` subclass lives only in `errors/<capability>.error.ts` of its owner, and that file is one code enum, one `Record<Code, ErrorKind>` table and one empty class; a `throw` throws a `DomainError`, never a bare `Error`, a framework exception or a platform error out of a domain (`catch-must-account`, `error-home`, `throw-domain-error`, `error-family-shape`) |
| **Schema authority** | Migrations only: every DataSource or TypeORM options object states the literal `synchronize: false` (found by the contextual type), no `migrationsRun`, no DDL string outside a migration, no entity glob; no `@Entity` type reachable from a transport signature, a handler `execute`, a contract or a message, and no GraphQL or validator import in an entity file (`no-runtime-schema`, `no-entity-in-contract`) |
| **Config and secrets** | `process.env` (any form), `@nestjs/config`, `dotenv` and `envConfig()` only in the file of `platform/config` that declares `EnvSource`; no default of any kind for a value typed `Secret` or `Url`; secrets compare with `timingSafeEqual` (`no-direct-env-read`, `no-secret-default`, `secret-compare-timing-safe`) |
| **Default deny** | Typed bodies and arguments, no `GraphQLJSON` tunnel, no `switch (operation)`, `@Public` carries a `PublicReason` member of `domain/identity`, and no `@UseGuards` (the global `APP_GUARD` chain decides) (`no-untyped-body`, `public-needs-reason`, `no-auth-use-guards`) |
| **Module shape** | No `@Global()`; `isGlobal: true` only in an app's `app.module.ts`; no import of another owner's module; typed `ConfigurableModuleBuilder`; `static register` is the only factory; a capability's representative module extends the `ConfigurableModuleClass` of its own module definition and every sub-module or feature module is plain (`capability-module-shape`); one module per file; no `new` of a provider; no module-level `let` (`no-global-decorator`, `is-global-only-in-app`, `no-cross-owner-module-import`, `static-module-register`) |
| **Suppression** | No `eslint-disable`, `eslint-env`, `/* global */`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `istanbul`, `c8` or `v8 ignore`, `NOSONAR`, `sonar-disable`, `prettier-ignore` or `vn-ok` comment, anywhere (`no-inline-suppression`) |
| **Size** | A source file, a spec included, over the manifest's line budget is not new and does not grow past its size at the parent commit; the rule takes no option (`file-size-growth`) |
| **Query safety** | `.query(...)` takes only a `SqlText` built with the `sql` tag in a persistence `<name>.sql.ts`, and no query builder exists (`sql-text-only`, `no-query-builder`); the tag's only substitution is a `SqlIdent` and a `.query` string is never built by template or `+` (`no-interpolated-sql`); `find`, `findBy` and `findAndCount` on an `EntityManager` state `take` and no `EntityManager` read runs per loop element (`query-needs-limit`, `no-query-in-loop`) |
| **Resilience** | An outbound HTTP call states a timeout or signal; `JSON.parse` of outside text sits in a `try`; a loop that catches and waits goes through `platform/retry` - the wait is `setTimeout`, `node:timers/promises` or a function outside `platform/retry` whose body waits, whatever it is called (`http-needs-timeout`, `json-parse-needs-guard`, `no-hand-rolled-retry`) |
| **Log safety** | A call on the `Logger` port (found by the receiver's type) passes no `Secret` or `Pii` value and no value named like a credential or a personal identifier (`no-secret-in-log`) |
| **Async and types** | An `async` function awaits; handlers and public methods declare a return type; no `Function` type, no `eval`; an inline object type takes a name; no `const enum`. Casts, `x!` and `any` are refused in every file, specs included, by the typescript-eslint rules the factory turns on (`async-needs-await`, `explicit-handler-return-type`, `no-function-or-eval`, `no-inline-param-type`, `no-inline-object-type`, `no-const-enum`) |
| **Migrations and input** | A migration's `down()` reverses its `up()`; every property of an input class has the `class-validator` decorators its type calls for (string `@MaxLength`, enum `@IsEnum`, array `@ArrayMaxSize`, nested `@ValidateNested()` and `@Type`); reads page by cursor, never by `skip`, `offset` or `OFFSET` (`migration-down-reversible`, `input-bounded`, `no-offset-pagination`) |
| **Spec quality** | A spec does not read repository source with `fs`; a double is `mock<T>()`, and the borrowed `consistent-type-assertions` (`never`) and `no-non-null-assertion` leave no `as` and no `x!` in a spec (`spec-no-source-read`) |
| **CQRS** | A message extends `Command<R>` / `Query<R>` from `@nestjs/cqrs`, carries one `readonly params: ExecuteParams<X>` (no entity reachable from `X`), a handler extends `ICQRSHandler` and overrides `process`; no `*.use-case.ts`, no forwarder service, no `EventBus` or `@nestjs/event-emitter` (`handler-overrides-process`, `message-carries-params-only`, `message-typed-result`, `execute-params-shape`, `no-use-case`, `no-event-bus`) |
| **Module layering** | Another owner is imported through its public `index.ts` (`@modules/domain/plan`, `@features/plan`), never through a path into it, and a same-owner import is relative and never through the own index (`import-owner-entry`); an owner has one `index.ts` (a nested one is refused) that holds only named `export { }` lines, with no `export *`, and a bounded number of names (`no-folder-reexport`); self-aliases and relative escapes are refused (`no-self-module-alias`, `no-relative-capability-escape`). Owners come from the HFS slots, aliases from the program's `compilerOptions.paths`. |
| **Data access** | The database is reached through the shared `EntityManager` only, received as a constructor parameter with the named injector of a declared connection - a lookalike name, property injection, an injected `DataSource` or `QueryRunner` outside `platform/database` and the migrate app, `getRepository` and repository types are refused, specs included (`must-inject-entity-manager`, `named-entity-manager-only`, `no-injected-repository`); inside a transaction callback only the manager it received is used (`no-outer-manager-in-transaction`); no call through an integration, `HttpClient` or `MessagePublisher` typed receiver spans a transaction (`no-external-call-in-transaction`); the manager is injected only in application handlers, domain services and the platform database, inbox, outbox and lease capabilities (`em-injection-slots`) |
| **Connections** | One database is one connection and one `Inject<Conn>EntityManager()` injector: `InjectEntityManager(`, `InjectDataSource(` and `getEntityManagerToken(` are called only in `platform/database/<conn>.decorators.ts`, the migrate app and the test database fixture; an exported EntityManager injector is exactly the declared connection's; `TypeOrmModule.forRoot*` and `new DataSource(` live in the platform database capability and the migrate app; the connection name is written once, in its `<conn>.connection.ts`; a `<conn>.config.ts` reads only keys of its `envPrefix` (`one-connection-per-database`) |
| **Operations** | A versioned operation is declared once in the app's typed operation table (`query<Input, Output, RefusalCode>()` / `mutation<...>()` registered by `defineOperations`, declared by the platform capability `operations`): its input and output are closed types (no `any`, `unknown`, `Record<string, unknown>`, unbound generic, function or `Date`) and its refusal codes a closed union of string literals; a route that takes or answers the table's types takes `OperationRequest<Table>` and answers `Promise<OperationReply<Table>>` of one table (`operation-contract-decidable`, `operation-route-driven-by-table`) |
| **Transport** | A door injects only `CommandBus` / `QueryBus` (and `RequestLocale` in REST) and dispatches exactly one message per handler; no response envelope, no `GraphQLJSON`, no `unknown` body, no `switch (input.operation)`; a REST door lives in `transport/http` and shows a public reason, a byte stream or a redirect; a capability never imports a feature (`transport-dispatch-only`, `no-response-envelope`, `no-graphql-json`, `door-lives-in-features`, `rest-door-needs-a-reason`, `no-capability-imports-features`) |
| **Infrastructure owners** | Each raw library (HTTP, cache, queue, scheduler, logger, date, config, events) is imported or reached as a global only inside the capability the manifest names for it (`ruleParams.be.infraOwners`); `@nestjs/config`, `dotenv` and `@nestjs/event-emitter` nowhere (`infra-import-owner`) |
| **Observability** | Logs leave through the `Logger` port of `platform/logging`, never the framework's `Logger`; a log call's first argument is a member of an owner's `<owner>.log-events.ts` enum; a failure log carries the exception's identity, not only its wording (`no-framework-logger`, `no-interpolated-log-message`, `no-error-wording-as-log-identity`) |
| **Testing** | A handler, domain service, consumer, job, guard, mapper, policy, client and row mapper has a twin `.spec.ts` beside it, and a spec has its subject beside it; there is no `.test.ts`, `int-spec` or `harness-spec`; a spec asserts a result or a state, not only a call; an e2e reads persisted state back through a typeorm `EntityManager` and reaches no model provider outside `src/tests/e2e/live/` (`unit-test-colocated`, `no-call-only-spec`, `e2e-asserts-persisted-state`, `no-model-call-in-e2e`, `no-api-shaped-e2e-filename`, `no-marker-model-stub`) |
| **End-to-end flows** | One file, one flow, named steps; the flow enters through transport (a `CommandBus`, `QueryBus` or a handler, consumer or job is never called), boots through `src/tests/e2e/setup` (no `Test.createTestingModule`), **never sleeps** — it polls with `waitFor` until the state settles, with a deadline — and takes no branch inside a step (`e2e-uses-production-transport`, `no-wiring-in-flow-spec`, `no-sleep-in-flow`, `no-branch-in-flow-step`) |
| **CDC · event delivery** | Projections and events follow the declared delivery contract |
| **Comments · naming · type safety** | Comments say why; no double cast through `unknown`; named exports only, the Jest `*.global-setup.ts` being the one default export; Vietnamese only in a message catalog, specs and fixtures included (`no-default-export`, `no-non-ascii-source`) |
| **User copy** | A literal message of an error class (judged by the constructed type extending `Error`), a text property handed to an outbound port (a receiver typed from `integrations` or `platform/messaging`) or a response copy in a transport slot comes from the messages catalog through the typed `MessageCatalog` port, specs included (`user-copy-through-catalog`) |
| **Temporal** | `Date.now`, a bare `new Date()`, `performance.now`, `process.hrtime` and `Temporal.Now` are referenced (not only called) only inside `platform/clock`, specs included (`no-ambient-clock`) |
| **Dependency injection** | Raw `Inject(`, `InjectEntityManager(`, `InjectDataSource(`, `InjectQueue(`, `InjectRepository(` and any third-party `Inject*` are called only in a `<owner>.decorators.ts` at an owner root, and injectors decorate constructor parameters only; an injector is zero-argument, typed `TypedParameterDecorator<T>`, built with `injector<T>(token)`, documented, over a `unique symbol` token; `T` equals the parameter type; a parameter typed by a platform, integrations or package declaration carries an injector (only domain services and the same owner are class-injected); no `ModuleRef`, no `forwardRef`, no string token (`injector-only`, `injector-shape`, `injector-type-match`, `infra-needs-injector`, `no-module-ref`, `no-forward-ref`, `no-string-token`) |
| **Idempotency** | The first awaited expression of a consumer method and of a `SignedWebhook` handler is `claim(source, eventId)` on a receiver typed as the `Inbox` port, followed by an early return on `false` (`inbox-dedupe-required`) |

Every rule names the law that declares it — `ruleOwners` maps rule name to law, so a failing build
line leads straight to the document that explains why.

## Companion

- **[@starci/eslint-canon-fe](https://www.npmjs.com/package/@starci/eslint-canon-fe)** — the
  front-end half: 58 rules from 16 laws covering component tiers, structure contracts, the
  fetch/draw split, vendor boundaries and the design-token scale.

## Where the laws live

Each rule is the enforceable half of a written law. The prose — why the rule exists, what it
refuses, which cases sit just outside it — is published openly at
[starci183/starci-claude-skills](https://github.com/starci183/starci-claude-skills).

A rule that cannot be pointed at in real code is a proposal, not a law. Everything here is
pointed at.

## Requirements

ESLint 9+ (flat config), Node 20.9+.

## HFS rules and their why codes

Every rule of this plugin is an enforcer of one HFS rule. The relation (rule id -> HFS rule -> catalogued Vietnamese why code)
lives in exactly one place, `knowledge/hfs/rules.yaml` (`enforcers`), and `scripts/checks/check-hfs-rules.mjs` refuses a
rule of this plugin that no catalog entry names. There is no second table here.

