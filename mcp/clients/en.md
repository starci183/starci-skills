---
title: MCP client setup
---

# MCP client setup

## Shared rule

Configure both supported clients after the public MCP smoke passes. Use the same server name
`starci-source-context` and the same `https://mcp.<zone>/mcp` endpoint. The localhost URL is only a diagnostic
fallback on the Docker host. Do not write Cloudflare, Qdrant or Ollama credentials into either client config.

## Codex and OpenAI desktop clients

Codex stores MCP configuration in `~/.codex/config.toml`; the ChatGPT desktop app, Codex CLI and Codex IDE
extension share it. Merge this table without replacing unrelated user settings:

```toml
[mcp_servers.starci-source-context]
url = "https://mcp.<zone>/mcp"
required = true
enabled_tools = ["qdrant-find"]
```

Parse TOML after writing. Restart the desktop app or IDE extension, then verify with `codex mcp list` and
`/mcp`. The server must initialize and expose only `qdrant-find`. ChatGPT web does not read local Codex
configuration; using this MCP in hosted ChatGPT requires a separately published plugin and is outside this
client-install step.

## Claude Code

Install the same remote Streamable HTTP server at user scope so it is available across the owner's projects:

```text
claude mcp add --transport http --scope user starci-source-context https://mcp.<zone>/mcp
claude mcp get starci-source-context
claude mcp list
```

Run `/mcp` inside Claude Code and require the server to show connected. User scope is stored in
`~/.claude.json`; do not hand-edit or replace that file when the CLI is available. Use project scope only
when the team explicitly wants a versioned root `.mcp.json`; project-scoped servers require workspace trust
and interactive approval.

## Idempotency and proof

Read existing entries before adding. When the same name already targets the accepted endpoint, keep it. When
it differs, report the old and new non-secret URLs before replacement. Completion requires both clients to
connect, list only the read tool, and return a routed `/<role>/<project>/` semantic result. A browser GET is
not an MCP health test; Streamable HTTP expects MCP protocol requests and may reject ordinary navigation.
