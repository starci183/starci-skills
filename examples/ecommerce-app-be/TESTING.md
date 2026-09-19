# Testing

Two suites, kept apart on purpose:

| Suite | Command | What it is |
|---|---|---|
| Unit | `npm test` | In-process `TestingModule` specs (`*.spec.ts`) covering the shared `src/modules` + `src/features` tree and the `apps/{identity,order}` wiring specs under `src/tests/{identity,order}/`. Fakes at provider boundaries - no docker, no network. |
| E2E | `npm run test:e2e` | `*.e2e-spec.ts` journeys under `src/tests/e2e/`. Each spec boots its own run-owned docker compose stack (postgres + redis) plus both api child processes (identity, order) through `TestingInfraModule`, drives the public REST doors over HTTP, then tears the stack down and verifies cleanup. |

Layout reminder: this is a monorepo product. Deployables live in `apps/identity` and `apps/order`; the shared capability tree (`src/modules/{platform,integrations,bussiness}`, `src/features/checkout`) is what both apps wire.

## Unit tests

```bash
npm test                          # whole unit suite (jest.config.js)
npx jest src/modules/bussiness/cart   # one directory
npx jest -t "refuses"                 # one test name
```

- Config: `jest.config.js` (`roots: [apps, src]`, ts-jest, `testRegex: .*\.spec\.ts$`).
- Convention: `Test.createTestingModule({ providers: [X, { provide: Dep, useValue: mock }] })`, `moduleRef.get(X)` - never `new X(deps)`. Mock at provider boundaries (repositories, clients, config, redis). See any existing spec for style.
- `*.e2e-spec.ts` does not match the unit `testRegex`, so e2e files never run here. The `src/tests/{identity,order}/*.spec.ts` boot/wiring specs DO run in this suite.

## Coverage

```bash
npm run test:coverage    # jest --coverage -> coverage/lcov.info (+ text summary)
```

`collectCoverageFrom` covers `src/**/*.ts` and `apps/**/*.ts` minus specs, e2e specs, `main.ts` files and `src/tests/**`. The lcov artifact is what codecov consumes (flag `ecommerce-be`).

## E2E tests

Requires a running Docker daemon (`docker info` must succeed). First run pulls `postgres:16` and `redis:7` if not cached.

```bash
npm run test:e2e                                        # whole e2e suite, serial (maxWorkers: 1)
npx jest --config src/tests/e2e/jest.config.js identity/sign-up-sign-in   # one spec by path fragment
```

- Config: `src/tests/e2e/jest.config.js` (roots `src/tests/e2e`, `testMatch: **/*.e2e-spec.ts`, 120s test timeout). The config file itself is CommonJS `.js` on purpose - this repo does not depend on ts-node, which jest would need to load a `.ts` config.
- Each spec gets an isolated stack: compose project name = hash of the spec path, every host port allocated at run time on `127.0.0.1`, per-run generated secrets. A concurrent dev stack is never touched.
- The spec-owned stack starts postgres + redis (`src/tests/infra/platform/stack/compose.e2e.yaml`) then spawns the identity and order api processes against those run-scoped ports.
- Teardown is part of the contract: module shutdown runs `compose down -v` for that project and reports leftover containers/volumes (`E2ECleanupReport`). Closing the module (`afterAll(() => moduleRef.close())`) is what triggers it.

## Writing an e2e spec

```ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  E2EAuthService, E2EHttpService, TestingInfraModule, TestContext,
} from '../../infra';

describe('area/flow - one A->Z journey', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TestingInfraModule.register({ context: TestContext.E2E })],
    }).compile();
  });

  afterAll(() => moduleRef.close());

  it('runs the journey end to end', async () => {
    // one it = one complete business journey through public doors
  });
});
```

- Import from the `../../infra` barrel (`src/tests/infra/index.ts`), never deep paths.
- Available services: `E2EStackService` (endpoints/ports/cleanup report), `E2EHttpService` (axios clients per service/user, bearer option), `E2EAuthService` (register/signIn/session helpers via public doors), `E2EDbService` (out-of-band seed/verify only - never shortcut the flow under test). ec is REST-only: there is deliberately no GraphQL service.

## Lint & typecheck

```bash
npm run lint        # eslint "src/**/*.ts" "apps/**/*.ts" (flat config, typescript-eslint)
npm run lint:fix    # same with --fix
npm run typecheck   # tsc --noEmit over the whole tree, tests included
```
