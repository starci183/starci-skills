---
title: MCP context
---

# MCP context

## LOADS

| Alias | Target | Use when |
|---|---|---|
| `@mcp-qdrant` | `mcp/qdrant` | provision or verify the local vector service and MCP runtime |
| `@mcp-embedding` | `mcp/embedding` | inspect hardware, install Ollama and choose one dimension-locked embedding profile |
| `@mcp-source-context` | `mcp/source-context` | index one or more verified workspace roles and generate client configuration |
| `@mcp-clients` | `mcp/clients` | install the verified remote endpoint into both Codex/OpenAI and Claude Code |

## Purpose

Provide optional semantic context without turning a vector database into authority. Workspace routes remain
the source-location authority; Git remains the source-content authority; Qdrant is a rebuildable projection.

## Rules

- Resolve `.workspace/<project>/<role>/config.json` before reading a checkout.
- Use one Source-wide Qdrant instance and collection. Partition documents by virtual root
  `/<role>/<project>/`; adding a project must not add another Qdrant or MCP container.
- Store generated configuration and manifests under `.worktrees/source-context/cache/mcp/`, never in this tree.
- Launch source-context MCP read-only. Refresh happens only through the deterministic indexer.
- Read credentials from the routed backend stack's ignored plaintext file after `npm run sync`; never copy a
  value into MCP JSON, arguments, output or a tracked file.
- Treat `https://mcp.<zone>/mcp/` as the canonical client endpoint for the selected zone. Keep
  `http://localhost:8011/mcp/` only for machine-local health checks and recovery.
- Publish only the MCP HTTP port through the Source-wide, remotely managed
  `starci-local-services` Cloudflare tunnel. Qdrant ports and the Ollama API remain private.
- Own Cloudflare API and tunnel run tokens only as SOPS ciphertext under `.workspace/credentials/`.
  The connector may consume a decrypted runtime file, but no token enters this trust tree, client JSON,
  Compose arguments or logs.
- Rebuild context from source whenever the route or desired revision changes. Search results are additional
  evidence, not permission to skip direct source reads before a write.

## Entry point

```text
node .claude/scripts/qdrant-source-context.mjs plan   --project <project> --roles be,fe
node .claude/scripts/qdrant-source-context.mjs setup  --project <project> --roles be,fe
```

The generated client record uses the configured `https://mcp.<zone>/mcp/`. Operators may test the local
endpoint before publishing, then reconcile that hostname to `http://host.docker.internal:8011` through the
shared tunnel. For this Source, `<zone>` is `starci.org`.

Load `@mcp-embedding`, then `@mcp-qdrant`, before first-machine setup; load `@mcp-source-context` for the
indexing contract and `@mcp-clients` only after the public smoke passes.
