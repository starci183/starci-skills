# Changelog

## 2.0.0 - unreleased (lane C0, BE-CONVENTION)

- Breaking: one configuration, `export default starciBeConfig({ hfs: loadHfs(import.meta.url) })`. The factory is async
  (ESLint awaits it), turns typed linting on for every `.ts/.mts/.cts/.js/.mjs/.cjs` (`parserOptions.projectService`),
  ignores only `dist/`, `coverage/`, `node_modules/`, borrows `@typescript-eslint/{consistent-type-assertions (never),
  no-explicit-any, no-non-null-assertion, no-floating-promises, no-misused-promises, switch-exhaustiveness-check}` and
  puts the repository's slot view in `settings.starci.hfs` (`lib/hfs.mjs`: `slotOf`, `tierOf`, `ownerOf`, `ruleParams`,
  `connections`). It takes no globs, ignores or overrides. `sources`/`plugin`/`recommended` parameters are gone.
- Breaking: every rule ships at `error` in `recommended` (the six `warn` levels are gone); the factory refuses any other level.
- Breaking: `lib/slots.mjs` (which reached into the runtime checkout) is deleted; the manifest ships in `runtime/`
  (byte copy kept by `packages/hfs/scripts/sync-runtime.mjs`). New `lib/types.mjs` answers what a node's TYPE is
  (`typeOrigins`, `isPackageType`) for the type-aware rules.
- Removed: the SAB-only `cdc` and `event-delivery` laws (`projection-listener-contract`, `no-dynamic-projection-group-id`,
  `projection-recompute-must-upsert`, `nats-bridge-delivery-contract`, `no-call-site-transport-override`).
- Breaking (slot sweep, RE1): `type-safety`, `spec-quality`, `testing`, `e2e-flow`, `suppression` and `size-budget` ask the slot view (`hfsOf(context)`) and the file's basename role instead of a path pattern. No rule of these laws exempts a spec or a test lane.
- Removed: `no-never-cast`, `no-non-null-assertion`, `no-double-cast`, `no-unguarded-unknown-cast` (R72) and `spec-typed-doubles` (R48): the borrowed `consistent-type-assertions` (`never`) and `no-non-null-assertion` the factory turns on state exactly the same obligation for every file, specs included. One obligation, one rule.
- New: `no-function-or-eval` (R72: the `Function` type, `eval` and `new Function`, the type escapes the borrowed rules do not cover).
- Removed: `harness-calls-provider-directly` (R48; a `harness` spec kind no longer exists, BE-CONVENTION 1.16).
- Changed: `unit-test-colocated` (R47) requires a twin `.spec.ts` beside a handler, domain service, consumer, job, guard, mapper, policy, client and `*.rows.ts` (by slot and basename role), a subject beside every spec, and refuses `.test.ts`, `.int-spec.ts` and `.harness-spec.ts`.
- Changed: `e2e-asserts-persisted-state` recognises a state read by the TYPE of the receiver (a typeorm `EntityManager`, `DataSource` or `QueryRunner`), not by a variable name; `e2e-uses-production-transport` recognises a bus by its `@nestjs/cqrs` type and an actor by the file (`*.handler.ts`, `*.consumer.ts`, `*.job.ts`) that declares its type; `no-sleep-in-flow` recognises a wait by its shape (a timer, or a `Promise<void>` call given one number); `no-wiring-in-flow-spec` recognises `Test` by its `@nestjs/testing` import; `no-model-call-in-e2e` and `no-marker-model-stub` ask the slot (`be.tests.e2e-live`, `be.tests.fixtures`, `be.tests.e2e-setup`).
- Changed: `no-inline-suppression` (R18) also refuses `eslint-env`, `/* global */`, `istanbul`/`c8`/`v8 ignore`, `NOSONAR`, `sonar-disable` and `prettier-ignore`, and finds a `@ts-` directive anywhere in a comment.
- Changed: `file-size-growth` (R20) takes no option: the `max` and `recorded` options are gone, the budget is `ruleParams.be.fileLines`, the baseline is git. A spec, a fixture and an e2e file are governed like any source file; a migration and a declaration file are not.
- Dependencies: `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` ^8.70; peer `typescript` >=5.9; node >=22.13.
  The 1.7.1 dependency on `@starci/hfs` (and its sibling-workspace fallback) is gone: the package carries its own
  manifest copy in `runtime/`, one resolution path, no fallback.
- New law `injection` (R85 `BE_RAW_INJECT`, type-aware: a callee is identified by where its function is declared, never by a variable name; specs are not exempt):
  `injector-only` (`Inject(`, `InjectEntityManager(`, `InjectDataSource(`, `InjectQueue(`, `InjectRepository(` and any package function named `Inject*` are called only in a `*.decorators.ts` at an owner root; a raw `@Inject(...)` decorator, property injection and an injector on a non-constructor parameter are findings),
  `injector-shape` (zero-parameter, `TypedParameterDecorator<T>` from `platform/composition`, body `injector<T>(token)`, PascalCase name, JSDoc naming `T`; exported tokens are `unique symbol = Symbol("<owner>.<thing>")`; `provide:` is a class or a `unique symbol`),
  `injector-type-match` (the `T` of the injector equals the parameter annotation), `infra-needs-injector` (a constructor parameter typed by a platform/integrations declaration or a package carries an injector; only domain services and same-owner types are class-injected),
  `no-module-ref`, `no-forward-ref`, `no-string-token` (a string or template literal, or a string-typed value, as `Inject(...)`/`injector(...)`/`provide:` token; a string literal argument of `getEntityManagerToken`/`getDataSourceToken` outside `<conn>.connection.ts`).

## 2.0.0 additions - persistence rules (lane C0 RA)

- New law `connections`: `one-connection-per-database` (R84 `BE_CONNECTION_DUPLICATE`) and `em-injection-slots` (R88 `BE_TRANSPORT_SHAPE`).
- New: `sql-text-only` and `no-query-builder` (R36 `BE_SQL_OUTSIDE_PERSISTENCE`). Removed: `sql-only-in-repository` (a `*.repository.ts` no longer exists; slot `be.persistence` allows `<name>.sql.ts` and `<name>.rows.ts` instead).
- Changed: `no-interpolated-sql` (R68) judges the `sql` tag's substitutions by type (`SqlIdent`), drops the UPPER_SNAKE, `quoteIdent` and `sqlSetClause` allowlists, and refuses a `.query()` string built by template or `+`.
- Changed: `query-needs-limit` (R69) and `no-query-in-loop` (R77) identify the receiver by its `EntityManager` type, not its name; query-builder and raw-SQL reads are gone from both, spec files are no longer exempt, and `.query` text is judged by the machine (R86).
- Changed: `must-inject-entity-manager`, `named-entity-manager-only`, `no-injected-repository`, `no-outer-manager-in-transaction` and `no-external-call-in-transaction` (R82, R83) read types (`typeorm`, integrations, `HttpClient`, `MessagePublisher`) and slots instead of names and path patterns: the injector must be `Inject<Pascal(connection)>EntityManager` of a declared connection, property injection and a `DataSource`/`QueryRunner` outside `platform/database` and the migrate app are refused, `TypeOrmModule.forFeature` is refused, and specs get the same law.
- Changed: `lib/types.mjs` origins include a type's alias declaration and its own symbol (new `originsOfType`), so an alias over a generic type hides nothing; new `lib/persistence.mjs` holds the connection and injection-site helpers.

## 1.7.1 - 2026-09-30

- Fixed: eslint no longer fails to start in a product repository with `HFS slot manifest not found at <repo>/knowledge/hfs/slots.yaml`. `lib/slots.mjs` used to look for the manifest at a path above the package (the product repository, or a linked runtime copy that no longer exists). The package now depends on `@starci/hfs` and resolves the manifest and the YAML reader as `@starci/hfs/runtime/knowledge/hfs/slots.yaml` and `@starci/hfs/runtime/engine/yaml.mjs`, so what the canon reads travels with the installed packages. `STARCI_HFS_SLOTS` still overrides the manifest file.

## 1.7.0 - 2026-09-30

- New: `named-entity-manager-only` (R83 `BE_UNNAMED_DATA_ACCESS`, in `data-access`): a bare `@InjectEntityManager()` with no connection argument, any `.getRepository(...)` call (on a DataSource, an EntityManager or a transaction manager) and an injected `DataSource` (a constructor parameter typed `DataSource`, `@InjectDataSource()`, `@InjectConnection()`) are refused. A `DataSource` is allowed only under `platform/database/` or `platform/databases/` (also `platform/db`, `platform/datasource`, `platform/typeorm`) and `apps/migrate/`; spec files are skipped. The message says to inject the shared EntityManager with the named injector and call it directly.
- Changed: `no-injected-repository` now refuses `@InjectRepository(...)` wherever it is written (a property or a method parameter, not only a constructor parameter), and its message states the same one pattern.

## 1.6.1 - 2026-09-30

- Fixed: `inbox-dedupe-required` (R80 `BE_INBOX_DEDUPE_MISSING`) no longer relies only on `<event>.consumer.ts` under `transport/message/` to recognize a consumer. A method decorated `@EventPattern`, `@MessagePattern`, `@OnEvent` or `@Process`, or a class whose name ends `Consumer` or `OutboxConsumer`, is now a consumer wherever the file sits. The producer half of an outbox (typically `*-outbox.service.ts` / `*OutboxService`, which reads pending rows and publishes) carries none of those shapes and stays unflagged unless it also consumes.

## 1.6.0 - 2026-09-30

Round 3 back-end rules (catalog R78 to R82), each with RuleTester specs and a why code in `modules/kernel/failure-codes.yaml`.

- New: `user-copy-through-catalog` (R78 `BE_USER_COPY_LITERAL`, new law `user-copy`): a literal exception message, a `subject`/`title`/`body`/`text`/`message` property of a `notify`/`send`/`publish` call, or a `message`/`description`/`title` property of a `transport/` response comes from the per-capability messages catalog through the typed `MessageCatalog` port; a short code-shaped literal (`UPPER_SNAKE`, a bare word) and a template literal are left alone. `no-ambient-clock` (R79 `BE_AMBIENT_CLOCK`, new law `temporal`): `Date.now()`, a bare `new Date()` and `performance.now()` are read only inside `platform/clock`; `new Date(value)` built from a value the caller already holds is exempt. `inbox-dedupe-required` (R80 `BE_INBOX_DEDUPE_MISSING`, new law `idempotency`): a `@Public()` webhook controller and an outbox/queue consumer (`<event>.consumer.ts`) show a reference to an inbox or dedupe port before they act. `no-hand-rolled-retry` (R81 `BE_HAND_ROLLED_RETRY`, in `resilience`): a `for`, `while` or `do...while` loop that both catches an error and calls something shaped like a delay (`sleep`, `delay`, `wait`, `backoff`, `setTimeout`) goes through `platform/retry`; a polling loop with no `catch` is exempt, same as `no-query-in-loop` exempts a polling `while`. `no-external-call-in-transaction` (R82 `BE_TRANSACTION_EXTERNAL_CALL`, in `data-access`): `fetch`, an HTTP client call or any method of a `*Client`/`*Sdk` receiver does not run inside `.transaction(async (tx) => ...)`.
- Slot manifest (`knowledge/hfs/slots.yaml`, no version bump, additions stamped `since: 1.0.0`): `be.domain.messages` (`src/modules/{domain,integrations}/<capability>/messages/`) and `be.feature.messages` (`src/features/<feature>/messages/`), each an optional per-capability or per-feature vi/en catalog; `be.platform`'s required instances gain `clock` (the injected `Clock` port) and `i18n` (the `MessageCatalog` port); `be.domain` and `be.feature` allow a `messages/` folder.
- Deferred (owner ruling, no rule): floating promises; core `no-await-in-loop` is not adopted.

## 1.5.0 - 2026-09-30

- New: `no-query-in-loop` (R77 `BE_QUERY_IN_LOOP`): a repository, entity-manager or query-builder read (`find`, `findOne`, `count`, `getOne`, a raw `SELECT`) inside a `for`, `for...of`, `for...in` or an array `map`, `forEach`, `flatMap`, `filter`, `reduce`, `some` or `every` callback is one round trip per element (N+1). A polling `while` loop and a write per element are not reported.

## 1.4.0 - 2026-09-30

Round 2 back-end rules (catalog R42, R68 to R76). Every rule below has RuleTester specs and a why code in `modules/kernel/failure-codes.yaml`; each was measured against nivo-backend, starci-next and mia-mia-backend before it shipped and is on at `error`.

- New: `no-interpolated-sql` (R68: SQL text carries no runtime substitution; a constant column list, a `${n}` placeholder, `quoteIdent(...)`, `sqlSetClause(...)` and a ternary of fixed strings are the only substitutions), `query-needs-limit` (R69: `getMany`, `getRawMany`, `find`, `findBy` and a raw `SELECT` state a bound; a lookup by `id` and an aggregate are exempt), `http-needs-timeout` (R70: `fetch` carries a `signal`, axios and HttpService calls carry `timeout` or `signal`, `axios.create` a `timeout`), `no-secret-in-log` (R71: a logger call names no credential and no personal identifier), `no-never-cast` and `no-non-null-assertion` (R72), `async-needs-await` (R73: an `async` function that never awaits; a class that extends or implements, a decorated method and a generator are exempt), `migration-down-reversible` (R74: `down()` exists, is not empty and is not a bare throw), `explicit-handler-return-type` (R75), `json-parse-needs-guard` (R76), and `dto-needs-validator` (R42: every property of an input class carries a `class-validator` decorator).
- New laws: `query-safety`, `resilience`, `log-safety`, `async-discipline`, `input-bounds`; `type-safety` and `schema-authority` gain rules.

## 1.3.0 - 2026-09-29

HFS back-end rules (catalog R18, R20, R34, R36-R38, R40-R45, R48). Every rule below has RuleTester specs and a why code in `modules/kernel/failure-codes.yaml`.

- New: `catch-must-account` (R40), `error-home` (R38), `no-runtime-schema` (R34), `sql-only-in-repository` (R36), `no-entity-in-contract` (R37), `no-untyped-body` and `public-needs-reason` (R41), `no-direct-env-read` (R43), `no-secret-default` (R44), `secret-compare-timing-safe` (R41), `global-module-allowlist`, `typed-module-definition`, `static-module-register`, `no-new-injectable`, `no-module-let`, `one-module-per-file` (R45), `no-inline-suppression` (R18), `file-size-growth` (R20 ratchet; the soft budget is a hfs check report item, not a lint warning), `spec-no-source-read` and `spec-typed-doubles` (R48).
- Fixed: `must-deep-module-import` now holds the HFS owner surface. An aliased import names the owner and stops (`@modules/domain/plan`, `@features/plan`, or the explicit `/index`); a path into a file of another owner is refused, and a tier-only or root alias still is. The retired `lib` tier no longer counts as a tier. `no-folder-reexport` accepts a named `index.ts` surface (`export { X } from "./x"`, `export type { T } from "./contracts"`), and refuses `export *`, a `*_STORE` token, a whole `types` folder and an entry wider than the manifest's `indexExports` (60). Both are on again in `starciBeConfig`.
- Removed: no rule is off. The retired-rule list (`RETIRED`) and its export are gone, and so are the rules it switched off: `exception-name-ends-in-exception`, `exception-code-matches-class-name`, `exception-metadata-type-named-for-class`, `exception-extends-abstract`, `exception-in-errors-folder`, `require-exception-object-arg`, `throw-abstract-exception` (the Academy `AbstractException` family, replaced by `error-home`), `no-handler-encoded-failure` (expected refusals are typed unions), `handler-has-twin-spec`, `no-self-global-module` (replaced by `global-module-allowlist`), `no-line-suppression` and `require-vn-ok-reason` (replaced by `no-inline-suppression`), and the `vn-ok` exemption of `no-non-ascii-source`.
- `starciBeConfig` refuses a recommendation that carries an `off`.
- Slot parameters (the `@Global()` allowlist, the file line budget, the `index.ts` width) are read through `lib/slots.mjs` from `knowledge/hfs/slots.yaml` (`ruleParams.be.globalModules`, `ruleParams.be.fileLines.{soft,hardGrowth}`, and the `indexExports` budget of a `be.*` slot), with the rule catalog's values as the fallback.

## 1.2.3 — 2026-09-29

- `starciBeConfig({ sources, plugin, recommended })`, `linterOptions` and `RETIRED` are exported. The factory returns the one flat-config block a repository needs: the canon owns the retired-rule list (checked against the code-pattern manifest) and the warn-to-error lift, so a repository no longer hand-copies `replacedByChecks`.
- `harness-calls-provider-directly` applies only to model harnesses, identified by an LLM provider SDK import, a house model helper or gateway symbol, or a `@harness-kind model` comment - never by the `src/tests/e2e/live/` folder. A live e2e for an identity provider (Keycloak) or any other third party is no longer reported as a model harness with no LLM SDK.

## 1.2.2 — 2026-09-29

- Align module aliases and explicit public `index.ts` exports with HFS capability boundaries. Keep self-aliases, tier-only aliases, folder re-exports, and export-star public entries invalid.
- Accept concrete exceptions in their owning module or feature `errors/` directory, and accept the shared `AbstractException` declaration at its capability root.
- Classify a `.spec.ts` beside its subject in an HFS `src/tests` category as a colocated structural spec. Ordinary unit specs without an adjacent subject remain invalid in test buckets; model-quality harness checks remain in force.
