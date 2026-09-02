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

For authenticated local UAT, the Control Panel automatically provisions one fresh run-scoped account
in Keycloak and the application database, establishes an authenticated Browser lease, and returns only
opaque identity/provisioning references. Persist the non-secret account record in the canonical
`.worktrees/uat/<feature>/<flow>/snapshot.json`; keep generated credentials in ephemeral Control Panel
custody and never write them to UAT artifacts, session traces, chat, or feature-task state. A signed-out
consumer triggers auto-provision plus broker login, not a request for the user to authenticate.
If Browser safety mandates action-time confirmation for synthetic credential transmission, request only
permission for the Control Panel to perform that exact local submission; never ask the user to sign in,
reveal, paste, or handle the credential. Provisioner or broker failure returns `BLOCKED` with evidence.
