# Central local runtime ownership

| Field | Value |
| --- | --- |
| Knowledge ID | `workspace.central-local-runtime` |
| Owner | Control Panel through one delegated runtime task |
| Registry | `<project-backend>/.worktrees/sessions/central-runtime/owner.json` |
| Default endpoints | StarCi Academy FE `localhost:3000`, API `localhost:3001`, identity `localhost:8080` |
| Project endpoint authority | Verified workspace routes + `.workspaces/ports/` + routed backend `metadata.json` |

## One owner, many consumers

The local product runtime is shared infrastructure, not feature state. The Control Panel creates or
replaces exactly one runtime-owner task. That task alone may start, stop, restart, or replace FE/API
processes and coordinate identity-service health. Dashboard, Playground, Community, Personal
Project, Mock Interview, quality, and UAT tasks consume the same endpoints and communicate every
runtime request to the registered owner thread.

The three URLs in `.claude/config.yaml` are the backward-compatible StarCi Academy default, not a
universal port assignment. For another verified workspace project, the Control Panel owner supplies a
closed `endpointBinding` with project, application, FE/API/identity metadata service keys, and the
fingerprint of the exact workspace port projection. The resolver validates both portable and hydrated
FE/BE routes, calculates application and shared offsets, and cross-checks the routed backend's
`ports`/`portServices`. It accepts only origin-only `http://localhost:<canonical-port>` values. A free
URL, `127.0.0.1`, remote host, alternate application, undeclared service, stale fingerprint, or merely
listening port does not establish endpoint authority. The canonical Nivo core binding is
`webApp/api/keycloak` → FE `3067`, API `3068`, identity `8147`.

A feature task never owns a port, PID, server environment, or runtime lifecycle. `EADDRINUSE`, an
unexpected authenticated session, or an unhealthy probe is evidence to report, not authority to
kill, restart, or launch another server. The runtime owner may restart only after an explicit Control
Panel request or a verified service failure. It preserves the canonical checkout and must not use a
restart to switch UAT accounts.

## Identity isolation

Fresh UAT identity belongs to the account and Browser session. Multiple feature tasks may use
different run-scoped accounts against the same FE/API/identity services. Never bind one task's email,
password, cookie, or token into shared server environment. Never publish credentials in the registry,
runtime receipt, logs, source, or evidence.

Sequential read-only visual audits with the same required role may reuse one authenticated UAT-pool
context through a newly issued mission lease after the previous lease is released. The broker must
prove compatible role, locale, fixture visibility, origin, runtime generation, and expiry, then reset
browser-observable route/scroll/overlay state before re-leasing it. It must not inspect cookies,
tokens, passwords, storage, or autofill. Product UAT and any state-mutating or reset-sensitive flow still require
a fresh account/context. Reuse never transfers credentials or a tab to the feature task.

## Discovery and communication

## Browser lease execution

An opaque lease proves account/context ownership; it does not transfer an executable tab between
Codex tasks. A consumer may use `consumer-materialized` mode only after that consumer directly sees
the tab in its current Browser inventory and records an origin/principal-bound discovery proof. A
handoff URI, broker-held tab, queued `open_in_codex` call, or prior-turn tab ID is insufficient.

When materialization is unavailable or lost after an interruption, preserve the same authenticated
lease and switch once to `broker-executed`. The Control Panel Browser owner executes the consumer's
typed action/capture plan and returns opaque artifacts bound to mission, source fingerprint, runtime
generation, principal fingerprint, state, viewport, and capture time. The consumer owns UI decisions
and review; the broker owns only Browser execution. Do not retry symbolic handoffs, create another
account, or call the broker-held tab a consumer-visible handoff.

## Discovery and communication

The Control Panel registers the delegated task in the local-only runtime registry. The registry
contains its task ID, generation, current status, canonical endpoints, health evidence, and update
time; it contains no secret. Feature tasks resolve and validate this registry before local browser
work. A missing, invalid, stale, or non-ready registry yields one runtime-coordination request to the
Control Panel or registered owner. It does not authorize a replacement task or process mutation.

For a non-default project, every authenticated Browser lease carries the exact project, application,
owner thread, runtime generation, and endpoint-authority fingerprint and uses the owner's FE origin.
UAT case freeze also requires the exact ready owner artifact, health evidence, unexpired
`authenticated` lease, mission, and account. Removing the binding can fall back only to the legacy
StarCi Academy endpoint triple; it cannot downgrade a project-bound owner or lease to another port.

Owner replacement increments the generation and first stops or proves terminal the prior owner.
Only the Control Panel writes owner identity. The runtime task may update status and health evidence
for its own registered generation. Feature tasks are read-only consumers.

## Runtime states

- `starting`: the registered owner is establishing the shared services; consumers wait.
- `ready`: all declared endpoint probes pass; consumers may run.
- `degraded`: the owner remains live but one or more probes fail; consumers report affected work and
  wait for the owner's recovery receipt.
- `stopped`: no feature task may use or replace the runtime until the Control Panel delegates a new
  owner generation.

No feature audit may call a runtime `ready` because a port merely listens. The ready receipt binds
the registered owner generation, listener/process inventory, canonical commands or service identity,
and representative HTTP probes for all three endpoints.
