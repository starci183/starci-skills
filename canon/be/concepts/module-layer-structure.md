# The module layer (`src/modules/`)

Source: `src/modules/*` for the pattern, `apps/core/src/app.module.ts` for the registrations.

A module is a **reusable unit** — a `DynamicModule` called from the
[feature layer](feature-layer.md) or from another module. A module never exposes an endpoint of its
own; that is what the feature layer is for.

## The fixed three-file shape

- `<name>.module.ts` — the `@Module`, extending `ConfigurableModuleClass`.
- `<name>.module-definition.ts` — the `ConfigurableModuleBuilder` behind `register({ isGlobal })`.
- `index.ts` — the re-export of the public API. Leave it out and the `@modules/<name>` alias breaks.

## Services stay flat

`*.service.ts` sits at the module root. Do not give a service its own folder. `types/`, `enums/`,
`constants/` and `utils/` are folders **beside** the service, each with an `index.ts`, and each is
created only when it has something in it. Anything genuinely shared across many modules belongs in
`@modules/common`.

## Large modules nest

A big module imports its sub-module via `.register({...})` and then re-exports it in `exports: [...]`,
so a consumer always goes through the parent. `@modules/ai` wraps `ai/balancer/` this way. Importing
the sub-path directly is what breaks later, when the parent changes how the child is configured.

## `app.module.ts` is the manifest

`apps/core/src/app.module.ts` is the central declaration of what is switched on. Read that file
**first** when you need to know whether a module is active — the folder existing under `src/modules/`
proves nothing.

## The real catalog

- Data: `databases/`, `cache/`, `s3/`, `crypto/`
- Domain: `bussiness/` — see [feature-layer](feature-layer.md)
- Messaging: `cqrs/`, `event/`, `bullmq/`, `socketio/`, `kafka/`
- Auth and security: `keycloak/`, `session/`, `membership/`, `throttler/`, `vaildators/`
- AI and execution: `ai/`, `langchain/`, `rag/`, `judge0/`
- Payment: `payos/`, `sepay/`, `stripe/`, `paypal/`, `nowpayments/`
- Platform: `env/`, `exceptions/`, `logger/`, `winston/`, `sentry/`, `init/`, `filesystem/`

## Two typos that stay

`bussiness` (business) and `vaildators` (validators) are spelled that way on disk and are kept that
way on purpose: renaming either breaks imports across the whole repo. Write what the codebase writes,
or the import will not resolve.
