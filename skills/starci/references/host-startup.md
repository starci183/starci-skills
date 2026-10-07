# Host startup

Load this internal lifecycle through the public `starci` entry. The host startup
owner is `scripts/reconciler/start.mjs`; its service registry is
`scripts/reconciler/services.mjs`. Use the canonical Source and current project
binding. A caller route is declared ingress metadata; native worker attestation
proves the effective agent and concrete model.

Workflow ingress requires a concrete accepted goal and plan. `/starci` opens
read-only routing; its invocation alone approves no persistence or startup.
Resolve insufficient context and obtain actual owner approval before native
definition or launch. Preserve an existing accepted goal's identity, revision and
authority. Plain normal-context workflow wording creates no StarCi effects.

After acceptance, `starci workflow start` verifies the persisted goal before
host effects, heals the launcher shim and the Windows task registrations when they
are the only thing missing, ensures engine, configured services, public harness and
Supervisor without calling Kernel watchdogs recursively, then ensures caller-bound native
maintenance when `config.yaml` has `debug: true`. Missing caller context may reuse
an existing attested maintenance route; it cannot create or guess a route.
The Kernel's `--agent` remains its own override. Follow [Host credentials](../../../docs/host-secrets.md)
for the selected action's local inputs and native missing-input receipts.

The native launcher retains its existing singleton, quota, provider reservation
and unknown-effect fences. Before each new Kernel worker it creates or reuses the
exact Orca-owned workflow tree and installs through the native npmCi owner.
Installation failure retains that tree and refuses launch. A live Kernel return
does not reinstall or create another worker. Startup receipts prove host and
launch readiness; the Kernel's operations establish product delivery.

For an explicitly authorized host-only bring-up, run:

```text
starci reconciler up --caller-agent <agent> --caller-model <model> --caller-effort <effort> --json
```

## Status and heal on every invocation

Every `/starci` invocation runs `starci reconciler up --check --brief` first: the read-only checklist
in one screen, grouped, one line per row that is not green, each red row with its fix, one all-green
line otherwise. `--json` returns the same rows with a stable shape; a seat that is not running while
nothing needs it is a green row with `idle: true`.

A seat consumes provider quota. The Supervisor, core-debug and Kernel seats start only through
`starci workflow start`, `starci supervisor start` or an explicit owner request, so they read
`not running (starts with a workflow)` while no workflow runs and turn red only when a running
workflow needs them.

No-quota host services heal without the owner:

```text
starci reconciler up --services
```

It links the per-user launcher shim (`starci runtime link`), registers or refreshes the three Windows
tasks when one is missing or its action is stale (the script `starci task register <name>` prints, applied
non-interactively, per-user and limited-privilege), rebuilds a stale UI, starts the engine, harness UI,
harness tunnel, ask gateway and ask tunnel, and launches no agent seat. Each applied action is one line
(`linked launcher`, `registered task`, `service harness-ui`); a registration line carries the hash of the
script it applied. `starci task register <name>` without `--apply` stays the manual review path.

The two entry points, `starci reconciler up --check --brief` (status) and `starci reconciler up --services` (heal), are
idempotent, start no agent seat, use no provider quota and print the same text for the same state, so a poller may run
either on an interval; the heal applies nothing, and prints no APPLIED line, on a healthy host.

Use `starci reconciler up --check --json` for the machine-readable checklist. A
plain apply preserves local config. Profile changes, stale-ledger retirement and
other wider effects require their existing owner authority and explicit native
arguments. Orca remains owner-opened; do not launch or restart it from this entry.

Read the public harness endpoint from the service owner's tunnel configuration.
Healthy requires a nonredirected HTTP 200 and the actual JSON health contract,
including available machine/project databases. The server also requires its
served index and local module/style entry assets. A local listener, an arbitrary
HTTP answer or database availability alone does not establish public readiness.
Report actual red rows and their native receipts; never replace them with a
running claim or infer a successful launch from elapsed time.

`debug: false` starts no maintenance worker. `debug: true` uses the invoking
agent's declared route or the exact existing native maintenance route; it changes
neither the configured Supervisor pin nor the Kernel/operation model selection.
Maintenance and Supervisor retain their separate runtime-repair authorities and
cannot approve product goals or answer owner decisions.
