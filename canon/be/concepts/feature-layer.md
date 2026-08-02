# Concept — Feature layer (`src/features/`)

Source: `src/features/api/`, `src/features/socketio/`, `src/modules/bussiness/`.

A feature is where the application is wired up and an endpoint or a consumer is exposed; it calls
down into [`module-layer-structure.md`](module-layer-structure.md). A module is reusable on its own,
a feature is not.

## The tree

`src/features/` holds `api/ backup/ cli/ mock/ socketio/ tools/ video-encoder/` (re-checked
2026-08-03; the `synchronizer/` entry this rule used to list is gone — startup synchronizers now live
under `src/modules/init/synchronizers/`).

- `api/core/{graphql,http}` — [`graphql-resolver-pattern.md`](graphql-resolver-pattern.md) and
  [`rest-controller-pattern.md`](rest-controller-pattern.md)
- `api/processors/` — [`background-jobs-bullmq.md`](background-jobs-bullmq.md)
- `socketio/core/<namespace>/` — [`realtime-socketio.md`](realtime-socketio.md)
- `video-encoder/` — [`media-dash-ffmpeg.md`](media-dash-ffmpeg.md)

`ApiModule` collects graphql and http, plus the processors when it is registered with
`register({ useProcessors: true })`. A new Socket.IO namespace is a new folder under
`src/features/socketio/core/<namespace>/`.

## Three layers, strictly

`controller or resolver (features/api)` calls a **domain service** in `@modules/bussiness`, which
calls the `EntityManager` (see
[`typeorm-entities-and-relations.md`](typeorm-entities-and-relations.md)).

The resolver or controller only orchestrates: take the input, call the domain service, map the
result. No business rule lives there.

The anti-pattern is a controller or resolver that skips the domain layer and reaches straight for a
TypeORM repository. The one tolerated case is a simple single-entity query with no rule attached to
it.
