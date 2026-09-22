# Supervisor round 1 — the digest as an instrument

Date: 2026-09-22

## Practiced

One chat supervised two live workflows — `wf-nivo-app-auth-mub1d7gs` (AUTH) and
`wf-nivo-workspace-provision-mub1hxxt` (WSPV) — through the post-outage
`iface-audit-round1` leg, using the `modules/supervisor/supervise.yaml` loop and
its digest command. The supervisor stayed an observer: it read the ledger,
classified what it saw, and relayed owner gates. No dispatch, no ledger write.

The session was the first time the digest was used against real traffic for
hours rather than to prove it prints. That is what surfaced the defects below:
the digest was accurate about rows and wrong about everything that needed a
second read — liveness, supersession, and provider health.

## Observed

- Two `dispatch-rejected` events for `claude-agent` at step `worker-start`
  carried `providerHealth: null`, an empty error string and `retryable: true`.
  The circuit only opened for a confirmed auth failure or a `readiness`
  timeout, so routing sent the next attempt straight back at the same pool.
  Compare `qwen-agent` in the same session: a readiness timeout emitted
  `provider-unavailable`, and routes rerouted to devin. Cost of each refused
  launch: roughly 2.5 minutes.
- The digest printed the last `ask-serving` URL with no probe. Port 6972 was
  claimed by two asks — `ctx_8aae35455211` (a dead round-2 pick form) and
  `ctx_e933f881dd98` (VNPAY, live). The ledger already knew the first was gone:
  `scripts/kernel/serve-ask.mjs` had appended `ask-serving-expired`, and nothing
  read it. `supervise.yaml` promised the opposite in prose — URLs "relayed only
  after re-verifying they answer 200".
- `ctx_c99ce0eb5cb8` sat in the digest as ASK-OPEN with zero events referencing
  it: a report row with `outcome='ask'` that a later ask replaced. There were
  only three ask event kinds (`ask-serving`, `ask-serving-expired`,
  `ask-answered`) and none of them means "retired", so a superseded question
  stayed open forever and remained relayable to the owner.
- Incident `report-contract-unbound` at 15:48: a `worker-start` rejection
  (`ctx_23ab47624016`) wrote itself into `jobs.payload_json.managed.dispatchId`
  with `rejectedBeforeContract: true` as evidence for reconcile, while the real
  retry ran under `ctx_26fa015cbb03` with its own `contracts` row. The readers
  that resolve a report's dispatch read `managed.dispatchId` and never checked
  the flag, so the worker's valid report was refused twice and a completed audit
  — verdict fail, 7 findings, a 22-file evidence bundle — was stranded on disk.
  One field carried two meanings; only a flag nobody read told them apart.
- A kernel that consumed a report and then yielded could be re-woken by nothing
  but the watchdog: one unsupervised process per workflow, which died in the
  outage. The race is inside the kernel's own turn — it decided to yield on a
  frontier view taken before its last transition.
- `poll.mjs` itself: `reportsSince` took `LIMIT 30` and filtered
  `report_id > since` afterwards, so an interval busier than one page dropped
  the oldest reports and moved the cursor past them permanently. Latest-event
  lookups ordered by `event_id`, a random token that orders nothing. The poll
  interval 180000 was written in three places. And the file was mechanism living
  under `modules/`, where contracts are data.
- `terminal-liveness` misread Devin TUI frames (`esc twice to interrupt`,
  braille spinner rows) as `turn-idle` at 13:23, 14:41 and 15:05, so a kernel
  mid-turn drew needless nudges. Fixed in `6279f4895` before this round closed.
- Healthy behaviour worth recording: provider failover worked as designed
  (qwen readiness timeout → `provider-unavailable` → reroute to devin); a bare
  "provided" answer on an OAuth ask did not survive presence verification (no
  Keycloak users, zero IdP logins) and was replanned to `uat.assisted`; codex
  correctly blocked on a missing target record where devin self-seeded, which is
  the contract's strictness doing its job. AUTH parked on two genuine owner
  gates, not a wedge.

## Derived

- **The digest is mechanism.** `poll.mjs` moved to `scripts/supervisor/poll.mjs`;
  `modules/supervisor/supervise.yaml` names it and holds no code. `reportsSince`
  filters in SQL (`WHERE report_id > ? ORDER BY report_id`), latest-event lookups
  order by `events.seq`, and the cadence has one home —
  `DEFAULT_INTERVAL_MS` in the script, which the contract cites.
- **A relayed URL is a probed URL.** `openAsks` tags every open ask
  `live | stale | dead | unserved`: a recorded `ask-serving-expired` newer than
  the last `ask-serving` is dead with no network at all, otherwise the URL is
  probed once per cycle. `supervise.yaml` now describes the tag instead of
  promising a re-verification that never ran, and the `owner-word` guardrail
  relays a URL only while it is `live`.
- **A replacement ask retires the one it replaces.** `serve-ask.mjs` appends
  `ask-superseded {dispatchId, by, opId}` for every earlier unanswered ask of
  the same (workflow, op) before it binds the new form; `--review` retires
  nothing. The four ask kinds, their payloads and which are terminal are
  documented once, in `modules/kernel/api.yaml` under `askLifecycle`.
- **An unclassified launch refusal is provider evidence.** `rejectDispatch`
  classifies a `worker-start` failure the host did not explain as
  `failureKind: 'worker-start'`. One refusal writes a durable strike that
  routing ignores; the second opens the typed circuit, so a flake never parks a
  healthy pool and a broken launch path is skipped. Both numbers are data:
  `modules/models/runtimes.yaml` `allocation.cooldownMs.worker-start` (120000)
  and `allocation.providerStrikes.worker-start` (2).
- **Evidence is not a binding.** A refused launch is appended to
  `payload.rejectedDispatches[] {dispatchId, step, at, effectState}` and
  `payload.managed` is left alone. `reportDispatchIdOf`,
  `explicitReportDispatchIdOf` and `requireDispatchedReportBinding` resolve from
  the `contracts` row for (workflow, op, attempt) — the row `api dispatch`
  writes before the job runs — and fall back to the payload only for an attempt
  with no contract, never to a rejected id. `cmdReconcile` reads the new array
  where it read the overwritten binding and marks the entry settled once it has
  proved no effect. The three refusals are documented as thrown in
  `modules/kernel/api.yaml`: `report-job-not-active`, `report-dispatch-unbound`,
  `report-contract-unbound`.
- **The kernel decides its own liveness.** The fix for the wake race is in the
  kernel, not in a second liveness actor: `modules/kernel/driver-loop.yaml`
  (`drive.wait`) and `modules/kernel/kernel-prompt.md` allow a yield only after
  an `api status` issued AFTER the last settle or consume-report answers
  `frontier.actionable: false`. `cmdStatus` projects that boolean plus
  `frontier.readyOperations`, because `engaged` conflated a workflow waiting on
  a live worker with one still holding queued jobs to dispatch or fenced
  launches to reconcile. The supervisor was deliberately NOT given the power to
  wake kernels — that would make it a second control plane, which
  `supervise.yaml`'s `shadow-orchestrator` failure mode forbids.
- **Where a practice log lives.** This entry is the log. The original file sat
  outside the runtime tree as `DEVIN_POLL_BUG.md`, where the next supervise
  round could not read it.

## Open

- **A1, producer-measured evidence.** `interface.implement` self-reports
  `E/measurements.json` and `interface.audit` verifies numbers the producer
  supplied. The decision is made and is not a patch: audit measures itself
  through the locked Playwright runner, and the producer's file is a
  cross-reference, never proof. See `fable.md`, "Quyết định của Fable" item 4;
  the `interface.audit.yaml` side is lane H's.
- **A8, codex audit lane without browser instrumentation.** The contract
  correctly refuses to substitute model judgement, but routing still spends an
  attempt discovering that. The mechanism exists (`interface.draw` already uses
  `route.riskHints: [host-tool-required:...]`); applying it to
  `interface.audit` plus the agent-card capability is lane H's.
- **A9, `op_id=null` on the kernel's own jobs row.** Verified cosmetic — the
  row is the kernel's lifetime row, not a zombie. Queries that filter on
  `op_id` miss it. Unscheduled.
- **Product findings B1–B8** belong to the audited product's `.starciwork`, not
  to this runtime: B1 nav dead zone 768–1119px, B2 dual `@starci/grammar`
  versions, B3 `paid` state never rendered, B4 `denied` bypasses EmptyNotice,
  B5 copy bypasses the i18n catalog, B6 status-badge hue collapse, B7
  offer-selection low-severity render defects, B8 absent runtime custody. They
  are repaired by a new `interface.implement` leg under the fixed evidence
  contract, not by a change here.
