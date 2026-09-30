# Testing ecommerce-app-be

The unit suite runs in process. It covers capability services, GraphQL adapters, guards and both application
composition roots. It does not start any infrastructure.

| Check      | Command              |
| ---------- | -------------------- |
| Types      | `npm run typecheck`  |
| Lint       | `npm run lint:check` |
| Build      | `npm run build`      |
| Unit suite | `npm test`           |
| E2E suite  | `npm run test:e2e`   |

Unit specs sit beside their subject as `<name>.spec.ts`. Everything else lives under `src/tests/`:

- `src/tests/world/` is the only test infrastructure. `global-setup.ts` runs the repository's own stack (`.starcistacks/dev`)
  for real through `hfs test-stack` (Postgres and Redis, each behind toxiproxy; images come from the stack at run time),
  creates one database per connection (identity, order) and a Redis database for the run, runs the real `apps/migrate`
  bootstrap once and applies the dev seeds; `use-test-world.ts` exports
  `useTestWorld({ apps })`, which boots the real identity and order apps in the spec process, wired to each other over
  real GraphQL, and returns `world.apps.<name>.api`, `world.db.<connection>` (the shared EntityManager),
  `world.infra.<service>` (`latency(ms)`, `cut()`, `restore()` on the real Postgres or Redis), `world.cache.size()` and
  `world.waitFor`. This product calls no external SaaS, so there is no `world.fake`. Nothing is overridden in the DI container.
- `src/tests/fixtures/` holds typed doubles, the response shapes and the SQL constants of out-of-band reads.
- `src/tests/e2e/<area>/*.e2e-spec.ts` are flow specs: they call the public GraphQL doors and assert persisted state
  through `world.db`. Narrow a run with jest arguments, for example `npm run test:e2e -- checkout/checkout-journey`.

`npm run test:stack -- up` starts the stack once and keeps it warm (project `ecommerce-app-be-test-stack`); the world attaches
to it when it answers, otherwise starts and stops its own; `npm run test:stack -- down` removes the warm stack.

E2E needs a container runtime and runs by hand or in the manual e2e workflow; husky, `typecheck`, `lint` and the
automatic CI never run it.

The dev stack and process instructions are in `.starcistacks/dev/README.md`.
