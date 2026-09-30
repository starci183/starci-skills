# Testing

One root `jest.config.js` (managed: `require("@starci/jest-preset").starciJestConfig()`) with four projects:

| Project | Command | What it is |
|---|---|---|
| unit | `npm test` | In-process specs of the `*.service.ts` files only, `<name>.service.spec.ts` beside the service, built with `Test.createTestingModule`. Doubles come from `@starci/jest-preset`: no docker, no network. Runs with per-file 100 percent coverage. |
| e2e | `npm run test:e2e` | `src/tests/e2e/<area>/*.e2e-spec.ts`: A->Z journeys through the public doors of the real apps, `useTestWorld({ apps })`. |
| contract | `npm run test:contract` | `src/tests/contract/<provider>/*.contract-spec.ts`: our client against the provider's real sandbox; skips itself without sandbox config. Never part of `test` or `test:e2e`. |

`src/tests/world/` is the only test infrastructure. The integration, e2e and contract projects share its jest
`global-setup.ts` / `global-teardown.ts` (one Postgres container per run, `apps/migrate`'s exported `bootstrap` once, the
network-edge fakes of every third party under `src/tests/world/fakes/<provider>/`) and run one worker. `use-test-world.ts`
exports `useTestWorld(...)` -> `world.apps.<name>.api`, `world.db.<connection>` (the shared EntityManager) and
`world.fake.<provider>`. Nothing under `src/tests/` overrides a provider; shared test data lives in `src/tests/fixtures/`.

## Unit tests

```bash
npm test                              # whole unit suite with coverage (jest --selectProjects unit --coverage)
npx jest src/modules/domain/task      # one directory
npx jest -t "refuses"                 # one test name
```

The unit standard has eight rules:

1. Only `*.service.ts` files are unit-tested, each by exactly one colocated `<name>.service.spec.ts`. Handlers, resolvers,
   controllers, consumers, jobs, mappers, entities, guards, policies, clients and modules have no unit spec; the apps are
   proven by the e2e world.
2. The subject is built with `Test.createTestingModule({ providers: [Service, { provide: TOKEN, useValue: double }] }).compile()` and
   `moduleRef.get(Service)`: never `new Service(...)`, no `imports`, no `overrideProvider`.
3. The providers are exactly the constructor dependencies. Every `Inject*()` decorator is `injector<T>(TOKEN)` over an exported plain
   identifier (`PRIMARY_ENTITY_MANAGER`, `CLOCK`, `OUTBOX`, `LOGGER`, `<CAP>_OPTIONS`, ...), so a spec can provide it.
4. Doubles come only from the package root of `@starci/jest-preset`: `mockEntityManager`, `fakeTransaction`, `fakeCache`, `fakeLock`,
   `recordingOutbox`, `FakeClock`, `fakeIds`, `mock<T>()`, `builder`, and the matchers `toBeRefused` and `toSucceedWith`. No casts, no
   `Date.now()`, no `jest.mock`, no `process.env`.
5. `collectCoverageFrom` is `src/**/*.service.ts` only and every file must reach 100 percent lines, branches, functions and statements.
6. Sonar does not depend on coverage; CI uploads no coverage.
7. Doors are thin: a handler calls exactly one method of one injected service and returns its result; a resolver, controller, consumer or
   job dispatches exactly one bus message. Everything that decides lives in a service.
8. Pure helpers and decide functions have no spec of their own; a service spec covers them.

Test data comes from the pure builders in `src/tests/fixtures/builders/<area>.builder.ts` (typed defaults, fixed ids and dates, no
assertions). A `mockEntityManager` answers only what a spec stubs, so an unstubbed call throws and proves the service made no extra
database call. Example: `src/modules/domain/commission/commission.service.spec.ts`.

## Coverage

`npm test` runs `jest --selectProjects unit --coverage`. Coverage is collected from `src/**/*.service.ts` and each file has a
threshold of 100 for lines, branches, functions and statements, so the run fails below it. There is no lcov upload and no codecov
flag: Sonar imports issues only.

## Integration, e2e and contract tests

They run by hand, never in a hook or the default CI job. Each script type-checks the test tree first
(`npm run typecheck:tests`, `src/tests/tsconfig.json`). Integration and e2e need a running Docker daemon (`docker info`).

```bash
npm run test:e2e                                 # every journey, one worker
npm run test:e2e -- flows/task-lifecycle         # one spec by path fragment
npm run test:contract                            # provider sandboxes (skipped without sandbox config)
```

- The world is started once per run: every host port is allocated by the OS on `127.0.0.1`, every secret is generated per
  run, and the teardown removes the container, the upload directory and the state file, then verifies nothing survived.
- A spec never creates schema, starts a container or writes `process.env`: that is the world's job.

## Writing an e2e spec

```ts
import { useTestWorld } from "@tests/world/use-test-world"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

describe("area flow (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true } } })

    it("runs the journey end to end", async () => {
        const person = await world.signedInPerson("flow")
        // one it = one complete business journey through public doors; persisted state is read through world.db.primary
    })
})
```


## Observability

The api exposes two anonymous probe doors plus per-request structured logging:

- `GET /health` - dependency-checked health: 200 `{ "status": "ok" }` while primary Postgres answers, 503 when it cannot. The test world's readiness probe waits on this door.
- `GET /metrics` - Prometheus text exposition: `http_requests_total{method,route,status}` counters and `http_request_duration_ms_{sum,count}` summaries. Route labels are the matched route template (`/uploads/:uploadId/content`), never concrete ids; unmatched paths collapse to `route="unmatched"`.
- Every response echoes `x-request-id` - the inbound value when sent, a minted uuid otherwise. Each finished request writes one structured `http.request.completed` line (requestId, method, route, status, durationMs; never headers, body or query, so no secret can ride it).

```bash
curl -s localhost:3001/metrics | findstr http_requests_total   # or: grep http_requests_total
curl -si -H "x-request-id: demo-1" localhost:3001/health | findstr x-request-id
```

In the dev stack, Prometheus (`.starcistacks/dev/infra/compose/prometheus.yaml`) is already configured to scrape `api:3001` every 15s. It reaches the api when the api runs under the `app` compose profile (`docker compose --profile app up`); when the api runs on the host (`npm run start`), query `localhost:3001/metrics` directly or point a scrape target at `host.docker.internal:3001`. The Prometheus UI is at `http://localhost:9090` - query `http_requests_total` to see the counters.

The e2e suite covers these doors over the real stack:

```bash
npm run test:e2e -- flows/probes
```

## Uploads

Task attachments live behind the upload capability (`src/modules/integrations/upload`): presigned intents (`GraphQL createUploadIntent` -> `PUT /uploads/<id>/content` with `x-upload-token`), a direct `POST /uploads`, attach/list/download/delete for the owner, size+mime validation, a storage port (local filesystem adapter in dev; S3/minio implements the same port) and a virus-scan port (noop adapter ships the contract). The e2e journey covers the whole lifecycle over the real stack:

```bash
npm run test:e2e -- flows/upload-journey
```

## Lint & typecheck

```bash
npm run lint       # eslint "src/**/*.ts" (flat config, typescript-eslint type-checked rules)
npm run lint:fix   # same with --fix
npm run typecheck        # strict typecheck over src and apps (src/tests/{world,integration,e2e,contract} excluded)
npm run typecheck:tests  # type-checks src/tests/** through src/tests/tsconfig.json
```
