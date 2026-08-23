---
title: starci-setup-mcp · English
---

# starci-setup-mcp

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared approval and output contract |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve and verify every requested project/role route |
| `@mcp` | `mcp/en.md` | en | Source-wide Qdrant, indexing and publication contract |
| `@embedding` | `mcp/embedding/en.md` | en | hardware-based Ollama installation and model selection |
| `@clients` | `mcp/clients/en.md` | en | Codex/OpenAI and Claude Code client installation |
| `@source-context` | `scripts/qdrant-source-context.mjs` | script | deterministic Docker setup and partition refresh |
| `@client-setup` | `scripts/mcp-client-setup.mjs` | script | idempotent public smoke plus both client installations |
| `@tunnel-set` | `scripts/cloudflare-tunnel-set.mjs` | script | value-safe tunnel and DNS reconciliation |

## NESTED SKILLS

None.

## PIPELINE

Topology: `reconciliation`.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| bind | shared | verified workspace routes, selected roles and MCP hostname intent | freeze partitions, read-only scope and publication ownership | MCP desired-state contract | every indexed root is routed and read-only |
| inspect-plan | reconciliation | desired state, current index/runtime and control-plane reads | compute index, service, credential and DNS deltas | setup plan | no connector, database or raw TCP scope is introduced |
| reconcile | execution | approved setup plan | build/rebuild partitions, service state and declared publication | setup receipts | credentials remain encrypted and mutations are idempotent |
| prove | proof | fresh MCP and public endpoint reads | query each partition and verify isolation/read-only behavior | MCP steady-state proof | selected sources resolve and no write capability exists |

## Run

Read `@skill-shape`, `@workspaces`, `@mcp` and `@embedding` before resolving Source language, project and exact roles from
`.workspaces/local/routes/<project>/<role>/config.json`. Never infer
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

The credential directory is singular: `.workspaces/local/credentials/`, not `.workspaces/credentials/`. Reuse these
SOPS ciphertext records through the initialized machine identity; never print or copy their plaintext:

- `cloudflare-api-token.key.enc` — Source-wide Cloudflare reconciliation authority;
- `cloudflare-<tunnel>-tunnel-token.key.enc` — connector run token for the named shared tunnel.

Default public naming is `mcp.<zone>`. Plan the exact hostname, tunnel and HTTP origin with `@tunnel-set`.
External tunnel/DNS mutation is a `### NEED APPROVALS` boundary; only `OK` on that displayed plan authorizes
reconciliation. Merge ingress and preserve other hostnames plus the terminal 404. Publish the MCP HTTP origin
only; Qdrant REST/gRPC and Ollama stay private.

When the owner explicitly approves the public Qdrant showcase, publish `qdrant.<zone>` only through the
generated read-only proxy on localhost port 8012. Never route the hostname to Qdrant REST/gRPC itself. Prove
that the dashboard loads without a browser credential, permitted inspection works, write requests are
rejected, and the API key is absent from browser-visible responses and logs.

## Clients

After the public route exists, read `@clients` and run `@client-setup --url https://mcp.<zone>/mcp/`. The
helper protocol-smokes the endpoint, merges `~/.codex/config.toml` for Codex/OpenAI, installs Claude Code at
user scope, and verifies the Claude connection. Keep localhost only for health checks. Do not switch either
client before an MCP initialize and `tools/list` request succeed publicly.

The generated MCP gateway must serve both `/mcp/` and Claude account connectors' normalized `/mcp` form
without an external redirect. Protocol-smoke both paths. Claude Web/Desktop account connectors are added
under `Customize > Connectors`; they are separate from Claude Code's user-scope CLI configuration.

## Proof

Prove route freshness, Docker health, exact point counts per partition, read-only tool exposure, semantic
search returning `/<role>/<project>/` paths, public HTTPS MCP smoke, both Codex and Claude Code connected,
encrypted credential presence and absence of plaintext twins. When showcase publication was approved, also
prove its HTTPS dashboard, read-only allowlist and rejected writes. Report names and verdicts only; never
report credential values.
