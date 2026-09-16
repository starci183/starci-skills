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

- A folder-rank architecture such as `page -> block -> leaf` for every file. Those names help navigation,
  but responsibility decides dependency direction.
- A global `hooks` or `services` layer that becomes the public door for unrelated features. It hides the
  scenario owner and lets browser, transport, and product policy accumulate in one place.
- Mandatory wrappers such as a presentational twin, forwarding service, CQRS command, or dynamic module.
  Use machinery only when it owns a real render, dispatch, configuration, or lifecycle boundary.

## Responsibility graph

| Responsibility | Owns | May depend on | Must not own |
| --- | --- | --- | --- |
| Framework entry | Boot, route parameters, headers/cookies, redirects, framework providers | Feature entry, app composition | Product scenario logic, persistence, reusable UI internals |
| Feature | One user or system scenario, use cases, transport adapters, scenario state and mapping | Reusable modules and visual contracts | Generic infrastructure for unrelated scenarios |
| Module | One cohesive reusable domain, platform, or integration capability | Lower modules and vendor APIs | Feature orchestration or app boot |
| Grammar/UI package | Product-agnostic renderers, tokens, interaction primitives | Its declared peers | Routes, session, persistence, product names, transport |

The graph permits a feature with one consumer and a module with one consumer. Reuse count is not an
ownership rule.

## Frontend profile

### Concrete layout

```text
src/
  app/
    [lang]/authentication/page.tsx       # Next route adapter
    [lang]/layout.tsx                    # server shell/locale adapter
    providers.tsx                        # narrow client provider boundary
  features/
    authentication/
      index.ts                           # public feature entry
      page/
        index.tsx                        # route-facing connected owner
        component.tsx                    # optional useful render contract
        classNames.ts
      ui/
        AuthenticationPanel/
          index.tsx                      # feature state/lifecycle owner
          component.tsx                  # optional resolved visual contract
      model/
        auth-flow.ts                     # pure transitions and feature types
      data/
        operations.graphql.ts            # feature-selected operation documents
        mapper.ts                        # wire failures/data -> feature model
        use-authentication.ts            # browser request lifecycle
  modules/
    api/
      index.ts                           # public technical capability
      client/create-apollo-client.ts
      generated/                         # schema-derived wire types/documents
    session/
      index.ts
      session-store.ts
    routing/
      index.ts
  components/
    ...                                  # reusable product visuals without scenario ownership
packages/
  grammar/
    package.json                         # declared exports are the package API
    src/common/index.ts
```

The names under a feature may follow the repository's established basename convention. The invariant is
the owner, not the spelling. A small feature can keep `page`, `data`, and `model` in fewer files while the
dependencies still point in the same direction.

### Next route and client boundaries

- `page.tsx` and `layout.tsx` are framework adapters. A visual route resolves framework inputs and mounts
  one feature/page owner. A redirect or `notFound` adapter mounts no visual owner. A terminal session guard
  may precede the one visual return.
- Keep server components as the default. Add `"use client"` at the lowest module whose graph needs state,
  effects, browser APIs, event handlers, or client-only hooks.
- Intrinsic visual state stays with the visual that owns it: focus, disclosure, drag, measurement,
  reduced-motion, and an unsaved form draft do not require a connected/Base split.
- Product data, session, route decisions, locale decisions, and request lifecycle have one connected owner.
  Split out a render component only when the resolved props/actions form an independently useful contract.
  A missing `component.tsx`, `Base`, or paired test is not a violation.
- Lift state only to the closest owner that coordinates it. When identity or resource keys change, reset
  drafts at that boundary so values cannot cross workspaces, installations, accounts, or routes.

### Transport and frontend DTOs

Keep four contracts distinct:

1. The schema-derived wire contract belongs to the API adapter. Prefer generated `TypedDocumentNode`
   documents and generated variable/result types when the GraphQL toolchain is available.
2. A feature input/result or view model belongs to the feature and is neutral to Apollo, GraphQL, Next, and
   persistence.
3. A mapper at the feature data boundary translates wire values and failures into that feature contract.
4. A presentational props contract contains resolved render values and user actions. It does not runtime-
   import transport enums, response envelopes, Apollo errors, or operation types.

Handwritten wire types may be necessary for a legacy or unavailable generator, but they must name the
schema revision/introspection source and be checked for drift. They are adapter types, not reusable product
models. Grammar never imports them.

### Packages and imports

- Use relative imports inside one unit and the repository's configured source alias inside one source root.
- Cross-package imports use the dependency package name and a declared `package.json.exports` entry.
  TypeScript `paths` do not create a package API and must not bypass package exports.
- A `file:packages/grammar` dependency is still a package boundary even when the root has no `workspaces`
  field. A workspace and a single-source repository follow the same export rule.
- Prefer feature and module public entries. A repository-wide hook barrel is optional; it is not an
  architecture boundary and must not obscure the owning feature.
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
        add-to-cart.use-case.ts
        add-to-cart.input.ts
        add-to-cart.result.ts
      domain/                             # only policy genuinely owned by this feature
  modules/
    domain/
      identity/
        index.ts
    platform/
      primary-postgresql/
        index.ts
        primary-postgresql.module.ts
        primary-postgresql.options.ts     # typed runtime configuration when it exists
    integrations/
      payment-provider/
        index.ts
```

- Apps own boot/configuration/composition. They do not own handlers, services, controllers, or business
  rules.
- A feature owns its transport adapters and application use cases. A resolver/controller/message consumer
  validates/adapts the protocol and invokes a typed use-case boundary.
- A reusable module under `modules/{domain,platform,integrations}/<capability>` owns one cohesive domain,
  platform, or provider capability. It never imports a feature
  or app. Named databases, provider instances, and tenant/workspace instances remain with their actual
  owner; do not turn them into a universal global singleton.
- Use a command/handler split only when a selected bus owns concrete dispatch or pipeline semantics.
  Multiple adapters can call the same direct use case. Async delivery, replay, and audit need their own
  durable contracts; an in-process command bus does not establish them. Do not add resolver -> forwarding
  service -> command -> forwarding handler when one use case owns the work.
- Use a dynamic module or module-definition only for real typed runtime options, instance registration, or
  lifecycle. A static module is the default when those semantics are absent.
- Transport DTOs belong to their adapter. Application input/results remain framework-neutral. Persistence
  entities stay behind the database adapter and are mapped before crossing the feature contract.

The existing Academy backend is transport-first under `src/features/api/core/graphql/...`. That is a source
mapping to assess, not a portable requirement and not permission to copy every wrapper. Refactoring an
existing product still follows its accepted SDS and bounded migration plan.

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

## Academy reference critique

Reference revision: `starci-academy-fe@44bba218685b7eed2a5d9e479689707ab6381bc8`.
The two pre-existing dirty style files (`packages/grammar/src/core/styles.css` and `src/app/globals.css`) were
excluded from this trace; observations use the pinned commit.

### Keep as reference

- `src/app/[lang]/authentication/page.tsx` is a thin route adapter that mounts one page owner.
- `src/app/[lang]/layout.tsx` is a valid server layout for locale validation, messages, metadata, and shell
  composition; `src/app/providers.tsx` is a narrow client provider boundary.
- `src/modules/api/graphql/clients/create-apollo-client.ts` is a cohesive technical capability and records
  that SWR, rather than Apollo cache, owns product data caching.
- `packages/grammar/package.json` exposes explicit family exports, and product code imports the public
  `@starci/grammar/common` entry.
- `AuthenticationPanel/component.tsx` legitimately owns intrinsic form refs, hydration protection, focus,
  and draft interaction. Its local state is not evidence of a missing pure twin.

### Treat as debt, not precedent

- `src/hooks/auth/useAuthPanel.ts` combines a product journey, browser persistence/history, OAuth redirect,
  GraphQL operations, Apollo error mapping, session token storage, and UI transition state. The coherent
  owner is the authentication feature, with browser/transport mapping at its data boundary.
- `src/hooks/index.ts` is described as one public door, while authentication and other units deep-import
  hook paths. The inconsistency shows that a global hook barrel is not a useful ownership boundary.
- `AuthenticationPage/component.tsx` type-imports `AuthMode` from the scenario hook, and
  `AuthenticationPanel/component.tsx` runtime-imports `KeycloakIdentityProvider` from handwritten GraphQL
  transport types. Presentation should depend on feature/view contracts, with wire enums mapped at data.
- `src/modules/api/graphql/mutations/types/auth.ts` records live-schema introspection in handwritten types,
  while operation documents use manually paired generic response/variable types. This can drift because the
  document is not a typed generated contract.
- Several connected blocks independently fetch below a page. That is valid only for independently reusable
  capabilities; coordinated loading, identity, failure, or request state belongs to the feature/page owner.
- Client-only page markers on adapters that merely mount a client owner enlarge the client graph without
  owning browser behavior. Keep the boundary at the connected owner when the route itself needs none.

These observations describe migration targets only when an accepted SDS selects them. Current source is
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
