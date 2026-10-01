# Testing the ecommerce-app back end

Only services are unit tested. Every business rule lives in a `*.service.ts` file, and each service has exactly one colocated
`<name>.service.spec.ts`. Handlers, resolvers, controllers, mappers, guards and modules have no unit spec: a handler maps
its input and calls one method of one service, a resolver or controller dispatches one bus message, so nothing is left in
them to test. The apps only compose; the e2e world proves they boot.

| Check      | Command             |
| ---------- | ------------------- |
| Types      | `npm run typecheck` |
| Lint       | `npm run lint`      |
| Build      | `npm run build`     |
| Unit suite | `npm test`          |
| E2E suite  | `npm run test:e2e`  |

## Unit suite

`npm test` is `jest --selectProjects unit --coverage`. Coverage is collected from `src/**/*.service.ts` only and every file
must reach 100 percent lines, branches, functions and statements; jest exits non-zero below that. The run writes
`be/coverage/lcov.info`; Sonar and Codecov import it with the services as the only coverage scope and hold each at 100.

A service spec builds its subject from a testing module that provides exactly the constructor dependencies and nothing else:

```ts
const moduleRef = await Test.createTestingModule({
    providers: [OrderService, { provide: ORDER_ENTITY_MANAGER, useValue: em }, { provide: CART_SERVICE, useValue: cart }, ...],
}).compile()
const orders = moduleRef.get(OrderService)
```

No `new` of the service, no `imports`, no `overrideProvider`, no `jest.mock`, no casts, no ambient clock or `process.env`.
Doubles come from the root of `@starci/jest-preset`:

| Dependency                                                                   | Double                                                                                                                                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named EntityManager (`ORDER_ENTITY_MANAGER`, `IDENTITY_ENTITY_MANAGER`)      | `mockEntityManager({ method: [Entity, result] })`: any method the spec did not stub throws, so a missing stub proves the service made no such database call |
| Transaction                                                                  | `fakeTransaction(em)`: commit, rollback and the writes that were committed or discarded                                                                     |
| Clock (`CLOCK`)                                                              | `FakeClock`                                                                                                                                                 |
| Cache (`CACHE`)                                                              | `fakeCache(clock)`: JSON round trip, TTL from the clock                                                                                                     |
| Options tokens (`*_OPTIONS`)                                                 | real values from a `builder`                                                                                                                                |
| Other capability services (`CART_SERVICE`, `SESSION_SERVICE`, ...) and ports | `mock<T>()`                                                                                                                                                 |
| Logger, streams, probes                                                      | `mock<T>()`                                                                                                                                                 |

Assertions check results (`toBeRefused`, `toSucceedWith`, returned values, thrown domain error codes) and state (what was
written: `expect(em.save).toHaveBeenCalledWith(...)`, commits and rollbacks). Test names are English and start with a verb.
Pure helpers such as the checkout policy and the row mappers have no spec: their branches are covered through the service specs.

The canonical example in this tree is `OrderService.placeOrder` (`src/modules/domain/order/order.service.spec.ts`): a refusal
that never touches the database, a replayed key that returns the first order and writes nothing, and the place path with the
exact fields written inside one committed transaction; `PaymentService.capture` stamps the capture time from the clock.

### Test data builders

Builders live in `src/tests/fixtures/builders/<area>.builder.ts`. Pure builders (`productEntity`, `orderEntity`,
`placedOrder`, ...) return typed objects with valid, deterministic defaults; a spec overrides only what matters, and uses
them as inputs and as `mockEntityManager` results. Persisting builders (`productBuilder(world.db.order).build(overrides)`)
insert real rows for the integration and e2e specs, with the database constraints on. Builders never assert.

## Integration and e2e

Everything else lives under `src/tests/`:

- `src/tests/world/` is the only test infrastructure, declared once for `@starci/test-world` in `test-world.config.ts`
  (`export const { useTestWorld, useSandbox } = defineTestWorld({...})`); `global-setup.ts` and `global-teardown.ts`
  re-export the library's hooks. The library runs the services `.starcistacks/dev` declares, real and behind toxiproxy:
  Postgres with one database per connection (identity, order) and the Redis of the cache. It runs the real `apps/migrate`
  bootstrap once and applies the dev seeds; `use-test-world.ts` re-exports `useTestWorld({ apps } | { modules })`, which
  boots the real identity and order apps in the spec process, wired to each other over real GraphQL, and returns
  `world.apps.<name>.api`, `world.db.<connection>` (the shared EntityManager), `world.infra.redis` (the real Redis:
  `size()`, `cut()`, `restore()`), `world.infra.postgresql.connection(name)` (one database down while the other serves)
  and `world.waitFor`. Nothing is overridden in the DI container and nothing of the stack is faked; this app calls no
  external provider, so it has no network fakes and no contract specs.
- `src/tests/fixtures/` holds the builders, the response shapes and the SQL constants of out-of-band reads.
- `src/tests/integration/<area>/*.integration-spec.ts` run real capability modules over the world database.
- `src/tests/e2e/<area>/*.e2e-spec.ts` are flow specs: they call the public GraphQL doors and assert persisted state
  through `world.db`. Narrow a run with jest arguments, for example `npm run test:e2e -- checkout/checkout-journey`.

E2E needs a container runtime and runs by hand or in the manual e2e workflow; husky, `typecheck`, `lint` and the
automatic CI never run it.

The dev stack and process instructions are in `.starcistacks/dev/README.md`.
