# `platform/mcp-publish` input

This closed input publishes and proves only the already-declared MCP boundary. It is ephemeral task-session state and is purged with all loaded values and intermediates whenever the parent skill reaches a terminal state.

## JSON architecture

| Section | Owner | Purpose |
| --- | --- | --- |
| Root route | Skill machine | Accept only `platform.mcp.publish / ready` with `platform-source-index-ready`. |
| `payload.provided` | Previous state | Supply immutable `mcpConfigReceiptRef`, `sourceIndexReceiptRef`, optional `tunnelReceiptRef`, and exact `approvalRef`. |
| `payload.loads` | Runtime resolver | Bind those receipts plus exact knowledge, source files, commands, external resources, credential handles, and orchestration. |
| `payload.session` | Session runtime | Own input, output, scratch, and mandatory terminal retention. |

`payload.loads.artifacts` binds every non-null provided ref exactly once. `tunnelReceiptRef` is null only when the approved MCP config names an already-owned public boundary that requires no tunnel step; it is mandatory when that config requires a tunnel. `approvalRef` binds the exact publication plan, partitions, public routes, and allowed runtime/provider mutations. Knowledge is exactly the pinned `platform.mcp-publication` generation. Source access is restricted to declared hash-pinned files with `repositoryContext: false`. Commands are session envelopes, and external access is restricted to declared resource refs plus opaque credential handles; raw secrets are invalid.

Validate before resolving any load or performing any effect. No input field, loaded value, observation, command receipt, or evidence object may be persisted outside the task session.
