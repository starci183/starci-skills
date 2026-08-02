# Realtime (Socket.IO)

Source: `src/modules/socketio/` for the gateway core — Redis adapters, decorators, filters,
interceptors, middlewares, `response.service.ts` — and `src/features/socketio/core/<namespace>/` for
each concrete namespace.

## The namespaces

Twelve namespace folders under `src/features/socketio/core/`, re-counted 2026-08-03 (the two
non-namespace folders there, `enums/` and `types/`, are excluded):

`ai-lab/` (running AI Lab jobs), `autocomplete/` (search suggestions), `community-chat/`,
`community-feed/`, `content-ai/`, `content-discussion/`, `job-notifications/`, `mock-interview/`
(turn streaming), `notifications/`, `playground-byom/`, `rag-playground/`, `system-health/`.

Each holds `<name>.gateway.ts` plus `<name>.module.ts` / `module-definition.ts` and `types/`. Some
add a `<name>-room.service.ts` to manage room membership.

## The Redis adapter is not the Redis cache

The adapter uses `native/redis` under the key `Adapter`, which is what lets several instances
broadcast on the same namespace. That is a different injection from the cache instance, keyed
`Cache` — see the secondary-stores section of
[typeorm-entities-and-relations](typeorm-entities-and-relations.md). Injecting the wrong one gives a
working client that silently talks to the wrong place.

## Events are declared, not stringly typed

Realtime job state — progress, encoding, an AI run — is pushed over the matching namespace. The front
end subscribes via `subscription-event.ts` and publishes via `publication-event.ts`, both in
`src/features/socketio/core/enums/`.

## Adding a namespace

Create `src/features/socketio/core/<namespace>/` following the same three-file module shape plus the
gateway.

## Streaming an LLM response

Token-by-token output is wrapped into SSE or socket chunks with `@modules/stream-async-iterator` — see
[rag-langchain](rag-langchain.md).
