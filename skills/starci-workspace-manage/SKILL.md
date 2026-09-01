---
name: starci-workspace-manage
description: Manage runtime workspace identity, routes, sessions, conversation provenance, and portable checkpoints.
---

# Workspace manage

Verify one workspace boundary and route its typed outcome. Runtime Source configuration stays separate from project backend worktrees.

## Central local runtime

The Control Panel delegates exactly one task to own the shared local FE, API, and identity processes.
`.claude/config.yaml` supplies the StarCi Academy default `3000/3001/8080`. A different verified
project must use a closed owner `endpointBinding` resolved from its portable and hydrated workspace
routes, `.workspaces/ports/`, and routed backend metadata; never accept a caller-selected URL or
loopback port. Bind every authenticated Browser lease to that owner's project, application,
generation, endpoint fingerprint, and FE origin. A feature task is always a runtime consumer. Route
its health,
restart, or environment request to the declared runtime-owner task; never let it claim a port or
start, stop, restart, replace, or kill shared processes. Account and UAT isolation belong to the
Browser/session boundary, not to a server process. Only the Control Panel may create or replace the
runtime-owner task.
