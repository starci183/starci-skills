# Changelog

## 1.0.0

First release; joins the 2.0.0 release set (hfs, jest-preset, canon-be).

- Added: `defineTestWorld` and the frozen spec-facing API (`useTestWorld({ apps } | { modules })`, `world.apps.<name>.api`, `world.db.<connection>`, `world.fake.<name>`, `world.infra.<service>` latency/cut/restore, `world.cluster`, `world.http`, `world.services`, `world.waitFor`, `world.commandBus/queryBus`, `world.signedInPerson`/`actAs`, `useSandbox` for contract specs).
- Added: the shared warm stack for all repositories (`starci-test-stack up|down|status`): postgres, redis, minio, qdrant, kafka, Keycloak behind toxiproxy, keyed by image; per-repository isolation by namespace (database names, Keycloak realm, Redis DB index, bucket/collection/topic prefixes, k3d namespaces, per-run proxies); k3d with a local registry and pull-through mirrors, own images built by content hash with GC of `src-*` tags.
- Added: the fakes framework (`@starci/test-world/fakes`) with request recording and failure injection, and the shared fakes `smtp`, `openai-compatible`, `vnpay`, `momo`, `payos`, `sepay`.
- Added: `@starci/test-world/global-setup` and `/global-teardown` (thin re-exports in `src/tests/world/`), the migrate step once per run, seeds, per-spec reset.
- Replaces the per-repository world infrastructure under `src/tests/world/`.
