# Architecture check

`scripts/checks/architecture.mjs` (`checkArchitecture`) is a read-only
HFS tree, TypeScript dependency, and source-shape check. It resolves the checked
repository's manifests, `tsconfig` aliases, relative paths, workspace/file
packages, declared exports, re-export barrels, static `import()` calls, and
string-literal `require()` calls. It reports architectural evidence; it does
not promote current code into the standard.

It runs inside the aggregate scoped-lint gate as the `architecture` machine
kind:

```sh
node scripts/checks/check-scoped-lint.mjs --profile <nest|next> --root <repo-root> \
  (--all | -- <files...>)
```

on its own:

```sh
node scripts/checks/architecture.mjs <repo-root> [--base <commit>]
```

and programmatically via `checkArchitecture({ repositoryRoot, base })`
from `scripts/checks/architecture.mjs`.

The checker is the HFS architecture machine: it is driven by `hfs.json` in the checked repository and the slot manifest `knowledge/hfs/slots.yaml` (through `scripts/lib/hfs-slots.mjs`). `architecture.json` is retired; a repository carries only `hfs.json`, and owners, roots and tiers are derived from slots. See the HFS machine section below.

The check produces one `starci/architecture-check@1` JSON object. Exit code
`0` means `ok: true`; exit code `1` means the record contains violations or
errors; exit code `2` means bad arguments. Each finding identifies a repository-relative path, one-based
location, stable rule id, message, and, for resolved dependency failures, the
target and dependency chain.

HFS tree violations use `HFS_ROOT_ENTRY_FORBIDDEN`, `HFS_ROOT_ENTRY_MISSING`,
`HFS_APPS_REQUIRED`, `HFS_APP_LAYOUT_INVALID`, `HFS_ROOT_SRC_FORBIDDEN_FE`,
`HFS_SRC_LAYOUT_INVALID`, `HFS_MODULE_TIER_INVALID`, `HFS_WORK_IN_FE`,
`HFS_STACKS_IN_FE`, and `HFS_PACKAGE_MANAGER_MIXED`. The `coverage.hfs` object
records whether the tree came from the Git index or a filesystem fallback.

## Responsibility model

Every backend and frontend repository uses the HFS tree: `apps/<app>/` holds each application, npm owns the package lock, and tracked root entries follow the backend or frontend allowlist. The checker reads tracked entries with `git ls-files` and uses the filesystem only outside a Git worktree. Backend shared source lives under `src/{features,modules,tests}`, with module tiers `domain`, `platform`, and `integrations`. Frontend source lives under `apps/<app>/src`; root `src/` is forbidden.

Backend dependencies point from executable application composition to use-case features to cohesive capabilities/modules. Features orchestrate entry scenarios. Modules own cohesive domain or infrastructure capabilities and expose narrow APIs even when only one feature consumes them. Apps may bootstrap the framework, select modules/providers, install process middleware and app-wide adapters, and start the process; they do not own business handlers, services, controllers, resolvers, repositories, or entities.

Frontend roots are explicit: `app`, `features/{pages,layouts,overlays}`, `components/{blocks,composites,branches,leaves}`, `hooks/<domain>`, and `modules/<capability>`. App adapters may use React, Next and external framework packages, while every resolved internal import or re-export, including type-only edges, enters a feature public entry. Features compose components, hooks and modules. Components cannot point to features/app; hooks cannot point to components/features/app; modules cannot point to hooks/components/features/app. The visual tiers form a bounded dependency graph, not a requirement to pass through every tier.

The app, feature, component, hook and module roots are derived from the app list of `hfs.json` and are disjoint; transport may remain nested under modules. Owners are every directory an `owner: true` slot matches that has its entry file (`index.ts`/`index.tsx`, a package `src/index.ts`, an app `app.module.ts`), so the public-entry list is closed by the manifest, not by a hand-written declaration.

All authored custom `useX` declarations live under `hooks/<domain>`; built-in React hook calls may remain in visuals. Leaves, branches and composites own intrinsic client interaction such as refs, focus, disclosure, measurement, drag and reduced motion, but no product-world lifecycle. A block that reads product data, session, routing/locale or transport lifecycle is connected: `index.tsx` owns that world and every nonempty render path reaches a resolved pure export from sibling `component.tsx`. Pure blocks and lower tiers need no twin, `Base` suffix or paired-test census.

Applications may consume package public exports. Packages must not import application internals, and cross-package consumers use declared exports. Discover package roots from root and nested manifests, workspace globs, file dependencies, and tsconfig. A `packages/` directory or two consumers does not confer shared ownership.

## Automated boundaries and review obligations

Static checking can enforce resolved dependency direction, app business-role filenames/AST shapes, route visual-owner counts, package-to-app and private-export edges, component-to-transport/world dependencies, raw fetch placement, and unresolved internal imports. It must fail closed when the target TypeScript parser/configuration or an internal target cannot be resolved.

For a frontend visual function that actually calls a resolved configured hook/transport or selected Next routing/locale lifecycle, `FE_WORLD_OWNER_RENDER_BOUNDARY` still proves a useful resolved render boundary in general. `FE_CONNECTED_BLOCK_RENDER_PAIR` specializes the accepted block contract: the connected blocks owner is `index.tsx`, and every nonempty return path reaches the sibling `component.tsx` through resolved aliases/re-exports and supported provider/Suspense/error wrappers. `FE_CUSTOM_HOOK_LOCATION` resolves declaration and export aliases instead of judging calls by spelling. `FE_COMPONENT_WORLD_OWNERSHIP` rejects product-world ownership in leaves, branches and composites while preserving intrinsic built-in React state. Static checking does not decide whether an undeclared custom context is product state.

Review and meaningful boot/render tests still decide:

- whether a backend module is a cohesive capability or concealed feature orchestration;
- provider token, lifetime, transaction, connection, tenant/workspace, and request scope;
- whether app bootstrap callbacks contain product behavior;
- whether a frontend split creates an independently useful render contract;
- whether local client state is intrinsic interaction or hidden product state;
- whether a public package export is a stable owned API;
- rendered behavior, accessibility, data correctness, and constructed dynamic module names.

Nest modules export their public provider API. A consumer should import the owning module rather than directly re-registering its providers. Truly app-wide stateless/shared infrastructure can be registered once at the composition root. Named database clients, differently configured providers, tenant/workspace instances, and request-scoped providers are not blanket global candidates.

For a backend repository the checker always runs `exported-class-token` registration checking: the checker discovers every resolved Nest `@Module`, `@CommandHandler`, and `@QueryHandler` in the checked production TypeScript program. A class-token provider that a module both provides and exports has one static owner within each application graph. The checker traces resolved runtime source imports from each `apps/<app>/src/app.module.ts` composition root; separate app graphs may register the same class token, while another module in the same graph must import its owner. A provider object with a different named token remains a distinct registration. Selected CQRS decorators must have exactly one direct module registration. Dynamic/spread provider metadata, an unresolved framework binding, or a discovered handler decorator omitted from the selected set makes registration coverage unavailable rather than passing an incomplete inventory. This static source closure can include imports that Nest does not mount; it does not prove runtime scope, dynamic-module options, or a bootable DI container.

Resolved backend feature/module roots use the adopted domain-first source shape without an enablement flag. Recognized application roles live under `application/`; recognized protocol roles live under `transport/<protocol>/`. Resolved GraphQL DTO decorators bind DTOs to `transport/graphql`, while resolved TypeORM entity/migration identities cannot make a feature the schema owner. The naming check covers kebab-case role files, exported class role suffixes, application object contracts whose roles are known, enum declarations, and static GraphQL field/argument names. It does not invent a role for an arbitrary helper or infer persistence/error ownership from a folder string. An unclassified role, constructed decorator binding, or dynamic GraphQL name makes the applicable layout or naming coverage unavailable and omits that rule ID from `coverage.checkedRuleIds`.

The [Nest contract check](nest-contract-check.md) separately resolves callable owner/use-case signatures and readonly injected dependency or CQRS message fields. It follows inherited generic `execute` contracts and constructor assignments to declared fields without treating transport DTOs as immutable messages. Owner gaps, dynamic framework identity, unsupported field storage or unresolved signatures make only the affected contract coverage unavailable; declaration shape never claims runtime validation, DI lifetime or serialized compatibility.

The [Next data lifecycle check](next-data-lifecycle-check.md) binds declared SWR query and mutation calls to the canonical TypeScript program and installed SWR major version. It checks explicit null gates, result identities and mutation resource identities for static keys while leaving domain identity completeness and cache behavior to target tests and review.

## Research basis and counterexamples

Reviewed 2026-09-16:

- [Nest modules](https://docs.nestjs.com/modules) describes exported providers as the module API and warns that direct registration in multiple modules creates separate instances; global modules should be registered once and used deliberately.
- [Nest monorepo mode](https://docs.nestjs.com/cli/monorepo) changes project/build composition, not Nest module ownership or dependency behavior.
- [Next server and client components](https://nextjs.org/docs/app/getting-started/server-and-client-components) supports server route/layout adapters and explicit client boundaries.
- [TypeScript module resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html) is why aliases, package exports, relative paths, and resolution mode must come from the checked project.

Local reference evidence is pinned, and includes debt rather than being copied as law:

- `starci-academy-backend@1731b15ba4ed526477e3c572b9d82c31ab64f1d5`: `apps/core/src/main.ts` and `app.module.ts` show the valid bootstrap/composition exception. Playground apps with `*.service.ts` under `apps/*/src` are debt under the portable rule. `src/modules/bussiness/{weekly-challenge,daily-quest,streak,kpi-reward,flashcard}` import `@features/api/**`, concrete upward dependencies that the reference does not legitimize.
- The same backend root module performs broad registration. It is evidence for app composition, not evidence that named database/provider/tenant instances may be collapsed into one global singleton. Provider identity remains a DI/boot-test obligation.
- `starci-academy-fe@44bba218685b7eed2a5d9e479689707ab6381bc8`: redirect-only routes under `[lang]/page.tsx` and `courses/[displayId]/learn/flashcards/page.tsx` are valid zero-visual-owner adapters. `subscriptions/page.tsx` rendering `ShellNav` beside `ProSubscriptionPage` is reference debt. `StarCiAiFab/component.tsx` owns DOM refs, resize handling, drag, and reduced-motion behavior without transport/product-world ownership; forcing a forwarding Base twin would add ceremony without a responsibility boundary.
- That frontend is one app with `file:packages/grammar` and `file:packages/heroicons`; `nivo-fe@a01a7bd7474fc6b43b831853d9ef870c202f3844` is npm workspaces with `apps/{app,expert,landing}` and `packages/ui`. Both topologies must obey the same ownership and public-export rules.

## HFS machine

Slots, tiers and required files come from `knowledge/hfs/slots.yaml`; the repository only names its profile and apps in `hfs.json` (`modules/schemas/hfs-repo.schema.yaml`). A missing or invalid `hfs.json` is the error `HFS_DECLARATION_INVALID`, a pinned major other than the manifest's is `HFS_MANIFEST_MAJOR_MISMATCH`. The result carries `coverage.hfsMachine` with the counts of each check below. Every finding has a catalogued why code with Vietnamese text in `modules/kernel/failure-codes.yaml`.

1. **Tier direction matrix** (`BE_TIER_DIRECTION`, `BE_FEATURE_IMPORTS_FEATURE`, `FE_TIER_DIRECTION`, `FE_APP_ISOLATION`): every import, re-export and type-only import between two owners follows the `tiers` matrix of the manifest; a backend feature importing another feature is `BE_FEATURE_IMPORTS_FEATURE` (R28) and never `BE_TIER_DIRECTION` (R26), a frontend feature importing a feature is `FE_TIER_DIRECTION`, apps never import each other, a component layer imports only the layers after it.
2. **Owner cycles** (`ARCH_OWNER_CYCLE`): a strongly connected component of the owner graph, type-only imports included, reported with the cycle path.
3. **Reachability** (`BE_FEATURE_NOT_COMPOSED`, `BE_MODULE_NOT_COMPOSED`, `FE_OWNER_REACHABLE`, `FE_HREF_RESOLVES`): every backend feature and capability module is composed into an app root by runtime imports; every frontend page, layout and overlay feature is mounted by an `app/` route and every literal href targets an existing route.
4. **Dead code** (`HFS_UNUSED_EXPORT`, `HFS_UNUSED_FILE`, R25; an error in every gate, both profiles): the `index` of every non-app owner (backend features and modules included) exports a name no file outside the owner imports (`HFS_UNUSED_EXPORT`); a production source file that no root reaches through imports, re-exports and type-only imports is `HFS_UNUSED_FILE`. Roots are the files an app slot requires (`main.ts`, `app.module.ts`), every route file (slot tier `route`), the public entry of every package, and a source file that a framework config of the app (slot `fe.app.next`, e.g. `next.config.ts` pointing next-intl at its request config) names by a relative string literal. Specs and tests are not in the graph and never count as a use, so an export or a file that only a spec uses is dead.
5. **Required files** (`FE_ERROR_BOUNDARY_MISSING`, `BE_REQUIRED_MODULE_MISSING`, `HFS_REQUIRED_FILE_MISSING`): the files each slot and app requires, such as `global-error.tsx`, `error.tsx`, `not-found.tsx`, `loading.tsx` and the required platform modules.
6. **File size growth** (`HFS_SIZE_GROWTH`): a file above the soft line budget (`ruleParams.<profile>.fileLines.soft`) may not grow against the merge-base, and a new file stays within the budget. Without a resolvable base the coverage is `unavailable`, never a pass.
7. **Duplicate code** (`HFS_DUPLICATE_CODE`, R21): a token-normalised block that appears twice anywhere in the production program (two owners, two files of one owner, or one file), at or above the one threshold `ruleParams.<profile>.duplicateBlock` (`lines` and `tokens`); the finding names both locations, the threshold, and where the shared code belongs.
8. **One name, one declaration** (`HFS_DUPLICATE_SYMBOL`, R21): a name exported through an owner's public `index` (resolved to the file that declares it) that another production file of the repository also declares and exports, whatever its kind (function, class, const, enum, type, interface), is a duplicate; the finding lists the other declarations. A re-export of one declaration is not a second declaration. There is no allowlist of names.
9. **Alias re-export** (`HFS_ALIAS_REEXPORT`, catalogued under R30, judged on both profiles): `export { X as Y }`, `export { default as Y }` and `export * as ns` in production source give one declaration a second name. Rename the declaration or import it by its own name. Specs are not judged.

### Nested directories

An example is a directory of the runtime clone, not a Git work tree of its own. The machine judges what the given repository root owns: when `git rev-parse --show-toplevel` is not that root (or there is no work tree), `HFS_HOOKS_PATH_REDIRECTED` reports `coverage.hfs.hooksPath.status` as `not-applicable` (a nested directory has no hooks of its own, and the enclosing clone's `core.hooksPath` is not its business), and `HFS_ROOT_ENTRY_FORBIDDEN` lists only the tracked paths under the given root. There is no option, environment variable or allowlist for this.

The backend composition and data checks (`scripts/checks/architecture/{connection-map,sql-owner,register-once,error-masked,default-deny,entrypoint,error-codes,feature-shape,public-surface,composition-spec,schema-owner,module-per-transport,background-unowned}.mjs`, sharing the reading kit `machine-ast.mjs`) run for a backend repository only; each recognises a framework symbol by the package it is imported from and a capability by the file that declares it, never by a variable name. Their coverage is `coverage.hfsMachine.<name>`.

8. **Connection map** (`BE_CONNECTION_DUPLICATE`, R84, `connection-map`): every `hfs.json` connection has `src/modules/platform/database/<name>.connection.ts` exporting `<NAME>_CONNECTION = "<name>"`, `<name>.decorators.ts` exporting `Inject<Pascal>EntityManager` and `<name>.config.ts` reading only `<ENVPREFIX>_*` keys; a connection file for an undeclared name, a `getEntityManagerToken(` or `InjectEntityManager(` call (argument resolved through the checker) outside the decorators file of its connection, a second call in that file, an exported `Inject*EntityManager` anywhere else, and a `getDataSourceToken(` or `InjectDataSource(` outside platform/database, the migrate app and the test fixtures are refused; an app passes each connection to the platform/database module registration once; in every `.starcistacks/<env>/runtime/env` two connections whose host, port and database (`<PREFIX>_NAME`, or `<PREFIX>_DATABASE` when the config reads it) coincide are one database. An env without values for a connection is skipped and counted (`stacksSkipped`).
9. **SQL owner and bounds** (`BE_SQL_TABLE_OWNER`, R86, `sql-owner`): the `sql` tagged templates (tag declared in platform/database) of `<name>.sql.ts` in a capability's `persistence/` are read with a small tokenizer (`sql-tokens.mjs`; comments and strings stripped). A write (`INSERT INTO`, `UPDATE`, `DELETE FROM`, `MERGE INTO`, `TRUNCATE`) must name a table of an `@Entity("<table>")` in the same capability; a read (`FROM`, `JOIN`, `USING`, comma lists) must name a table of an owner the file's owner may import (`importAllowed` to that owner's entry); every table must be declared by some entity; a multi-row `SELECT` needs `LIMIT`, an `=` on every column of the primary key or of one unique key of its first table, or only aggregates without `GROUP BY`. A `${...}` in a table position is dynamic and only counted; joined tables do not extend the key bound.
10. **Register once** (`BE_MODULE_SHAPE`, R45, `register-once`): over the module graph from the app roots, a module in an app root's imports (a `register` call or a listed class, helpers of the root included) is listed once, is imported by no other module and, being a capability module of `src/modules`, is registered with the literal `isGlobal: true`; a module imported by a non-app module has exactly one importer and is in no app root (a feature's application module may be imported by each protocol module of the same feature); `isGlobal: true` appears only in an app root.
11. **Error masked** (`BE_ERROR_MASKED`, R39, `error-masked`): every api app root provides exactly one `APP_FILTER` with `useClass` declared in platform/errors, and every `GraphQLModule.forRoot*` passes the `formatError` platform/errors exports.
12. **Default deny** (`BE_DEFAULT_DENY`, R41, `default-deny-app-guard`): every api app root provides the `APP_GUARD` entries throttler (a class of `@nestjs/throttler` or one extending it), CSRF origin guard (platform/http-security), `AuthGuard` (domain/identity), once each and in that order; other guards may sit between them.
13. **Entrypoint only in apps** (`BE_ENTRYPOINT_ONLY_IN_APPS`, R33, `entrypoint-only-in-apps`): `NestFactory.create*` and a top-level `bootstrap()` call exist only in `apps/<app>/src/main.ts`.
14. **Error codes** (`BE_ERROR_HOME`, machine half of R38, `error-home`): every member of a `<C>ErrorCode` enum in a capability's `errors/<c>.error.ts` is a string literal `<CAPABILITY>_<WHAT>` (UPPER_SNAKE of the owning capability, no `_ERROR` or `_EXCEPTION` suffix) and unique across the repository.
15. **Config the machine reads** (`HFS_ARCH_CONFIG_UNREAD`, R24, `arch-config-unread`, `config-unread.mjs`; both profiles): a tracked `architecture.json` (retired; `hfs.json` is the declaration) is a finding at its own path, and a declaration whose program holds no production source file is a finding at `hfs.json`. Coverage `coverage.configUnread`.
16. **Feature shape** (`BE_FEATURE_SHAPE`, R29, `feature-shape`): every tracked file below a feature root is classified by the slot resolver and matched against the `requires` and `allows` entries of the slot that owns it (`slot-allows.mjs`; a `<var>` the slot binds is its value, any other is one path segment). The feature root holds `index.ts`, `<f>.module.ts`, `application/`, `transport/<protocol>/`, `messages/`; a directory no slot owns (an unknown protocol, `application/graphql/`) and a file of a role its folder does not allow are findings. The slot lists are the only vocabulary.
17. **Public surface** (`BE_PUBLIC_SURFACE`, R30, `index-export-count`): an owner of the feature, domain, platform and integrations tiers has one `index.ts` and no nested `index.*` below its root; that `index.ts` holds only `export { }` / `export type { }` lines (`export *` stays `ARCH_OWNER_EXPORT_STAR`, `export * as` stays `HFS_ALIAS_REEXPORT`) and at most the `budget.indexExports` names of the owner's slot. The eslint rule `no-folder-reexport` reads the same figure per file; the machine adds what it alone sees (nested barrels, non-export statements).
18. **Composition spec** (`BE_APP_COMPOSITION_ONLY`, R32, `composition-spec-boots-real-module`): for each app whose slot requires `app.module.ts`, `<app>.composition.spec.ts` (read from disk, specs are outside the program) imports `AppModule` from the app's own `./app.module` and calls `AppModule.register(`; declaring or importing another `AppModule` boots a stand-in.
19. **Schema owner** (`BE_SCHEMA_OWNER`, R35, `schema-owner`): a TypeORM `@Entity` class and a `MigrationInterface` class live only in `persistence/{entities,migrations}` of a domain or platform capability, and a file in a folder named `entities` or `migrations` elsewhere is refused; `persistence/connection.ts` exports `CONNECTION` resolving (through the checker) to a connection of `hfs.json`; the capability's `index.ts` exports `<c>Entities` and `<c>Migrations` (and nothing else from `persistence/`); a migration is `<epochMs13>-<kebab>.ts`, class `<Pascal><epochMs13>`, `name` equal to the class name, with no unit spec.
20. **Module per transport** (`BE_MODULE_SHAPE`, R45, `module-per-transport`): one `<f>-<protocol>.module.ts` per transport folder and nothing else that is a module there, no module-definition and no `@Module`/`ConfigurableModuleBuilder` outside `<f>.module.ts` and the transport module in a feature; an app root lists only transport modules, of the kinds the `composedBy` list of the transport slot allows for the app kind (api: graphql, http, websocket; worker: schedule, message; cli: cli).
21. **Background unowned** (`BE_BACKGROUND_UNOWNED`, R46, `background-unowned`): every `*.job.ts` and `*.consumer.ts` is reachable, through runtime imports, from the root module of a `worker` app; `@Cron`, `@Interval`, `@Timeout` (from `@nestjs/schedule`) and `setInterval` exist only in `platform/scheduling`; a method named `sweep`, `deliver`, `reconcile` or `retry` (alone or as the first camelCase word) in a feature, domain or integrations class is reachable from a composed job or consumer (its imports, and the files of the feature that holds it, whose handlers the command bus registers). Reachability is static.

The frontend repository checks (`scripts/checks/architecture/{transport-owner,route-files-thin,hooks-are-hooks,package-shape}.mjs`) run for a front-end repository only; their coverage is `coverage.hfsMachine.<name>`.

22. **Transport owner** (`FE_TRANSPORT_OWNER`, R50, `transport-owner`): per `next` app, `modules/api/client.ts` (`ruleParams.fe.clientModule`) calls the global `fetch`; no other file references it (a call, `globalThis.fetch`, an alias, a value passed to another function); no file imports an HTTP library (static import, `import()`, `require()`); every `modules/api/<domain>/read-*.ts` imports the client. The eslint rules judge the spelling of a call in one file; this judges what the checker resolves.
23. **Route files thin** (`FE_ROUTE_FILES_THIN`, R54, `route-files-thin`): a `layout`, `template`, `loading` or `not-found` route file draws no host element, declares no inline component and mounts exactly one feature owner (a package shell may wrap it); every route file, `page` included, calls no hook. The page mount and redirect rules stay `FE_ROUTE_ONE_PAGE`, `FE_ROUTE_DRAWING_DECISION`, `FE_ROUTE_CLIENT_BOUNDARY`, `FE_ROUTE_CLIENT_HOOK`.
24. **Hooks are hooks** (`FE_HOOKS_ARE_HOOKS`, R56, `hooks-are-hooks`): the repository half of the eslint rule `hooks-folder-holds-hooks-only`: a hooks domain has at most one shared file, named `<domain>.shared.ts`, and no non-hook helper name is declared in two files of the domain.
25. **Package shape** (`FE_PACKAGE_SHAPE`, R63, `package-shape`): the manifest of every package owner has `scripts.build`, an explicit `exports` map (no `*` or folder subpath) and every export target, `main`, `module`, `types` and `typings` inside `./dist/`. `export *` in the entry, dead exports and package tiers are judged by `ARCH_OWNER_EXPORT_STAR`, `HFS_UNUSED_EXPORT` and the eslint tier rules.


## Failure classes

`errors` report missing target TypeScript, malformed manifests/tsconfig, source syntax problems, unresolved internal imports/exports, and invalid checker configuration. `violations` report source dependencies or shapes that cross a resolved responsibility boundary. An unavailable parser or required input is an error, not a passing check.
