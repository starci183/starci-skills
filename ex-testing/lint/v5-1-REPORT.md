# v5-1-REPORT — shared E2E kit extraction (`@starci-examples/e2e-kit`)

Scope per brief `ex-testing/briefs/v5-1-e2e-kit.md`, narrowed by scope note: spec files under
`src/tests/e2e/**` belong to lane v5-7 and are left byte-identical. This lane touched only
`packages/e2e-kit/**`, each app's `src/tests/infra/**` (incl. `e2e-world.ts`), and app
`package.json`/`tsconfig*.json`/e2e jest config where needed to consume the kit. No product
code, no `app.module.ts`, no other app touched.

## What moved to the kit

| Kit module | Exports | Replaces |
|---|---|---|
| `src/platform/free-ports.ts` | `freePorts(count)` | inline copy in todo `e2e-stack.service.ts`; `freePorts` in ecommerce `e2e-util.ts` |
| `src/platform/readiness.ts` | `retryUntil(label, deadlineMs, probe, intervalMs?)` → `ReadinessResult`, `ReadinessResult`, `sleep` | todo's inline `retryUntil`/`sleep`; ecommerce `e2e-util.ts` `retryUntil`/`ReadinessResult`/`sleep` |
| `src/platform/run-tokens.ts` | `runToken`, `secret`, `specHash` | todo's inline `secret` + inline sha256 project-name hash (now `specHash`); ecommerce `e2e-util.ts` `runToken`/`secret`/`specHash` |
| `src/platform/poll.ts` | `pollUntil`, `holdFor` | todo `src/tests/infra/e2e-poll.ts` implementations |
| `src/integrations/http/e2e-http-client.ts` | `createE2EHttpClient({baseUrl, bearerToken?, timeoutMs?})` → `E2EHttpClient` (`get/delete/post/put/patch/postForm/graphql`, `baseUrl`); `E2EResponse` (`status, body, data, durationMs, headers`); `E2EHttpRequestOptions` | todo `E2EHttpClient` class + `E2EResponse` + `envelopeOf`; ecommerce `E2EHttpService.client()` axios wiring + `E2EResponse` |
| `src/integrations/graphql/graphql-envelope.ts` | `GraphqlObserved`, `GraphqlErrorObserved`, `GraphqlCallOptions`, `graphqlEnvelopeOf` | identical envelopes in both apps' http/graphql services |
| `src/integrations/graphql/e2e-graphql-transport.ts` | `createE2EGraphqlTransport({documents?})` → `E2EGraphqlTransport` (`apollo(baseUrl, token?)`, `client(baseUrl, {bearerToken?})`, `call(baseUrl, kind, document, options?)`); `E2EGraphqlClient`, `E2EGraphqlClientOptions` | Apollo client cache + `toDocumentNode` + `formattedErrorsOf` + `stripTypename` duplicated in both apps' graphql services |
| `src/world/boot-e2e-module.ts` | `bootE2EModule(host, imported)`; structural `E2ETestingHost`/`E2EModuleBuilder`/`E2EModuleHandle`/`E2ETestingModuleMetadata` | `Test.createTestingModule({imports}).compile()` + `init()` inlined in both `e2e-world.ts` |

Kit is framework-free by design: `bootE2EModule` takes the app's own `Test` facade and returns
the app's own `TestingModule` type (generic `M`), so no `@nestjs/*` copy lands in the kit and no
cross-`node_modules` class-identity issues arise (`ApolloClient`/`TestingModule` carry private
fields). Kit deps: `axios`, `@apollo/client`, `graphql` — same versions as both apps pin.

## What stayed app-side

- Stack topology: compose project naming (`todo-e2e-<specHash>` / `ec-e2e-<specHash>-<runToken>`),
  compose env expansion, api child-process spawning, `ensureApiBuild`/`ensureBuilt` freshness
  checks, teardown observation (`E2ETeardownReport` / `E2ECleanupReport`), `currentSpecPath`,
  `sh`, `httpStatus`, `newestSourceMtimeMs` (todo); `serviceIdentities`, `psql`, `schemaSnapshot`,
  `endpoint()` (ecommerce).
- `GRAPHQL_DOCUMENTS` + `GraphqlDocumentName` registries — each app owns its document map; the
  kit transport only resolves keys through it.
- Nest wrappers: `E2EHttpService`/`E2EGraphqlService` stay `@Injectable()` per app, binding kit
  factories to that app's stack service (todo: one `stack.baseUrl`; ecommerce: `stack.endpoint(service)`).
- `E2EWorld`/`bootE2EWorld`/`bootE2eWorld` world assembly, `TestingInfraModule`, db/auth services.
- Resilience docker-observation helpers (`e2e-infra-contract.ts` in both lanes) — deliberately
  infra-independent per their own contract note, left untouched.

## Spec-lane compatibility (v5-7 boundary)

Spec files under `src/tests/e2e/**` are untouched. Their existing import specifiers keep
resolving through compat surfaces inside this lane's scope:

- `todo: src/tests/infra/e2e-poll.ts` — re-exports `holdFor`/`pollUntil` from
  `@e2e-kit/platform/poll`.
- `ecommerce: src/tests/infra/platform/stack/e2e-util.ts` — re-exports `freePorts`,
  `retryUntil`/`sleep`/`ReadinessResult`, `runToken`/`secret`/`specHash` from the kit platform
  modules.
- `todo: e2e-http.service.ts` — re-exports `E2EHttpClient`, `E2EResponse`, `GraphqlObserved`,
  `GraphqlCallOptions` types from the kit, plus the legacy `E2EGraphqlResponse`/
  `E2EGraphqlResult` aliases (now aliases of the kit's `GraphqlObserved`).
- `ecommerce: e2e-http.service.ts` — re-exports `E2EHttpClient`, `E2EResponse`;
  `e2e-graphql.service.ts` — re-exports `E2EGraphqlClient`, `E2EGraphqlClientOptions`,
  `GraphqlObserved`, `GraphqlCallOptions`, `GraphqlErrorObserved`.

These shims are the migration seam: v5-7 can repoint spec imports at the `@e2e-kit/*` deep
paths and delete the shims once no specifier depends on them.

## Consumer rewiring (infra only)

### todo-app-backend
- `e2e-stack.service.ts`: dropped `node:crypto`/`node:net` imports and the four inlined helpers;
  project name now `todo-e2e-${specHash(specId)}` (deterministic-per-spec semantics preserved).
- `e2e-http.service.ts`: `E2EHttpClient` class and `envelopeOf` deleted; service delegates to
  `createE2EHttpClient` (15s timeout preserved).
- `e2e-graphql.service.ts`: delegates to `createE2EGraphqlTransport({documents})`; `anonymous()`/
  `forUser()` return `ReturnType<E2EGraphqlTransport["apollo"]>` (kit's ApolloClient type, kept
  honest instead of aliasing the app's copy).
- `e2e-auth.service.ts`: `new E2EHttpClient(...)` → `createE2EHttpClient({...})`; admin users GET
  moved to `{params: {...}}` options shape.
- `e2e-world.ts`: `bootE2EModule(Test, TestingInfraModule.register(...))`.
- Config: `tsconfig.json` paths `+ "@e2e-kit/*": ["../../packages/e2e-kit/src/*"]`;
  `tsconfig.build.json` exclude `+ "src/tests"` (required — kit sources live outside the app
  root and would otherwise shift the emitted `dist/main.js` layout); e2e `jest.config.ts`
  moduleNameMapper `+ "^@e2e-kit/(.*)$"`; `package.json` `+ "file:../../packages/e2e-kit"` dep.

### ecommerce-app-be
- `e2e-stack.service.ts`: imports the same six primitives from `@e2e-kit/platform/*`.
- `e2e-http.service.ts`: axios wiring deleted; `client(service, options)` → `createE2EHttpClient`
  bound to `stack.endpoint(service).baseUrl` (no timeout — original had none; kit default `0`
  preserves that).
- `e2e-graphql.service.ts`: `client(service, options)` → `transport.client(endpoint.baseUrl, options)`;
  duplicated envelope/parse/stripTypename machinery deleted.
- `e2e-world.ts`: `bootE2EModule(Test, ...)`.
- Config: same tsconfig/tsconfig.build/jest.config.js/package.json wiring as todo.

## Gate results

| Gate | Command | Result |
|---|---|---|
| kit lint | `npx eslint "src/**/*.ts"` (in `packages/e2e-kit`) | 0 errors |
| kit typecheck | `npx tsc --noEmit` | clean |
| todo lint | `npx eslint src` | 0 errors |
| todo typecheck | `npx tsc --noEmit` | clean |
| todo unit | `npx jest` | 117 suites / 701 tests, all pass |
| todo e2e | `npx jest --config src/tests/e2e/jest.config.ts` — teardown-verification + infra-recovery + task-lifecycle | 3/3 pass |
| todo e2e (compat-path proof, post-scope-narrow) | same config — `recurrence-lifecycle` (exercises `e2e-poll` shim + `E2EGraphqlResponse`/`E2EHttpClient` re-exports) | 1/1 pass |
| ec-be lint | `npx eslint "src/**/*.ts" "apps/**/*.ts"` | 0 errors |
| ec-be typecheck | `npx tsc --noEmit` | clean |
| ec-be unit | `npx jest` | 39 suites / 209 tests, all pass |
| ec-be e2e | `npx jest --config src/tests/e2e/jest.config.js` — teardown-verification + infra-recovery + sign-up-sign-in | 3/3 pass |
| ec-be e2e (compat-path proof, post-scope-narrow) | same config — `cross-service-identity` (exercises `e2e-util` shim + lifecycle.helpers) | 2/2 pass |

Notes:

- An earlier parallel run of both unit suites produced worker SIGTERMs (resource contention);
  run sequentially each suite is fully green — not a code defect.
- Full e2e suites not run end-to-end (time); the resilience + journey specs exercised every
  rewired path: kit stack primitives (boot), kit http/graphql clients, kit world boot, and the
  compat re-export shims the untouched spec lane resolves through.
- `package-lock.json` updated in both apps by the `file:` dep; kit lockfile synced after the
  `@nestjs/*` deps were dropped from the kit (framework-free design).

## Kit API surface (consumption pattern)

```ts
import { freePorts } from "@e2e-kit/platform/free-ports"
import { ReadinessResult, retryUntil } from "@e2e-kit/platform/readiness"
import { runToken, secret, specHash } from "@e2e-kit/platform/run-tokens"
import { holdFor, pollUntil } from "@e2e-kit/platform/poll"
import { createE2EHttpClient, E2EHttpClient, E2EResponse } from "@e2e-kit/integrations/http/e2e-http-client"
import { GraphqlCallOptions, GraphqlErrorObserved, GraphqlObserved, graphqlEnvelopeOf } from "@e2e-kit/integrations/graphql/graphql-envelope"
import { createE2EGraphqlTransport, E2EGraphqlClient, E2EGraphqlClientOptions, E2EGraphqlTransport } from "@e2e-kit/integrations/graphql/e2e-graphql-transport"
import { bootE2EModule } from "@e2e-kit/world/boot-e2e-module"
```

No barrels; every consumer deep-imports the file it needs. Assertions, rules and semantics are
unchanged from the pre-extraction implementations.
