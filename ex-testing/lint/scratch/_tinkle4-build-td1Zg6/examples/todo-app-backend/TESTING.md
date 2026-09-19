# Testing

Two suites, kept apart on purpose:

| Suite | Command | What it is |
|---|---|---|
| Unit | `npm test` | In-process `TestingModule` specs, colocated `*.spec.ts` beside the source they cover. Fakes at provider boundaries - no docker, no network. |
| E2E | `npm run test:e2e` | `*.e2e-spec.ts` journeys under `src/tests/e2e/`. Each spec boots its own run-owned docker compose stack (postgres + keycloak + redis) plus the api child process through `TestingInfraModule`, drives the public doors over HTTP/GraphQL, then tears the stack down and verifies cleanup. |

## Unit tests

```bash
npm test                    # whole unit suite (jest.config.js)
npx jest src/modules/bussiness/task   # one directory
npx jest -t "refuses"                 # one test name
```

- Config: `jest.config.js` (`rootDir: src`, ts-jest, `testRegex: .*\.spec\.ts$`, `@modules/*` / `@features/*` path aliases).
- Convention: `Test.createTestingModule({ providers: [X, { provide: Dep, useValue: mock }] })`, `module.get(X)` - never `new X(deps)`. Mock at provider boundaries (repositories, clients, event emitters, config). See any existing spec for style.
- `*.e2e-spec.ts` does not match the unit `testRegex`, so e2e files never run here.

## Coverage

```bash
npm run test:coverage       # jest --coverage -> coverage/lcov.info (+ text summary)
```

`collectCoverageFrom` covers all `src/**/*.ts` except specs and `main.ts`. The lcov artifact is what codecov consumes (flag `todo-be`).

## E2E tests

Requires a running Docker daemon (`docker info` must succeed). First run pulls `postgres:16`, `quay.io/keycloak/keycloak:26.0`, `redis:7` if not cached.

```bash
npm run test:e2e                            # whole e2e suite, serial (maxWorkers: 1)
npx jest --config src/tests/e2e/jest.config.ts auth/sign-in   # one spec by path fragment
```

- Config: `src/tests/e2e/jest.config.ts` (roots `src/tests/e2e`, `testMatch: **/*.e2e-spec.ts`, 120s test timeout).
- Each spec gets an isolated stack: compose project name = hash of the spec path, every host port allocated at run time on `127.0.0.1`, per-run generated secrets. A concurrent dev stack is never touched.
- Stack assets: `src/tests/infra/platform/stack/compose.e2e.yaml` mounts the dev stack's seed scripts and keycloak realm import read-only, so the e2e schema and demo identities match dev bytes-for-bytes.
- Teardown is part of the contract: `onApplicationShutdown` runs `compose down -v` for that project only and reports leftover containers/volumes (`E2ETeardownReport`). Closing the module (`afterAll(() => moduleRef.close())`) is what triggers it.

## Writing an e2e spec

```ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  E2EAuthService, E2EGraphqlService, TestingInfraModule, TestContext,
} from '../../infra';

describe('area/flow - one A->Z journey', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TestingInfraModule.register({ context: TestContext.E2E, specId: 'area/flow' })],
    }).compile();
  });

  afterAll(() => moduleRef.close());

  it('runs the journey end to end', async () => {
    // one it = one complete business journey through public doors
  });
});
```

- Import from the `../../infra` barrel (`src/tests/infra/index.ts`), never deep paths.
- Available services: `E2EStackService` (ports/urls/teardown report), `E2EHttpService` (axios clients per user, bearer option), `E2EGraphqlService` (ApolloClient per user - the app's public surface is GraphQL), `E2EAuthService` (register/signIn/revoke/deleteAccount via public doors), `E2EDbService` (out-of-band seed/verify only - never shortcut the flow under test).

## Lint & typecheck

```bash
npm run lint       # eslint "src/**/*.ts" (flat config, typescript-eslint type-checked rules)
npm run lint:fix   # same with --fix
npx tsc --noEmit   # strict typecheck over the whole src tree, tests included
```
