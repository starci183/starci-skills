# Changelog

## 1.2.0 - 2026-10-02

- Added: Kafka as real own infrastructure, Apache Kafka in KRaft mode only. The stack definition must name exactly
  `apache/kafka:4.2.2@sha256:1213eb3943d551e5ed1fca7a4e109001cee35770b66a02a0c37a8964efe09b69` (`KAFKA_IMAGE`, the one pin
  shared with the dev stacks); Redpanda, cp-kafka and an undigested tag fail with `TEST_WORLD_STACK_DEFINITION`, and
  `stacks.kafka` can never be `fakedBy`.
- Added: per-slot Kafka. The broker has 8 slot listeners, each advertising its own toxiproxy port; a slot leases one
  (`RunKafka.listener`), so `world.infra.kafka.cut()` reaches its slot alone (the stack-wide Kafka proxy exception is gone).
  Topics, consumer groups and client ids of a slot begin with `<namespace>.`: `w.kafka.group(name)`, `w.kafka.clientId(name)`.
  Readiness is the topics script on the INTERNAL listener plus an ApiVersions round trip through the slot's proxy (no Kafka
  client dependency). Before each file the slot's topics are emptied up to the high watermark and its idle groups deleted;
  teardown deletes only the slot's groups (waiting out a dead member's session timeout, then failing by name) and topics.
- Added: schema-per-context Postgres. A connection may name a shared `database` and its `schema`: the connections of one
  database share it (one copy per slot), each in its own schema with its own login role (`search_path` = the schema).
  `w.db.<name>.schema`; reset empties only the context's schema; `infra.postgresql.connection(name).cut()` of a schema context
  stops its login only (`NOLOGIN`), so the contexts beside it keep serving. Contexts sharing a database must each declare a
  distinct schema (never `public` or `pg_*`).
- Changed: extensions are created in `public` of each database.

## 1.1.0 - 2026-10-02

- Added: per-worker data slots, so world spec files run in parallel. The globalSetup provisions N slots, N = min(jest
  `maxWorkers`, the declaration's new `workers` cap, default 2). A slot is a complete, independent run: its own namespace
  `<package>_<hash>_w<k>` and run token `<run>-w<k>`, so its own Postgres database per connection (migrated and seeded per slot),
  its own Keycloak realm, its own leased Redis DB index, its own MinIO/Qdrant/Kafka/k3d prefixes, its own fakes host, its own
  toxiproxy proxies and its own outage lock (in the slot's run directory). The teardown disposes every slot; a failed setup
  disposes the slots already made.
- Changed: the state file is protocol 2 (`{ version: 2, library, runId, slots }`); a spec process reads the slot named by
  `STARCI_TEST_WORLD_SLOT`, which `@starci/jest-preset` 2.2.4's world runner sets per file. The pair is exact: a state file of
  another protocol, or a process with no slot of the run, is the new `TEST_WORLD_PAIR_MISMATCH` naming both versions (re-pin
  both per canon-pins). `RunContext.version` is replaced by `RunContext.slot`; `namespaceOf(root, slot)` takes the slot.
- Fixed: a realm file that pins entity ids (a user `id` that a seed row names as the token `sub`) could be imported once per Keycloak server only: ids are unique server-wide, so a second slot (or a second checkout) failed with 409 Conflict. The import remaps each pinned user id to a per-namespace UUID (`namespacedId`, sha256 of `<namespace>:<id>`), drops the ids of clients, roles, groups, client scopes and components, and the slot's seeds are applied with the same user-id rewrite (`RunKeycloak.userIds`).
- Fixed: the stack, namespace and registry specs built their fixtures under a host path; they use the OS temp directory.
- Known limitation: Kafka's proxy is stack-wide (the broker advertises its proxied address), so a Kafka outage in one slot
  reaches the others; Redis has 16 DB indexes machine-wide, so slots x concurrent repositories must stay within 16.

## 1.0.5

- Added: a modules world boots real peer apps beside its modules: `useTestWorld({ modules, apps: ["order"] })` reserves the
  peers' ports first and wires `w.apps.<peer>.url`, so the integration client of one app runs against the real other app.
- Added: `world.apps.<name>.during(fn)`, the outage of an app as its peers see it: stop it, run `fn`, boot it again with the
  same options and port; it takes and keeps the run's outage lock like every other outage.
- Added: `w.keycloak.clientSecret(client)`. The realm import gives every confidential client (not public, not bearer-only) a
  secret generated for the run, whatever the realm file says; a repository never commits a client secret.

## 1.0.4

- Changed: `world.resolve(token)` and `scope.resolve(token)` take any Nest provider token (`ProviderToken<T>`: a class, a
  string or a symbol), so a modules spec resolves an integration client bound to a symbol (`{ provide: SEPAY, useClass:
  SepayClient }`) through the world instead of reaching into `world.context`. `ProviderToken` is exported.

## 1.0.3

- Fixed: the globalSetup registers the path aliases of the declaration exactly as TypeScript resolves them. It walks the
  `extends` chain of `src/tests/tsconfig.json` (or `tsconfig.json`): a string or an array (later entries win), relative paths
  and package specifiers, JSONC. `paths` comes from the nearest config that declares it, and its targets are relative to the
  effective `baseUrl` (resolved against the folder of the config that declares it) or, without one, to the folder of the
  config that declares `paths`. Before, a tests tsconfig that only extended the side's tsconfig resolved `@modules/*` under
  `src/tests/`, so a declaration importing an alias could not be loaded (`TEST_WORLD_CONFIG_INVALID`) although tsc was clean.

## 1.0.2

- Changed: every path a declaration names (`stack`, seeds, the Keycloak realm, k3d Dockerfiles) resolves from the app root: `appRootOf` finds the directory of the app's `hfs.json` from the jest rootDir (the rootDir itself or its parent, the be side's app). `.starcistacks` lives at the app root, never under `be/`. An explicit `root` still wins.

## 1.0.1

- Added: `world.keycloak.events(personId)` and `world.keycloak.sessions(personId)`: the user events the repository realm
  stored for a person (LOGIN, LOGIN_ERROR, LOGOUT, ... with client, session, error and time; the realm import enables events)
  and the person's live sessions with the clients that hold their tokens, read through the realm's admin API. The admin
  credentials stay inside the library.
- Added: `world.infra.postgresql.connection(name)` with `cut()`, `restore()` and `during(fn)`: the outage of ONE declared
  connection's database (it stops accepting connections and its sessions are terminated) while the other connections keep
  serving. It takes and keeps the run's outage lock like every other outage, and a world that stops with a database still
  down restores it. `world.interruptDatabase(fn, connection?)` takes the connection.

## 1.0.0

First release, pinned in `knowledge/hfs/canon-pins.yaml` for back ends.

- Added: `defineTestWorld` and the frozen spec-facing API (`useTestWorld({ apps } | { modules })`, `world.apps.<name>.api`, `world.db.<connection>`, `world.fake.<name>`, `world.infra.<service>` latency/cut/restore, `world.cluster`, `world.http`, `world.services`, `world.waitFor`, `world.commandBus/queryBus`, `world.signedInPerson`/`actAs`, `useSandbox` for contract specs).
- Added: the shared warm stack for all repositories (`starci-test-stack up|down|status`): postgres, redis, minio, qdrant, kafka, Keycloak behind toxiproxy, keyed by image; per-repository isolation by namespace (database names, Keycloak realm, Redis DB index, bucket/collection/topic prefixes, k3d namespaces, per-run proxies); k3d with a local registry and pull-through mirrors, own images built by content hash with GC of `src-*` tags.
- Added: the fakes framework (`@starci/test-world/fakes`) with request recording and failure injection, and the shared fakes `smtp`, `openai-compatible`, `vnpay`, `momo`, `payos`, `sepay`.
- Added: `@starci/test-world/global-setup` and `/global-teardown` (thin re-exports in `src/tests/world/`), the migrate step once per run, seeds, per-spec reset.
- Replaces the infrastructure the per-repository world carried; `src/tests/world/` keeps `test-world.config.ts`, `use-test-world.ts`, the two jest hook re-exports and `fakes/` (R47).
- Added: the run's outage lock. Every world holds it shared while it boots, around every test and while it stops; every outage
  (`world.infra.<service>.cut()`, `latency(ms)`, `during(fn)`, `keycloak.rotateClientSecret`) takes it exclusively itself and keeps
  it until `restore()` (a rotation until the world stops), so outage specs are serialized against every other spec file of the
  run under `--maxWorkers` > 1 without the spec doing anything. Writers win, an outage spec gives its own shared hold up while it
  waits (no deadlock between two outage specs), a dead holder is broken, and only the world that injected an outage restores the
  proxies at its stop.
- Added: `world.apps.<name>.restart()`, `world.applicationOrigin(app?)`, `world.withRequest(...)`, `world.buckets.<name>`,
  `world.registerPerson`, `world.scratchDir`, `infra.keycloak.rotateClientSecret(client)` and typed wiring by declared names.
