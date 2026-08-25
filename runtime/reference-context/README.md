# Local reference context

This runtime indexes clean portable-route checkouts from `.worktrees/references/<project>-<role>` into machine-local Qdrant Edge and exposes the read-only `reference_search` tool through loopback Caddy.

## New machine

From the Source root:

```text
node .claude/scripts/reference-context.mjs bootstrap --projects <project> --roles fe,be --plan
node .claude/scripts/reference-context.mjs bootstrap --projects <project> --roles fe,be --apply
```

Bootstrap resolves tracked `.workspaces/projects/*/*.json` declarations, creates clean reference checkouts, creates an ignored Python environment, installs pinned `mcp` and `qdrant-edge-py`, detects or installs Caddy, performs the initial full index, proves MCP plus one query, and merges only `[mcp_servers.starci-reference-context]` into the Codex user config. Restart Codex after the first successful merge.

If Caddy is absent, Windows uses `winget` and macOS uses Homebrew. Other platforms stop with the official Caddy installation URL instead of inventing a privileged package-manager command.

## Refresh

```text
node .claude/scripts/reference-context.mjs index --projects <project> --roles fe,be
node .claude/scripts/reference-context.mjs index --projects <project> --roles fe,be --full
```

The default policy is versioned in `drift-policy.json`. It chooses `noop`, `incremental`, or `full` from compatibility, eligible blob/byte/record/delete drift and estimated cost. A fixed percentage is not operator truth.

## Git boundary

Only runtime/operator source, policy, dependency pins, and tests are versioned. Reference checkouts, Qdrant generations, Python environments, Caddy config, PID files, runtime receipts, and extracted data stay under ignored `.worktrees/` or `.workspaces/local/` roots.
