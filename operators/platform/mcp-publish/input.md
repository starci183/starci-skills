# `platform/mcp-publish` input

This closed input publishes and proves only the already-declared MCP boundary. It is ephemeral task-session state and is purged with all loaded values and intermediates whenever the parent skill reaches a terminal state.

## JSON architecture

| Section | Owner | Purpose |
| --- | --- | --- |
| Root route | Skill machine | Accept only `platform.mcp.publish / ready` with `platform-source-index-ready`. |
| `payload.provided` | Previous state | Supply immutable `mcpConfigReceiptRef`, `sourceIndexReceiptRef`, and `tunnelReceiptRef`. |
| `payload.loads` | Runtime resolver | Bind those receipts plus exact knowledge, source files, commands, external resources, credential handles, and orchestration. |
| `payload.session` | Session runtime | Own input, output, scratch, and mandatory terminal retention. |

`payload.loads.artifacts` binds every provided ref exactly once. Knowledge is exactly the pinned `platform.operations` generation. Source access is restricted to declared hash-pinned files with `repositoryContext: false`. Commands are session envelopes, and external access is restricted to declared resource refs plus opaque credential handles; raw secrets are invalid.

Validate before resolving any load or performing any effect. No input field, loaded value, observation, command receipt, or evidence object may be persisted outside the task session.
