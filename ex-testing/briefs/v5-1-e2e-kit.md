# Lane v5-1 — extract shared E2E kit → `packages/e2e-kit`, rewire both BE apps

SCOPE (exclusive): `packages/e2e-kit/**` (new), `examples/todo-app-backend/src/tests/**`, `examples/ecommerce-app-be/src/tests/**`, plus each app's `package.json`/`tsconfig*.json`/`jest` config ONLY where needed to consume the kit. Do not touch `src/` product code, `app.module.ts`, or any other app.

## Context

Both backend examples carry near-identical E2E infra under `src/tests/infra/` (module tree: `platform/stack`, `platform/databases`, `integrations/http`, `integrations/graphql`, `bussiness/accounts`, `testing-infra.module.ts`). The SERVICES are app-specific (stack topology, auth domain, dataSources) and must stay. The GENERIC primitives are duplicated and must move to a shared package:

- `freePorts`, `retryUntil`/`ReadinessResult`, `sleep`, `runToken`, `secret`, `specHash` (ec-be: `src/tests/infra/platform/stack/e2e-util.ts`; todo-be: `e2e-poll.ts` + whatever its stack service inlines)
- The axios E2E client shape: `E2EResponse<T> {status, body, data, durationMs}` + `axios.create({validateStatus: () => true, ...})` factory (both apps' `e2e-http.service.ts` — keep the Nest `@Injectable()` wrapper in-app, extract the raw factory)
- The Apollo/GraphQL client factory used by `e2e-graphql.service.ts` (both apps now have one — v4-2 just landed ec-be's)
- The TestingModule bootstrap helper (`bootE2EWorld`/`e2e-world.ts` shape: `Test.createTestingModule({imports:[TestingInfraModule.register({...})]}).compile()` + `moduleRef.init()` + world object) — extract the generic boot wrapper, keep app-specific world assembly in-app.

## Tasks

1. Create `packages/e2e-kit/` as a small TS package (`@starci-examples/e2e-kit`): `package.json` (name, private, type module or cjs matching consumers — check how each app's jest resolves it; simplest is a `file:` dep + tsconfig path alias so no build step is needed: `"@starci-examples/e2e-kit": "file:../../packages/e2e-kit"` + `paths: {"@e2e-kit/*": ["../../packages/e2e-kit/src/*"]}`), `src/` with one module per concern mirroring the infra layering (`platform/`, `integrations/http/`, `integrations/graphql/`, `world/`), `tsconfig.json`, jest-friendly plain TS (no build step — consumers compile via their own ts-jest/next pipelines; add `tsconfig` `include` coverage in each app if needed).
2. Move the duplicated primitives into the kit with proper JSDoc (canon requires export JSDoc). Keep the exact semantics — e.g. `ensureApiBuild`/`ensureBuilt` dist-freshness logic stays app-side in each stack service (it's app-specific: different entry points), but shared wait/probe helpers move.
3. Rewire BOTH apps' infra services to import the kit (`@e2e-kit/...`), deleting the duplicated implementations. App services keep their Nest module/provider shape and app-specific logic.
4. Verify per app: `npx eslint src` → 0 errors (canon stays error — kit code must also lint clean; if the kit lives outside the app's eslint globs, extend globs or add the package's own eslint config reusing `@starci/eslint-canon-be`); `npx tsc --noEmit` → clean; `npx jest` → all green; `npx jest --config src/tests/e2e/jest.config.ts` → run at least the previously-failing resilience + one journey spec per app to prove the rewiring (full suite if time allows).
5. Report to `D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/v5-1-REPORT.md`: what moved, API surface of the kit, gate results per app.

## Rules

- Do not weaken assertions, do not disable rules, no `any` unless the kit's public envelope genuinely needs `unknown`+generics.
- English only. Canon style: deep imports, no barrels (export from explicit file paths, no `index.ts` re-export folders), exceptions carry object args.
- `src/tests/**` is the ONLY part of each app you may edit besides manifests/tsconfig/jest config.
