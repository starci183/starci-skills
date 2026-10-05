# Start an approved workflow

This internal procedure follows an explicitly selected StarCi entry or an authorized native StarCi
job contract. It boots the one long-lived [Kernel] for an already-persisted, accepted goal.

Contract: `modules/kernel/start-workflow.yaml`.
Executable: `scripts/kernel/start-workflow.mjs`.
Host readiness: `.starci/host/startup.md`.
Optional runtime maintenance: `.starci/host/maintenance.md`.
Local action credentials: [Host credentials](../../../docs/host-secrets.md).

## Approval and identity

Resolve Source, the host owning `.claude/CONTEXT.md`, separately from the project ledger owner
and selected goal's `workflowId`. Read the persisted goal revision, identity, plan and phase through
the native goal/status surfaces. A missing or unclear goal returns to `define-goal.md` for read-only
assessment and the owner's acceptance; do not create a ledger merely to preview startup.

Present the exact intended start with the goal draft and derived operation plan. Start only after the
owner accepts this scope, including the startup effects. An existing unchanged acceptance already
covering startup is sufficient; do not ask again. A revised goal or plan needs a new acceptance.
The startup executable's `--plan` path is not a read-only intake preview: it may open the ledger.
Use `starci workflow define --plan` for an unaccepted goal preview instead.

After acceptance and native persistence:

```
starci workflow start --repo <project-owner-repo> --goal <workflowId> --caller-agent <codex|claude|devin> --caller-model <concrete-model-id> --json
```

Use the native lifecycle's caller identity and model contract. Never infer a caller model from a
routing pool or from another actor's configured model. Workflow ingress validates the accepted
persisted goal before host readiness, maintenance, inbox claim, dependency installation, worktree
creation or Kernel launch. Host readiness and configuration-selected maintenance belong to that
lifecycle; this entry creates no extra loop or maintenance agent.

`--caller-agent`, `--caller-model` and optional `--caller-effort` describe this ingress caller and are
separate from the Kernel's explicit `--agent`/`--model` pin. If the caller's effective concrete model
cannot be established, report that missing provenance; do not invent a pin. A repair uses the native
persisted live caller route. Argument parsing accepts split or equals forms and stops at bare `--`.

Report the actual launch receipt: outcome, workflow identity, Kernel Dispatch and terminal handle,
and attested execution agent and concrete model. An unavailable explicit pin or mismatched effective
model is a typed failure. Do not substitute another execution adapter or claim activation from a plan.

## Native lifecycle boundaries

- A live Kernel refuses a duplicate; a proven ended seat may be rebound to the same workflow.
- Codex, Claude and Devin chats are ingress launchers; Orca is the execution host. The native
  launcher creates the Kernel's entry Run and starts an attested worker. Every ephemeral Op is
  dispatched by the Kernel in its workflow Run. Never launch a terminal as an alternative.
- One workflow owns one native-created worktree. The launcher performs real dependency installation
  in that tree; do not link another checkout's dependencies. Ops run there and native green settles
  create checkpoints. Finish and host release own land and cleanup; do not remove the tree by hand.
- `agent` is an execution adapter, `model` a concrete id, `profile` a routing target, and
  `runtimePool` a capacity window. Explicit pins fail closed and must match worker-show attestation.
- A finished goal does not re-enter the queue. Revisions use the goal contract rather than creating
  a second workflow to repeat the same goal.
- The Kernel mutates workflow state only through `starci kernel <verb>` under
  `modules/kernel/api.yaml` and `modules/kernel/driver-loop.yaml`. Give it no direct-ledger or
  operation-level instructions. The Host controller owns seat repair; a monitor starts no cadence.
