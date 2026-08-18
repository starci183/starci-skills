---
title: Routed source context
---

# Routed source context

## Projection

Each requested role resolves from `.workspace/<project>/<role>/config.json` and publishes virtual paths
below `/<role>/<project>/` in the shared `starci-context-v1` collection. Refresh upserts one generation and
deletes older points only for that exact role/project partition; every other source remains untouched.

Every selected tracked source file is represented in a feature/module catalog by its virtual path and
source outline: imports, exports, decorators, classes, functions and declarations. Search routes the agent
to authoritative files instead of returning detached implementation fragments. Dependencies, VCS internals,
build output, coverage, caches, generated worktrees, stack data, environment files and lockfiles are excluded.

The payload shape deliberately matches the official Qdrant MCP server:

```json
{"document":"<catalog under /role/project>","metadata":{"project":"...","role":"...","paths":["/role/project/..."]}}
```

The vector name is `ollama-qwen3-embedding-8b`. Both indexing and MCP queries call the owner's existing
Ollama model `qwen3-embedding:8b` at 4096 dimensions. The official server is kept as the MCP/Qdrant core;
a narrow `EmbeddingProvider` adapter supplies Ollama because upstream currently ships only FastEmbed.

## Publication boundary

The canonical remote pattern is `https://mcp.<zone>/mcp`; the local diagnostic endpoint is
`http://localhost:8011/mcp`. Cloudflare routes the hostname through the shared remotely managed
`starci-local-services` tunnel to `http://host.docker.internal:8011`. This publishes MCP only: Qdrant REST,
Qdrant gRPC and Ollama are never tunnel origins.

The Source-wide control-plane records are
`.workspace/credentials/cloudflare-api-token.key.enc` and
`.workspace/credentials/cloudflare-starci-local-services-tunnel-token.key.enc`. They remain machine-local
SOPS ciphertext. Reconciliation merges this hostname with existing ingress and preserves the terminal 404;
it must not replace other services on the shared tunnel.

## Commands

- `plan` resolves routes, stack ownership, collections and prerequisites without writing.
- `config` writes machine-local Compose, environment and client JSON under `.worktrees/source-context/cache/mcp/`;
  pass `--public-url https://mcp.<zone>/mcp` when the Source does not use the default StarCi zone.
- `index` runs the containerized indexer, downloads the declared embedding model when absent, builds both projections and writes value-free
  manifests beside the client JSON.
- `setup` runs config, Qdrant start, index and MCP start in dependency order; `down` stops only this stack.

Codex/OpenAI client configuration is:

```toml
[mcp_servers.starci-source-context]
url = "https://mcp.<zone>/mcp"
```

Claude Code user-scope configuration is installed with:

```text
claude mcp add --transport http --scope user starci-source-context https://mcp.<zone>/mcp
```

Never run `index` against an alias not prefixed `starci-context-`. Never enable the MCP store tool for a
source collection.
