# Portable source architecture

Reviewed: 2026-09-16

This guide defines one responsibility model for a single-source repository and a monorepo. Repository
topology changes how roots and package manifests are discovered. It does not change which unit owns a
framework adapter, product scenario, reusable capability, or visual contract.

## Decision

Dependencies point from delivery-specific code toward stable owned capabilities:

```text
framework entry -> feature scenario -> reusable module -> vendor or Grammar
```

An owner keeps its public contract beside the implementation and exposes it through one declared entry.
Code moves to a shared package because it has a cohesive owner, lifecycle, and public contract. A second
consumer, a folder count, or a desire to shorten an import is not sufficient.

This decision rejects three common alternatives:

- A total folder rank that forces every render through every visual tier. The sanctioned tiers expose
  responsibilities and legal dependency edges; a feature may compose the lowest useful visual directly.
- Hooks hidden beside pages or components. All authored custom hooks live under the configured `hooks/`
  root, grouped by product domain, while modules retain transport and reusable capability ownership.
- Mandatory wrappers such as a presentational twin, forwarding service, CQRS command, or dynamic module.
  Use machinery only when it owns a real render, dispatch, configuration, or lifecycle boundary.

## Responsibility graph

| Responsibility | Owns | May depend on | Must not own |
| --- | --- | --- | --- |
| Framework entry | Boot, route parameters, headers/cookies, redirects, framework providers | Feature entry, app composition | Product scenario logic, persistence, reusable UI internals |
| Feature | One user or system scenario, its commands, queries and handlers, transport adapters, scenario state and mapping | Reusable modules and visual contracts | Generic infrastructure for unrelated scenarios |
| Module | One cohesive reusable domain, platform, or integration capability | Lower modules and vendor APIs | Feature orchestration or app boot |
| Grammar/UI package | Product-agnostic renderers, tokens, interaction primitives | Its declared peers | Routes, session, persistence, product names, transport |

The graph permits a feature with one consumer and a module with one consumer. Reuse count is not an
ownership rule.

## Frontend profile

### Concrete layout

```text
src/
  middleware.ts                          # framework-pinned root file; imports modules/feature entries only
  instrumentation.ts                     # framework-pinned root file (optional)
  app/
    [lang]/authentication/page.tsx       # framework adapter; internal imports enter features only
    [lang]/layout.tsx                    # framework shell adapter
  features/
    pages/AuthenticationPage/
      index.tsx                          # route-facing page owner/public entry
    layouts/AppLayout/
      index.tsx                          # product layout owner
    overlays/CheckoutOverlay/
      index.tsx                          # product overlay owner
  components/
    blocks/CatalogBlock/
      index.tsx                          # connected owner only when it reads product world
      component.tsx                      # required sibling render owner for a connected block
    composites/CourseCard/index.tsx
    branches/NavigationRail/index.tsx
    leaves/Icon/index.tsx
  hooks/
    authentication/useAuthentication.ts  # every authored custom hook, grouped by domain
    catalog/useCatalog.ts
    index.ts                             # optional explicit public entry
  modules/
    api/index.ts                         # transport/client capability
    session/index.ts                     # cohesive reusable capability
    routing/index.ts
packages/
  grammar/
    package.json                         # declared exports are the package API
    src/common/index.ts
```

The same role roots may be declared for one repository or for each Next workspace in a monorepo. Empty
role folders are never required. `app/` may import React, Next and external framework packages, but every
resolved internal import or re-export, including a type-only edge, enters a public `features/{pages,
layouts,overlays}` unit. Features compose components, hooks and modules. Modules never point to hooks,
components, features or app; hooks never point to components, features or app; components never point to
features or app.

Nothing else sits directly in the source root (the directory holding `app/`, usually `src/`) except the
framework-pinned root files Next.js loads only from there: `middleware` (and `proxy`, its Next 16 name),
`instrumentation` and `instrumentation-client` (`.ts`, `.js`, `.mjs`) and `next-env.d.ts`. The exact list is authored once in
`knowledge/patterns/fe/folder.yaml` (FE-FOLDER-1 `frameworkPinnedRootFiles`) and the architecture check
reads it from there (`FE_SOURCE_LAYOUT_INVALID` accepts exactly those basenames at the source root). Each is
a thin adapter: every resolved internal import enters `modules/` or a feature public entry
(`FE_TIER_DIRECTION`), and every other rule still applies, except that the export names the
framework mandates in that file keep their framework spelling (`frameworkPinnedRootExports`: `config`,
`middleware`/`proxy` and default; `register`, `onRequestError`; `onRouterTransitionStart`) there and
nowhere else. Locale routing, proxies and request
config belong in `modules/<capability>/`; a helper folder beside a pinned file (`src/middleware/`,
`src/i18n/`) has no owner and moves, with framework configuration such as `next.config.ts` pointed at the
new path.

### Next route and client boundaries

- `page.tsx` and `layout.tsx` are framework adapters. A visual route resolves framework inputs and mounts
  one feature/page owner. A redirect or `notFound` adapter mounts no visual owner. A terminal session guard
  may precede the one visual return.
- Keep server components as the default. Add `"use client"` at the lowest module whose graph needs state,
  effects, browser APIs, event handlers, or client-only hooks.
- Intrinsic visual state stays with the visual that owns it: focus, disclosure, drag, measurement,
  reduced-motion, and an unsaved form draft do not require a connected/Base split.
- Product data, session, route decisions, locale decisions, and request lifecycle have one connected owner.
  A connected block uses `index.tsx` for that owner and hands every nonempty render path to a pure export
  from sibling `component.tsx`. A pure block and all leaves, branches and composites need no twin. Lower
  visual tiers may call built-in React hooks for intrinsic interaction, but they cannot own product-world
  lifecycle. Every authored custom `useX` hook, including an intrinsic helper, belongs under `hooks/`.
- Lift state only to the closest owner that coordinates it. When identity or resource keys change, reset
  drafts at that boundary so values cannot cross workspaces, installations, accounts, or routes.

### Transport and frontend DTOs

Keep four contracts distinct:

1. The schema-derived wire contract belongs to the API adapter. Prefer generated `TypedDocumentNode`
   documents and generated variable/result types when the GraphQL toolchain is available.
2. A reusable capability or hook input/result belongs to its module or hook and is neutral to Apollo,
   GraphQL, Next, and persistence. A feature-specific view model stays with its feature.
3. The owning hook/module adapter maps wire values and failures into its own public result; the feature
   maps that result to its view model or presentation props. Hooks and modules never import feature types.
4. A presentational props contract contains resolved render values and user actions. It does not runtime-
   import transport enums, response envelopes, Apollo errors, or operation types.

Handwritten wire types may be necessary when no usable generator is installed, but they must name the
schema revision/introspection source and be checked for drift. They are adapter types, not reusable product
models. Grammar never imports them.

### Packages and imports

- Use relative imports inside one unit and the repository's configured source alias inside one source root.
- Cross-package imports use the dependency package name and a declared `package.json.exports` entry.
  TypeScript `paths` do not create a package API and must not bypass package exports.
- A `file:packages/grammar` dependency is still a package boundary even when the root has no `workspaces`
  field. A workspace and a single-source repository follow the same export rule.
- Use feature and module public entries. A root hooks barrel is optional, while the `hooks/<domain>/`
  location is mandatory for authored custom hooks and remains separate from module transport ownership.
- Grammar imports use an installed public family entry such as `@starci/grammar/common`; verify the actual
  export before using a component or prop.

## Backend profile

The backend instantiates the same graph with framework boot, feature scenarios, and reusable capabilities.
The exact transport (GraphQL, HTTP, message) does not create the feature owner.

```text
apps/
  api/src/
    main.ts                               # bootstrap only
    app.module.ts                         # composition/configuration only
src/
  features/
    cart/
      index.ts                            # public feature entry
      cart.module.ts
      transport/
        graphql/add-to-cart.resolver.ts
      application/
        add-to-cart.command.ts
        add-to-cart.handler.ts
        add-to-cart.contracts.ts
  modules/
    domain/
      identity/
        index.ts
    platform/
      database/
        index.ts
        database.module.ts
        database.options.ts               # typed runtime configuration when it exists
        primary.decorators.ts             # InjectPrimaryEntityManager()
    integrations/
      payment-provider/
        index.ts
```

- Apps own boot/configuration/composition. They do not own handlers, services, controllers, or business
  rules.
- A feature owns its transport adapters and its application handlers. A resolver/controller/message consumer
  validates/adapts the protocol and dispatches one typed command or query.
- A reusable module under `modules/{domain,platform,integrations}/<capability>` owns one cohesive domain,
  platform, or provider capability. It never imports a feature
  or app. Named databases, provider instances, and tenant/workspace instances remain with their actual
  owner; do not turn them into a universal global singleton.
- The application layer of the backend is one typed command or query per operation and one handler that owns
  it. Multiple adapters can dispatch the same command. Async delivery, replay, and audit need their own
  durable contracts (an outbox message consumed by a job or consumer); an in-process command bus does not
  establish them. Do not add resolver -> forwarding service -> command -> forwarding handler.
- A backend capability module is a configurable module with typed options and one representative module
  registered once per app; a feature module is static.
- Transport DTOs belong to their adapter. Application input/results remain framework-neutral. Persistence
  entities stay behind the database adapter and are mapped before crossing the feature contract.

A product that predates this profile may keep another shape, such as transport-first features with the
protocol code above the use cases. That is a source mapping to assess, not a portable requirement and not
permission to copy every wrapper. Refactoring an existing product still follows its accepted SDS and
bounded transition plan.

## Single source and monorepo profiles

| Concern | Single source repository | Monorepo |
| --- | --- | --- |
| Source discovery | Explicit source roots and nearest manifests | Workspace globs plus nearest manifests |
| Internal dependency | Configured source alias or relative import inside one owner | Package specifier through declared exports across owners |
| Local package | `file:` dependency is a real package boundary | Workspace dependency is a real package boundary |
| Backend + frontend in one root | Both roles remain explicit; one host/runtime and one Work owner | Same rule; workspace layout does not duplicate Work/runtime |
| Architecture | Entry -> feature -> module -> vendor/Grammar | The same |

Do not require `src/`, a root `tsconfig`, pnpm, or workspaces when the selected build has another valid
layout. Resolve actual manifests, aliases, exports, and source roots before enforcing edges.

## When an abstraction is justified

Extract a boundary when at least one concrete responsibility needs it:

- independent lifecycle or custody,
- stable contract consumed across an owner boundary,
- independently selected implementation or provider,
- coordinated state shared by callers,
- transactional, dispatch, retry, replay, or versioning semantics,
- product-agnostic visual API intended for distribution.

Do not extract merely because code is long, has two callers, needs mocking once, or resembles another file.
Length can reveal mixed responsibilities, but the repair is to identify their owners rather than create a
generic `utils`, `services`, or `hooks` bucket.

## What static checks can prove

Static architecture checks may enforce:

- resolved dependency direction through relative paths, aliases, package exports, re-exports, and literal
  dynamic imports;
- thin framework route shape and one visual owner;
- package-to-app and package-export bypasses;
- pure render units importing product-world hooks or transport at runtime;
- fetch/transport calls outside configured adapter roots;
- imports that resolve outside declared roots or to missing files.

Static checks cannot prove:

- correct state lifetime, reset behavior, hydration, accessibility, or rendered composition;
- that a data owner makes only one request or uses the correct cache identity;
- GraphQL schema/code-generation freshness or semantic DTO mapping;
- DI bootability, transaction boundaries, concurrency/idempotency, fencing, delivery acknowledgement, or
  provider side-effect safety;
- that a public API is cohesive and stable rather than merely exported.

These require focused behavior, boot, contract, concurrency, and accessibility tests plus review of the
accepted SRS/SDS. A green architecture check is structural evidence only.

## Reference critique

Reference: the `examples/todo-app` and `examples/ecommerce-app` trees of this repository.

### Keep as reference

- `examples/todo-app/fe/apps/web/src/app/[locale]/sign-in/page.tsx` is a thin route adapter that mounts one
  page owner.
- `examples/todo-app/fe/apps/web/src/app/[locale]/layout.tsx` is a valid server layout for locale
  validation, metadata and shell composition; its sibling `providers.tsx` is a narrow client provider
  boundary.
- `examples/ecommerce-app/fe/apps/shop/src/app/[locale]/page.tsx` mounting `ShopRootRedirect` is a valid
  zero-visual-owner adapter.
- `examples/todo-app/fe/apps/web/src/modules/api/client.ts` is a cohesive technical capability, and hooks
  such as `src/hooks/task/useTasks.ts` show SWR owning product data caching.
- Product code imports the public `@starci/grammar/common` entry; the installed package's declared exports
  are the API.
- `examples/todo-app/fe/apps/web/src/components/blocks/sign-in-screen/index.tsx` legitimately owns the
  sign-in form's draft state beside its connected role. An unsaved form draft is intrinsic state, not
  product-world lifecycle, and is not evidence of a missing responsibility boundary.

### Treat as debt, not precedent

- A product journey, browser persistence, transport operations and UI transition state combined in one
  hook would not be one owner: the coherent owner is the feature, with browser/transport mapping at its
  data boundary.
- A global hook barrel described as one public door while units deep-import hook paths is inconsistent;
  it is not a useful ownership boundary.
- Presentation should depend on feature/view contracts, with wire enums mapped at data: a presentational
  component importing handwritten transport types couples render to the wire.
- Wire types handwritten from a live schema drift; where no usable generator is installed they must name
  the schema revision and be checked for drift.
- Connected blocks fetching independently below a page are valid only for independently reusable
  capabilities; coordinated loading, identity, failure, or request state belongs to the feature/page owner.
- Client-only page markers on adapters that merely mount a client owner enlarge the client graph without
  owning browser behavior. Keep the boundary at the connected owner when the route itself needs none.

These observations describe transition targets only when an accepted SDS selects them. Current source is
evidence for the standard, not product-design authority or proof that a target product must be refactored.

## Primary references

Reviewed 2026-09-16:

- [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure): App Router is
  unopinionated about project organization; private folders and colocation are optional organization tools.
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components):
  pages/layouts are server components by default, and `"use client"` declares a client module graph boundary.
- [React: Sharing State Between Components](https://react.dev/learn/sharing-state-between-components): each
  state value has one owner and is lifted to the closest component that coordinates it.
- [React: Keeping Components Pure](https://react.dev/learn/keeping-components-pure): render purity concerns
  side effects and mutation during render; it does not ban local interaction state.
- [TypeScript module reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html): module
  resolution and package exports determine reachability; `paths` does not rewrite emitted imports.
- [Apollo Client TypeScript](https://www.apollographql.com/docs/react/data/typescript): typed documents and
  generated operation types bind result and variable types to the selected operation.
