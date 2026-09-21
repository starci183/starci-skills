# Dual-workflow Kernel reconciliation

Date: 2026-09-21

## Practiced

Drive two independent workflows in the same project ledger while repairing a
managed-worker startup failure. The public landing workflow and the Work/stacks
canonicalization workflow have separate approved goals and concrete owned
paths; sharing a ledger is not itself a conflict.

## Observed

- Codex desktop task/thread messaging did not wake the long-lived Kernels. It
  produced unrelated empty chat turns. Both Kernels were Orca PTYs and resumed
  only after `scripts/api/orca/terminal-send.mjs` addressed their attested
  terminal handles.
- Free-form append-only incident prose mentioned `codex` and `claude`. Routing
  treated those words as live provider outages and poisoned otherwise eligible
  pools.
- `survey` filtered `effect_unknown` with settled jobs. A Kernel therefore lost
  its quarantined launch from the open frontier even though exact path leases
  still existed.
- Both managed launches failed at `dispatch_input` with
  `agent_prompt_stalled`. `worker-show` proved `exactWorker:true`, state
  `failed`, terminal `connected:false`/`writable:false`, status `exited`, and no
  accepted contract or report. `worker-release` retained terminal bookkeeping
  only with `reason:identity_unproven` and `processAction:none`.
- On the next launch Orca accepted the prompt, but attestation falsely read
  effective agent/model as null. The receipt carried the exact values under
  `worker.startOptions.launch.effective`; the wrapper only inspected the
  legacy top-level `launch.effective` field and then stopped a healthy worker.
- Task rows correctly carried `display_name: [Op] scope.define`, while managed
  terminals inside the existing worktree still appeared as
  `worker-task_<task-id>`. Orca's worker-start creation labels do not rename
  that terminal surface.
- Retrying by creating a new job consumed logical attempts and left the old
  fence ambiguous. Reusing an attempt without host proof would also be unsafe.
- A healthy Kernel correctly yielded while an Op was active, but the durable
  report path only wrote a reports row. With no event wake, the completed Op
  could sit until the five-minute watchdog or an owner message woke Kernel.
- The stacks workflow reached `phase=running` with no open Op, lease or report
  after preflight proved a 70+ file closure. Status had no explicit projection
  for this orphaned technical frontier, and the driver treated the cut bound as
  requiring a new semantic work.author leg instead of bounded execution of the
  already approved code.refactor leg.
- After the seam cut launched, status correctly observed its worker at the
  provider input prompt, but Kernel still applied the ten-minute wedge clock
  and yielded. A turn-idle worker with no report is already actionable; age is
  irrelevant until the one bounded nudge has been attempted.

## Derived

1. Launcher chat, Orca host, agent adapter, concrete model, routing profile and
   runtime pool are separate identities. Durable workflow/terminal ids are the
   relay keys; titles and sidebar hierarchy are presentation only.
2. Provider routing consumes typed, expiring provider-health signals and quota
   receipts. Incident prose is never parsed as provider state.
3. `effect_unknown` is open state. It remains visible in `survey`, fenced, and
   ineligible for `route` until explicit reconciliation.
4. `api reconcile --job` may requeue the same job/attempt only when the exact
   managed dispatch has no contract/report and host receipts prove failure
   before model input plus process exit. `identity_unproven` is acceptable only
   as retained terminal bookkeeping after that exact exit proof.
5. A no-effect infrastructure refusal releases leases and does not consume the
   business attempt. Any incomplete proof preserves `effect_unknown` and the
   exact-path fence.
6. Multiple workflows in one ledger are admitted by normalized concrete
   owned-path equality/ancestor intersection, never by global same-ledger or
   same-repository exclusion.
7. Monitoring cadence detects silence; it does not repair state. A monitor
   polls through Kernel API projections and talks to a Kernel only through the
   canonical Orca terminal wrappers.
8. Managed-worker attestation reads typed identity from both the current
   `worker.startOptions.launch.effective` receipt and the legacy top-level
   launch field. Schema position drift must not be classified as a provider or
   model mismatch.
9. After dispatch-show resolves the exact managed assignee, the API applies
   `[Op] <op-id>` through the canonical terminal-rename wrapper. Task display
   name expresses semantic identity; terminal rename makes the same identity
   visible in the host UI.
10. `api report` commits the authoritative row first, then best-effort wakes the
    same turn-idle Kernel and records the wake receipt. The watchdog remains a
    missed-event/disconnection fallback; a transport failure never rolls back
    the report.
11. Status names `orphaned-frontier` whenever a running workflow has neither an
    open operation nor an unconsumed report. It is a technical repair signal,
    never workflow completion or an owner gate.
12. An oversized approved semantic op is executed as a stable, complete set of
    pairwise-disjoint same-op cut jobs. Cut identity/ordinal/total are durable
    job and packet context. This preserves the approved plan, keeps every
    worker within bounds and avoids both a mega-op and an invented semantic
    operation.
13. Status promotes any exact turn-idle/live-idle worker with no report to
    `frontier.state=worker-nudge-ready` and lists the exact job ids. Kernel must
    nudge those ids before considering a wait or wedge threshold.

## Evidence

- Regression suite: `.claude/tests/managed-dispatch.spec.mjs` covers incident
  text isolation, prompt-stall no-effect classification and late reconciliation.
- `.claude/tests/op-ipc.spec.mjs` proves report-filed wakes an idle Kernel only
  after the row is durable; `.claude/tests/kernel-api.spec.mjs` covers
  orphaned-frontier projection and persisted cut metadata.
- Live reconciliations preserved landing attempt 6 and canonicalization attempt
  2, released their exact-path leases, and resumed both existing Kernel PTYs.

## Open

- Observe whether Orca can eventually release the retained terminal-resource
  bookkeeping automatically after `identity_unproven`; it is not a live process
  and must not reacquire an operation lease.
