# Qdrant MCP setup

## LOADS

None.

## Ownership

The MCP layer owns a dedicated Qdrant container, volume and encrypted `qdrant-mcp-api-key.txt.enc` in the
verified backend stack. It shares none of the application's Qdrant state.

## First machine

From the Source:

```text
node .claude/scripts/qdrant-source-context.mjs setup --project <project> --roles be,fe
```

Setup mints a dedicated random key through `secret:set` when absent, keeps its SOPS ciphertext in Git,
generates machine-local Compose/client files, starts Qdrant, indexes requested routes with the existing
`qwen3-embedding:8b` Ollama model, then starts one Source-wide read-only MCP container.

## Verify

Run `node .claude/scripts/qdrant-source-context.mjs plan --project <project> --roles be,fe`. It must report a
verified route, dedicated ports, an existing non-empty key file, Docker and the named Ollama model.
The command prints names and paths only, never the key.

## Runtime

Compose runs Qdrant, one-shot deterministic indexers and one official-server-derived MCP container. The
only extension is the Ollama embedding provider required to use the owner's 8B model. The server uses
streamable HTTP and `QDRANT_READ_ONLY=true`. The client JSON contains the canonical
`https://mcp.<zone>/mcp/` URL and no credential; localhost port 8011 remains a local diagnostic surface.

## Public showcase

The generated stack also runs a separate Nginx showcase proxy on localhost port 8012. Its canonical route is
`https://qdrant.<zone>/dashboard`, derived from the selected `https://mcp.<zone>/mcp/` endpoint unless an
explicit showcase URL is supplied. The shared Cloudflare tunnel points at the proxy,
never at Qdrant REST/gRPC ports. The proxy injects the dedicated key only on its private upstream hop,
admits GET inspection plus the dashboard's explicit read-only vector query endpoints, and rejects every
write method and endpoint. The key never reaches browser configuration, HTML, JavaScript, URLs or logs.

The showcase is presentation evidence, not an administration surface. Operators continue to use
`http://localhost:<dedicated-rest-port>/dashboard` for private administration. Adding a new collection or
read operation to the public allowlist requires a reviewed proxy change; never widen it to the raw Qdrant
origin for convenience.

## Stop and recover

Stop the dedicated stack with `node .claude/scripts/qdrant-source-context.mjs down --project <project>
--roles be,fe`. Context is rebuildable: rerun the index command to replace only the selected
`/<role>/<project>/` partitions. Other project partitions remain intact.
