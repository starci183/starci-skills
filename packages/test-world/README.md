# @starci/test-world

The shared e2e library of every StarCi back end. It owns everything that touches infrastructure (the warm stack, the Nest boot, the shared fakes); a repository keeps its declaration, the entry its specs import and its repo-specific fakes, in the world slot that R47 (`BE_TEST_TOPOLOGY`) defines:

```
be/src/tests/world/
  test-world.config.ts   the declaration (repo-owned): export default defineTestWorld({ stack, stacks, fakedBy, ... })
  use-test-world.ts      the spec entry: import world from "./test-world.config"; export const { useTestWorld, useSandbox } = world
  global-setup.ts        export { default } from "@starci/test-world/global-setup"
  global-teardown.ts     export { default } from "@starci/test-world/global-teardown"
  fakes/<provider>/      repo-specific network-edge fakes (SaaS we do not operate, not shared by the library)
```

## Hard rule

Nothing in a spec reads or writes `process.env`, starts a container, imports `DataSource`, testcontainers or a migration, or uses skips or sleeps. The library is the only place allowed to do infrastructure. Everything in our own stack runs REAL (postgres, redis, minio, qdrant, kafka, Keycloak with its realm, k3d); only external SaaS is faked, at the network edge. Stateless compute that needs special hardware (vLLM, self-hosted embedding) may be faked by protocol with a declared `fakedBy` and `reason`.

## The declaration

```ts
import { openaiCompatibleFake, sepayFake, smtpFake } from "@starci/test-world/fakes"
import { defineTestWorld } from "@starci/test-world"

export default defineTestWorld({
    stack: ".starcistacks/dev",                       // service list and image versions come from its compose files
    stacks: {
        postgresql: { connections: [{ name: "primary", seeds: [".starcistacks/dev/seeds/01.sql"] }] },
        keycloak: { realm: ".starcistacks/dev/infra/compose/realm-todo.json", clientId: "todo-api" },
        redis: {},
        minio: { buckets: ["uploads"] },
        qdrant: {},
        kafka: { topics: ["events"] },
        vllm: { fakedBy: "llm", reason: "needs a GPU" },   // selection only: no container, the protocol fake answers
    },
    k3d: { enable: true, images: { api: "Dockerfile" } },  // own images: built by content hash (src-<hash>), reused when the tag exists
    services: { billing: {} },                             // sibling services (our images from other repos), image pinned by the stack definition
    fakes: { smtp: smtpFake(), sepay: sepayFake(), llm: openaiCompatibleFake() },
    apps: {
        todo: { module: TodoApp, operations: TODO_OPERATIONS, options: (w) => ({ port: w.apps.todo.port, database: { name: "primary", url: new Secret(w.db.primary.url) }, /* every URL comes from w */ }) },
        worker: { module: WorkerApp, listen: false, options: (w) => ({ /* ... */ }) },
    },
    migrate: { module: migrateMain, options: (w) => ({ connections: [/* from w.db */] }) },   // apps/migrate: `bootstrap` export, a function, or an AppModule
    identity: { register: "keycloak", signIn: (world, { email, password }) => /* the public door */ },
    modules: { base: (w) => [/* clock, logging, database module over w.db */] },              // base of { modules } specs
    sandbox: { base: () => [HttpModule.register({ isGlobal: true })] },                        // contract specs
})
```

`w` (the wiring) carries every URL of the run, built before any app boots: `w.apps.<name>.{url,port}` (ports are reserved first, so apps that call each other know each other), `w.db.<conn>.{url,host,port,user,password,database}`, `w.redis`, `w.minio`, `w.qdrant`, `w.kafka`, `w.keycloak.{baseUrl,realm,issuer,tokenUrl,jwksUrl,clientId}`, `w.fake.<name>.{url,port,values,endpoints}`, `w.services`, `w.cluster`, `w.directory(name)`, `w.secret(label)`. A service the declaration does not run throws `TEST_WORLD_NOT_DECLARED` when read.

## The spec-facing API (frozen)

```ts
const world = useTestWorld({ apps: ["todo", "worker"] })   // or { todo: true }, or { modules: [(w) => CatalogModule.register({ isGlobal: true })] }
```

| | |
|---|---|
| `world.apps.<name>.restart()` | stop and re-boot one app in the same world (same typed options, port, database, stack): proves state survives a process restart. |
| `world.applicationOrigin(app?)` | `scheme://host:port` of a booted app, for a correct `Origin` header. |
| `world.withRequest({ principal, locale?, plan?, ... }, (scope) => ...)` | modules mode: a REAL Nest request scope (cqrs `AsyncContext`: ContextId + registered request); `scope.commandBus/queryBus.execute`, `scope.resolve(Class)`; request-scoped providers read the values through `@Inject(REQUEST)`. |
| `world.apps.<name>.api` | `graphql(op, vars?, lang?)`, `read/mutate`, `get/post/put/delete` (Buffer body = raw bytes), `as(token)` / `bearing(token)`, `signIn`, `baseUrl`. `op` is a key of the app's `operations` registry or a document string. Refusals resolve as data (`errorCode`). |
| `world.db.<connection>` | the shared TypeORM `EntityManager` of the connection. |
| `world.fake.<name>` | `failNext({status,timeout,badSignature,truncateStream,times,match})`, `requests()`, `reset()` plus each fake's own methods (`mails()`, `settle()`, `replayWebhook()`, `delayWebhook()`, ...). |
| `world.infra.<svc>` | `latency(ms)`, `cut()`, `restore()`, `during(fn)` through toxiproxy; `redis.size()`; `keycloak.rotateClientSecret(client)` (new secret on the real realm, so an app holding the old one is stale). |
| `world.keycloak` | `person(email, password)`, `token(email, password)` on the real realm. |
| `world.buckets.<name>` | run-isolated MinIO/S3 bucket declared in `stacks.minio.buckets`: `{ endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle }`; stored name is `<namespace>-<name>`. |
| `world.cluster` | `pods(ns?)`, `namespaces()`, `createNamespace`, `deleteNamespace`, `apply`, `waitForPods` (this repository's namespaces only). |
| `world.services.<name>.api`, `world.http(url)` | REST clients. |
| `world.waitFor(label, check, opts?)`, `world.waitUntil(label, observe, ready, opts?)` | state pollers; no sleeps. |
| `world.signedInPerson(label)`, `world.registerPerson(label)`, `world.signIn(email, pw)`, `world.actAs(person, app?)`, `world.scratchDir(name)` | through the doors `identity` declares. |
| `world.commandBus`, `world.queryBus`, `world.resolve(Class)`, `world.context` | `{ modules }` mode. |
| `world.interruptDatabase(fn)` | `infra.postgresql.during(fn)`. |
| `useSandbox({ provider, keys, module, client })` | contract layer: the real client against a provider sandbox; the library reads the keys and skips when absent. |

## One warm stack for all repos

`starci-test-stack up|down|status` (the managed `npm run test:stack -- up`). The globalSetup attaches to the stack or starts it. Containers are keyed by image (`starci-ts-<service>-<hash of image>`): two repositories on the same Postgres image share one container, another version gets its own. Machine state lives in `~/.starci/test-stack` (registry with leases, cross-process lock).

Per-repository isolation is enforced by the library from the namespace `<package>_<6 hex of the checkout path>`: Postgres databases `<ns>_<connection>`, a Keycloak realm `<ns>-<realm>`, a Redis DB index leased per namespace, MinIO buckets `<ns>-<name>`, Qdrant collection and Kafka topic prefixes, k3d namespaces `<ns>-<name>`, toxiproxy proxies per run. Two repositories (or two checkouts of one) run e2e concurrently; two runs of the same checkout collide with `TEST_WORLD_NAMESPACE_BUSY`. Kafka advertises its address, so its proxy is stack-wide (a documented exception).

k3d: one cluster per k3s image plus a local registry with pull-through mirrors for vendor images; own images are built by content hash (Dockerfile + lockfile + COPY'd sources), reused when the tag exists, and garbage-collected keeping the last 3 `src-*` tags.

## Per run and per spec

globalSetup: validate declaration, read the stack definition, start the fakes host, attach the stack (provision), start siblings, run `migrate` once, apply `seeds`, snapshot the tables the migrate/seed step filled. Per spec file (`useTestWorld` `beforeAll`): reset (truncate every table except migration ledgers and seeded tables, delete non-imported realm users, flush the Redis DB, drop namespaces, reset fakes), reserve ports, build the wiring, `AppModule.register(options)`, listen, open the db handles. Teardown drops what the run provisioned; shared containers stay warm.

## Fakes

`@starci/test-world/fakes`: `defineHttpFake` (recording, failure injection, control channel), `smtpFake`, `openaiCompatibleFake` (streaming, embeddings), `vnpayFake`, `momoFake`, `payosFake`, `sepayFake` with the providers' real signature schemes and payload fixtures. Repo-specific fakes are built with `defineHttpFake` in `src/tests/world/fakes/`.

## Developing the library

`npm test` builds and runs `node --test dist/**/*.test.js` (no docker needed; every layer is unit-tested against a scripted exec). Peer dependencies: `@nestjs/common`, `@nestjs/core`, `typeorm`, `pg`, `jest`, `tsconfig-paths`.
