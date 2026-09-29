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

1. **Tier direction matrix** (`BE_TIER_DIRECTION`, `FE_TIER_DIRECTION`, `FE_APP_ISOLATION`): every import, re-export and type-only import between two owners follows the `tiers` matrix of the manifest; feature to feature is never allowed, apps never import each other, a component layer imports only the layers after it.
2. **Owner cycles** (`ARCH_OWNER_CYCLE`): a strongly connected component of the owner graph, type-only imports included, reported with the cycle path.
3. **Reachability** (`BE_FEATURE_NOT_COMPOSED`, `BE_MODULE_NOT_COMPOSED`, `FE_OWNER_REACHABLE`, `FE_HREF_RESOLVES`): every backend feature and capability module is composed into an app root by runtime imports; every frontend page, layout and overlay feature is mounted by an `app/` route and every literal href targets an existing route.
4. **Dead exports** (`HFS_UNUSED_EXPORT`): an owner's `index` exports a name no file outside the owner imports.
5. **Required files** (`FE_ERROR_BOUNDARY_MISSING`, `BE_REQUIRED_MODULE_MISSING`, `HFS_REQUIRED_FILE_MISSING`): the files each slot and app requires, such as `global-error.tsx`, `error.tsx`, `not-found.tsx`, `loading.tsx` and the required platform modules.
6. **File size growth** (`HFS_SIZE_GROWTH`): a file above the soft line budget (`ruleParams.<profile>.fileLines.soft`) may not grow against the merge-base, and a new file stays within the budget. Without a resolvable base the coverage is `unavailable`, never a pass.
7. **Duplicate blocks** (`HFS_DUPLICATE_BLOCK`): a token-normalised clone of at least `ruleParams.<profile>.duplicateBlockLines` lines across two owners; the finding names both locations and the slot where the shared helper belongs.

## Failure classes

`errors` report missing target TypeScript, malformed manifests/tsconfig, source syntax problems, unresolved internal imports/exports, and invalid checker configuration. `violations` report source dependencies or shapes that cross a resolved responsibility boundary. An unavailable parser or required input is an error, not a passing check.
