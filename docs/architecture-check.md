# Architecture check

`starci architecture check <repo-root>` is a read-only TypeScript dependency and source-shape check. It resolves the checked repository's manifests, `tsconfig` aliases, relative paths, workspace/file packages, declared exports, re-export barrels, static `import()` calls, and string-literal `require()` calls. It reports architectural evidence; it does not promote current code into the standard.

```text
starci architecture check .
starci architecture check . --config architecture.json
```

The command writes one `starci/architecture-check@1` JSON object. Exit code `0` means `ok: true`; exit code `1` means the record contains violations or errors. Each finding identifies a repository-relative path, one-based location, stable rule id, message, and, for resolved dependency failures, the target and dependency chain.

## Responsibility model

Topology and architecture answer different questions. A single-project Nest application, a Nest monorepo, a Next application with local `file:` packages, an npm-workspaces frontend, and an explicitly bound repository containing both backend and frontend can implement the same responsibility boundaries. A same-root binding still has one Work owner and one runtime; it does not erase backend/frontend roles or permit duplicated workspace state.

Backend dependencies point from executable application composition to use-case features to cohesive capabilities/modules. Features orchestrate entry scenarios. Modules own cohesive domain or infrastructure capabilities and expose narrow APIs even when only one feature consumes them. Apps may bootstrap the framework, select modules/providers, install process middleware and app-wide adapters, and start the process; they do not own business handlers, services, controllers, resolvers, repositories, or entities. A configured or single-application-layout `apps` root never absorbs the feature and module roots nested inside it, so a single `src/main.ts` plus `src/app.module.ts` beside `src/features` and `src/modules` is still measured as thin app composition rather than counting every feature/module file as app source.

Frontend roots are explicit: `app`, `features/{pages,layouts,overlays}`, `components/{blocks,composites,branches,leaves}`, `hooks/<domain>`, and `modules/<capability>`. App adapters may use React, Next and external framework packages, while every resolved internal import or re-export, including type-only edges, enters a feature public entry. Features compose components, hooks and modules. Components cannot point to features/app; hooks cannot point to components/features/app; modules cannot point to hooks/components/features/app. The visual tiers form a bounded dependency graph, not a requirement to pass through every tier.

Configured app, feature, component, hook and module roots are disjoint; transport may remain nested under
modules. Discovered workspace roots are additive, so a narrow authored map cannot hide another Next app.
When `owners` declares public entries, that list is closed and app imports may use only its exact feature
entries. Without `owners`, the checker can validate the exact structural feature index, while owner public-API
coverage remains unavailable and cannot support a full conformance claim.

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

When a backend explicitly selects `exported-class-token` registration checking, the checker discovers every resolved Nest `@Module`, `@CommandHandler`, and `@QueryHandler` in the checked production TypeScript program. A class-token provider that a module both provides and exports has one static owner; another module listing that same class token must import the owner instead. A provider object with a different named token remains a distinct registration. Selected CQRS decorators must have exactly one direct module registration. Dynamic/spread provider metadata, an unresolved framework binding, or a discovered handler decorator omitted from the selected set makes registration coverage unavailable rather than passing an incomplete inventory. This static relation does not prove runtime scope, dynamic-module options, or a bootable DI container.

Resolved backend feature/module roots use the adopted domain-first source shape without an enablement flag. Recognized application roles live under `application/`; recognized protocol roles live under `transport/<protocol>/`. Resolved GraphQL DTO decorators bind DTOs to `transport/graphql`, while resolved TypeORM entity/migration identities cannot make a feature the schema owner. The naming check covers kebab-case role files, exported class role suffixes, application object contracts whose roles are known, enum declarations, and static GraphQL field/argument names. It does not invent a role for an arbitrary helper or infer persistence/error ownership from a folder string. An unclassified role, constructed decorator binding, dynamic GraphQL name, or declared unsupported legacy root makes the applicable layout or naming coverage unavailable and omits that rule ID from `coverage.checkedRuleIds`.

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

## Optional layout config

Repositories with equivalent responsibilities at different paths may add a small JSON config. It changes roots and role mappings; it cannot contain baselines, ignores, or suppressions. `legacyRoots` records an existing unsupported source profile and deliberately makes source-shape coverage unavailable; it never turns that source green or excludes it from `coverage.sourceFiles`.

```json
{
  "schema": "starci/architecture-config@1",
  "kinds": ["backend", "frontend"],
  "tsconfig": "tsconfig.json",
  "backend": {
    "modules": "server/modules",
    "features": "server/features",
    "apps": ["server/apps"],
    "legacyRoots": ["server/features/legacy-transport-first"],
    "moduleRegistration": {
      "providerIdentity": "exported-class-token",
      "handlerDecorators": ["CommandHandler", "QueryHandler"]
    }
  },
  "frontend": {
    "routes": "web/app",
    "features": "web/features",
    "components": "web/components",
    "hooks": "web/hooks",
    "modules": "web/modules",
    "transport": "web/modules/api"
  }
}
```

All paths are repository-relative. The config is a regular file inside the checked repository.

## Failure classes

`errors` report missing target TypeScript, malformed manifests/tsconfig, source syntax problems, unresolved internal imports/exports, and invalid checker configuration. `violations` report source dependencies or shapes that cross a resolved responsibility boundary. An unavailable parser or required input is an error, not a passing check.
