# Testing

One root `jest.config.js` (managed: `require("@starci/jest-preset").starciJestConfig()`) with four projects:

| Project | Command | What it is |
|---|---|---|
| unit | `npm test` / `npm run test:unit` | In-process specs, `<name>.spec.ts` beside the subject. Fakes at provider boundaries: no docker, no network. |
| e2e | `npm run test:e2e` | `src/tests/e2e/<area>/*.e2e-spec.ts`: A->Z journeys through the public doors of the real apps, `useTestWorld({ apps })`. |
| contract | `npm run test:contract` | `src/tests/contract/<provider>/*.contract-spec.ts`: our client against the provider's real sandbox; skips itself without sandbox config. Never part of `test` or `test:e2e`. |

`src/tests/world/` is the only test infrastructure. The integration, e2e and contract projects share its jest
`global-setup.ts` / `global-teardown.ts` (one Postgres container per run, `apps/migrate`'s exported `bootstrap` once, the
network-edge fakes of every third party under `src/tests/world/fakes/<provider>/`) and run one worker. `use-test-world.ts`
exports `useTestWorld(...)` -> `world.apps.<name>.api`, `world.db.<connection>` (the shared EntityManager) and
`world.fake.<provider>`. Nothing under `src/tests/` overrides a provider; shared test data lives in `src/tests/fixtures/`.

## Unit tests

```bash
npm test                    # whole unit suite (jest.config.js, project `unit`)
npx jest src/modules/domain/task   # one directory
npx jest -t "refuses"                 # one test name
```

- Config: `jest.config.js` project `unit` (ts-jest, `testMatch: **/*.spec.ts`, `@modules/*` / `@features/*` path aliases).
- Convention: `Test.createTestingModule({ providers: [X, { provide: Dep, useValue: mock }] })`, `module.get(X)` - never `new X(deps)`. Mock at provider boundaries (repositories, clients, event emitters, config). See any existing spec for style.
- The `unit` project ignores `src/tests/{world,integration,e2e,contract}/`, so those specs never run here.

## Coverage

```bash
npm run test:coverage       # jest --coverage -> coverage/lcov.info (+ text summary)
```

`collectCoverageFrom` covers all `src/**/*.ts` except specs and `main.ts`. Coverage is measured with the V8 provider (`coverageProvider: 'v8'` in `jest.config.js`) — istanbul under `ts-jest` inflates branch totals with transpiler-emitted helper branches (`__awaiter`/`__generator`/`__spreadArray`), which made the branch number meaningless.

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
