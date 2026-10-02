# @starci/test-world

The shared e2e library of every StarCi back end. It owns everything that touches infrastructure (the warm stack, the Nest boot, the shared fakes); a repository keeps its declaration, the entry its specs import and its repo-specific fakes, in the world slot that R47 (`BE_TEST_TOPOLOGY`) defines:

```
be/src/tests/world/
  test-world.config.ts   the declaration (repo-owned): export const { useTestWorld, useSandbox } = defineTestWorld({ stack, stacks, fakes, ... })
  use-test-world.ts      the spec entry: export { useTestWorld, useSandbox } from "./test-world.config"
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

export const { useTestWorld, useSandbox } = defineTestWorld({
    stack: ".starcistacks/dev",                       // relative to the app root (never be/); service list and image versions come from its compose files
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

`w` (the wiring) carries every URL of the run, built before any app boots: `w.apps.<name>.{url,port}` (ports are reserved first, so apps that call each other know each other), `w.db.<conn>.{url,host,port,user,password,database,schema}`, `w.redis`, `w.minio`, `w.qdrant`, `w.kafka.{brokers,topic(name),group(name),clientId(name)}` (every topic, consumer group and client id of an app under test comes from here, so it is the slot's), `w.keycloak.{baseUrl,realm,issuer,tokenUrl,jwksUrl,clientId,clientSecret(client)}` (every confidential client of the realm file gets a secret generated per run; the file never carries one), `w.fake.<name>.{url,port,values,endpoints}`, `w.services`, `w.cluster`, `w.directory(name)`, `w.secret(label)`. A service the declaration does not run throws `TEST_WORLD_NOT_DECLARED` when read.

## The spec-facing API (frozen)

```ts
const world = useTestWorld({ apps: ["todo", "worker"] })   // or { todo: true }, or { modules: [(w) => CatalogModule.register({ isGlobal: true })] }
// a modules world may boot real peer apps beside its modules: { modules: [(w) => OrderApiModule.register({ isGlobal: true, url: w.apps.order.url })], apps: ["order"] }
```

| | |
|---|---|
| `world.apps.<name>.restart()` | stop and re-boot one app in the same world (same typed options, port, database, stack): proves state survives a process restart. |
| `world.apps.<name>.during(fn)` | the outage of an app as its peers see it: stop it, run `fn`, boot it again (same options and port), under the run's outage lock. |
| `world.applicationOrigin(app?)` | `scheme://host:port` of a booted app, for a correct `Origin` header. |
| `world.withRequest({ principal, locale?, plan?, ... }, (scope) => ...)` | modules mode: a REAL Nest request scope (cqrs `AsyncContext`: ContextId + registered request); `scope.commandBus/queryBus.execute`, `scope.resolve(Class)`; request-scoped providers read the values through `@Inject(REQUEST)`. |
| `world.apps.<name>.api` | `graphql(op, vars?, lang?)`, `read/mutate`, `get/post/put/delete` (Buffer body = raw bytes), `as(token)` / `bearing(token)`, `signIn`, `baseUrl`. `op` is a key of the app's `operations` registry or a document string. Refusals resolve as data (`errorCode`). |
| `world.db.<connection>` | the shared TypeORM `EntityManager` of the connection. |
| `world.fake.<name>` | `failNext({status,timeout,badSignature,truncateStream,times,match})`, `requests()`, `reset()` plus each fake's own methods (`mails()`, `settle()`, `replayWebhook()`, `delayWebhook()`, ...). |
| `world.infra.<svc>` | `latency(ms)`, `cut()`, `restore()`, `during(fn)` through toxiproxy; `redis.size()`; `keycloak.rotateClientSecret(client)` (new secret on the real realm, so an app holding the old one is stale); `postgresql.connection(name).cut()/restore()/during(fn)` takes one connection's database down while the others serve. |
| `world.keycloak` | `person(email, password)`, `token(email, password)` on the real realm; `events(personId)` (the user events the realm stored: LOGIN, LOGOUT, ...; the realm import enables events) and `sessions(personId)` (live sessions and the clients holding their tokens), read through the admin API. |
| `world.buckets.<name>` | run-isolated MinIO/S3 bucket declared in `stacks.minio.buckets`: `{ endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle }`; stored name is `<namespace>-<name>`. |
| `world.cluster` | `pods(ns?)`, `namespaces()`, `createNamespace`, `deleteNamespace`, `apply`, `waitForPods` (this repository's namespaces only). |
| `world.services.<name>.api`, `world.http(url)` | REST clients. |
| `world.waitFor(label, check, opts?)`, `world.waitUntil(label, observe, ready, opts?)` | state pollers; no sleeps. |
| `world.signedInPerson(label)`, `world.registerPerson(label)`, `world.signIn(email, pw)`, `world.actAs(person, app?)`, `world.scratchDir(name)` | through the doors `identity` declares. |
| `world.commandBus`, `world.queryBus`, `world.resolve(token)`, `world.context` | `{ modules }` mode; `resolve` (and `scope.resolve`) takes any Nest token: a class, or the string or symbol a provider is bound to. |
| `world.interruptDatabase(fn, connection?)` | `infra.postgresql.during(fn)`, or `infra.postgresql.connection(name).during(fn)` with a connection. |
| `useSandbox({ provider, keys, module, client })` | contract layer: the real client against a provider sandbox; the library reads the keys and skips when absent. |

## One warm stack for all repos

`starci-test-stack up|down|status` (the managed `npm run test:stack -- up`). The globalSetup attaches to the stack or starts it. Containers are keyed by image (`starci-ts-<service>-<hash of image>`): two repositories on the same Postgres image share one container, another version gets its own. Machine state lives in `~/.starci/test-stack` (registry with leases, cross-process lock).

Per-repository and per-slot isolation is enforced by the library from the namespace `<package>_<6 hex of the checkout path>_w<slot>`: Postgres databases `<ns>_<connection>` (or, for contexts that start as schemas of one database, `<ns>_<database>` with a schema and a login role `<ns>_<connection>` per context), a Keycloak realm `<ns>-<realm>`, a Redis DB index leased per namespace, MinIO buckets `<ns>-<name>`, Qdrant collection prefixes, Kafka topic, consumer-group and client-id prefixes `<ns>.` and a Kafka broker listener per slot, k3d namespaces `<ns>-<name>`, toxiproxy proxies per run. Two repositories (or two checkouts of one) run e2e concurrently; two runs of the same checkout collide with `TEST_WORLD_NAMESPACE_BUSY`. Kafka is the ONE pinned image `apache/kafka:4.2.2@sha256:1213eb39...` (KRaft, no ZooKeeper; Redpanda, cp-kafka and undigested tags are refused) and always runs real; the broker has 8 slot listeners, each advertising its own toxiproxy port, so a slot's Kafka traffic flows only through its own proxy (8 concurrent slots machine-wide).

k3d: one cluster per k3s image plus a local registry with pull-through mirrors for vendor images; own images are built by content hash (Dockerfile + lockfile + COPY'd sources), reused when the tag exists, and garbage-collected keeping the last 3 `src-*` tags.

## Per run, per slot and per spec

A run has N data slots, N = min(jest `maxWorkers`, the declaration's `workers`, default 2), so world spec files run in parallel: `@starci/jest-preset`'s world runner (the paired 2.2.4) runs up to N files at once, each in its own process bound to one slot (`STARCI_TEST_WORLD_SLOT`), never two files on one slot. A slot is a complete run of its own: its namespace and run token, databases, realm, Redis DB, prefixes, fakes host, proxies, run directory and outage lock. The state file (protocol 2) lists every slot; a state file of another protocol, or a process without a slot of the run, is `TEST_WORLD_PAIR_MISMATCH` (pin both packages together per canon-pins).

globalSetup, per slot: validate declaration, read the stack definition, start the slot's fakes host, attach the stack (provision the slot's namespace), start siblings, run `migrate`, apply `seeds`, snapshot the tables the migrate/seed step filled. Per spec file (`useTestWorld` `beforeAll`): reset (truncate every table except migration ledgers and seeded tables, delete non-imported realm users, flush the Redis DB, drop namespaces, reset fakes), reserve ports, build the wiring, `AppModule.register(options)`, listen, open the db handles. Teardown drops what every slot provisioned; shared containers stay warm.

## Outages and parallel spec files

Spec files of different slots share nothing but the warm containers (each slot has its own proxies), so an outage in one slot
never reaches another (Kafka included: each slot has its own broker listener and proxy). Within a slot an outage is serialized by the library itself: the slot's outage lock (in
the slot's run directory) is held SHARED by every world while it boots, around every test (`beforeEach`/`afterEach` that
`useTestWorld` registers) and while it stops, and EXCLUSIVELY by every outage call: `world.infra.<svc>.cut()`, `latency(ms)`
and `during(fn)` take it before they touch toxiproxy and keep it until `restore()` (or the world stops),
`keycloak.rotateClientSecret` keeps it until the world stops (a rotation is never undone). An outage therefore waits for the
tests other files are running, and their next tests wait for the outage to end; a waiting outage keeps new tests out, and an
outage spec gives its own shared hold up while it waits, so two outage specs never deadlock. A spec cannot forget the lock: the
outage API takes it. Only the world that injected an outage restores proxies at its stop. A holder whose process died is broken.

## Fakes

`@starci/test-world/fakes`: `defineHttpFake` (recording, failure injection, control channel), `smtpFake`, `openaiCompatibleFake` (streaming, embeddings), `vnpayFake`, `momoFake`, `payosFake`, `sepayFake` with the providers' real signature schemes and payload fixtures. Repo-specific fakes are built with `defineHttpFake` in `src/tests/world/fakes/`.

## Developing the library

`npm test` builds and runs `node --test dist/**/*.spec.js` (no docker needed; every layer is unit-tested against a scripted exec). Peer dependencies: `@nestjs/common`, `@nestjs/core`, `typeorm`, `pg`, `jest`, `tsconfig-paths`.
