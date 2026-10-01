# Changelog

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
