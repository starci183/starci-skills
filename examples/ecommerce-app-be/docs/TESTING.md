# Testing ecommerce-app-be

The unit suite runs in process. It covers capability services, HTTP and GraphQL adapters, and
both application composition roots. It does not start the dev stack.

| Check | Command |
| --- | --- |
| Types | `npm run typecheck` |
| Lint | `npm run lint:check` |
| Build | `npm run build` |
| Unit suite | `npm run test:unit` |
| Coverage | `npm run test:coverage` |

The root `jest.config.js` declares exactly two projects. The `unit` project selects `*.spec.ts` under `apps/` and `src/`. The full unit suite currently has
39 suites and 209 tests. `tsconfig.json` and Jest resolve the root package's feature and module
public entries; the compiled application workspaces resolve their exports from `dist/`.

The `e2e` project selects `*.e2e-spec.ts` under `src/tests/e2e/` and runs with `npm run test:e2e`
(`jest --selectProjects e2e --runInBand`; environment code in `src/tests/e2e/setup/`, data in
`src/tests/fixtures/`). Narrow a run with jest arguments, for example
`npm run test:e2e -- checkout/checkout-journey` or `npm run test:e2e -- -t "payment"`. Those specs start run-owned Postgres and Redis resources and
both Nest processes, call the public GraphQL doors and internal HTTP contracts, then clean up.
They require an available container runtime and are not part of `test:unit`.

`node scripts/live-proof.mjs` exercises a live checkout across the identity and order services.
The dev stack and process instructions are in `.starcistacks/dev/README.md`.