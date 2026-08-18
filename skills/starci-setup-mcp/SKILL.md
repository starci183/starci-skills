---
name: starci-setup-mcp
description: Set up the Source-wide read-only StarCi source-context MCP from verified workspace routes, index selected frontend/backend sources, and publish it through the shared Cloudflare control plane. Use when adding or refreshing routed source context or making the MCP hostname available to users.
---

# starci-setup-mcp

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | shared approval and output contract |
| `@workspaces` | `contexts/workspaces` | module | resolve and verify every requested project/role route |
| `@mcp` | `mcp` | module | Source-wide Qdrant, indexing and publication contract |
| `@embedding` | `mcp/embedding` | module | hardware-based Ollama installation and model selection |
| `@clients` | `mcp/clients` | module | Codex/OpenAI and Claude Code client installation |
| `@source-context` | `scripts/qdrant-source-context.mjs` | script | deterministic Docker setup and partition refresh |
| `@tunnel-set` | `scripts/cloudflare-tunnel-set.mjs` | script | value-safe tunnel and DNS reconciliation |

## NESTED SKILLS

None.

## Run

Read `@skill-shape`, `@workspaces`, `@mcp` and `@embedding` before resolving Source language, project and exact roles from
`.workspace/<project>/<role>/config.json`. Never infer
a checkout and never clone a repository: “get StarCi source” means read the already declared routed checkout.
Stop on an absent or stale route.

Before the first setup, measure RAM, CPU, GPU/VRAM and current `ollama list` / `ollama ps`; recommend one
embedding tier from `@embedding` and explain its latency/quality trade-off. Install Ollama and pull only the
selected embedding model when absent. Verify the model capability, native embedding length, one `/api/embed`
response and actual CPU/GPU placement. Never guess dimension from the model name.

Run `@source-context plan`, then `setup`, for the selected roles. One Source owns one Qdrant, one MCP runtime
and one collection; additional projects add only `/<role>/<project>/` partitions. MCP stays read-only and
publishes only source catalogs. Direct source reads remain authoritative.

## DNS and credentials

The credential directory is singular: `.workspace/credentials/`, not `.workspaces/credentials/`. Reuse these
SOPS ciphertext records through the initialized machine identity; never print or copy their plaintext:

- `cloudflare-api-token.key.enc` — Source-wide Cloudflare reconciliation authority;
- `cloudflare-<tunnel>-tunnel-token.key.enc` — connector run token for the named shared tunnel.

Default public naming is `mcp.<zone>`. Plan the exact hostname, tunnel and HTTP origin with `@tunnel-set`.
External tunnel/DNS mutation is a `### NEED APPROVALS` boundary; only `OK` on that displayed plan authorizes
reconciliation. Merge ingress and preserve other hostnames plus the terminal 404. Publish the MCP HTTP origin
only; Qdrant REST/gRPC and Ollama stay private.

## Clients

After the public smoke test passes, read `@clients` and configure both Codex/OpenAI and Claude Code with the
same canonical endpoint. Merge `~/.codex/config.toml` for Codex and use `claude mcp add --transport http
--scope user` for Claude Code. Keep localhost only for health checks. Do not switch either client before an
MCP initialize and `tools/list` request succeed publicly.

## Proof

Prove route freshness, Docker health, exact point counts per partition, read-only tool exposure, semantic
search returning `/<role>/<project>/` paths, public HTTPS MCP smoke, both Codex and Claude Code connected,
encrypted credential presence and absence of plaintext twins. Report names and verdicts only; never report
credential values.
