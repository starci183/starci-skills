# Testing ecommerce-app-be

The unit suite runs in process. It covers capability services, HTTP and GraphQL adapters, and
both application composition roots. It does not start the dev stack.

| Check | Command |
| --- | --- |
| Types | `npm run typecheck` |
| Lint | `npm run lint:check` |
| Build | `npm run build` |
| Unit suite | `npm test` |
| Coverage | `npm run test:coverage` |

The root `jest.config.js` declares exactly two projects. The `unit` project selects `*.spec.ts` under `apps/` and `src/`. `tsconfig.json` and Jest resolve the root package's feature and module
public entries; the compiled application workspaces resolve their exports from `dist/`.

The `e2e` project selects `*.e2e-spec.ts` under `src/tests/e2e/` and runs with `npm run test:e2e`
(`jest --selectProjects e2e --runInBand`; environment code in `src/tests/e2e/setup/`, data in
`src/tests/fixtures/`). Narrow a run with jest arguments, for example
`npm run test:e2e -- checkout/checkout-journey` or `npm run test:e2e -- -t "payment"`. Those specs start run-owned Postgres and Redis resources and
both Nest processes, call the public GraphQL doors (and the /health probes), then clean up.
They require an available container runtime and are not part of `test:unit`.

E2E runs MANUALLY only (owner ruling 2026-09-29): husky, `typecheck`, `lint`/`lint:check`, coverage (`test:coverage`, Codecov, Sonar) and automatic CI never touch `src/tests/e2e/**`. `npm run typecheck:e2e` (`src/tests/e2e/tsconfig.json`), `npm run lint:e2e` and `npm run test:e2e` are run by hand when asked; any e2e CI job is `workflow_dispatch` only.

The dev stack and process instructions are in `.starcistacks/dev/README.md`.