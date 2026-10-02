Owner: modules/host/
# Orca boundary: what the runtime keeps, wraps and reads by Dispatch

This page records where the runtime stops and Orca's standard API begins, for Orca 1.4.209. The source is the
C0 deep map (`orca-deep-map.md`, rows by ID). It covers three sets:

- the **KEEP** rows: Orca lacks the capability, or its semantics would break a runtime guarantee;
- the **WRAP** rows: the runtime calls Orca through a thin adapter in `scripts/api/orca/` and keeps only a stated policy;
- the worker-handle census (coordinator item 11): every `terminal` read on a worker handle, and whether it became
  `worker-read`.

The REPLACE rows are not listed here, except the two that lane SETTLED landed (the last section). Each one deletes runtime code once it lands, and its contract-change entry
records it. Read `host-contract.md` for the call contract (`modules/host/orca/calls.yaml`).

## KEEP: the runtime's own mechanisms, and why

| ID | Mechanism | Why it stays |
|---|---|---|
| T6 | Screen-proven wakes and nudges (`kernel/wake-delivery.mjs`, `starci kernel nudge`, `agent/lib.mjs` delivery, `terminal-send` Enter retry) | Orca proves `turn_started` only on hosts with prompt receipts, and a mailbox `send` is a durable enqueue with a best-effort wake. Only the frame proves that a turn began on Codex and Devin (the 2026-09-23/24 incidents). Smoke E6 (live, Orca 1.4.209, 2026-10-02) settled it: `orchestration send --to dispatch:<id>` to an idle worker that already sent worker_done is refused `dispatch_inactive` ("Dispatch <id> is completed; its worker will never read that mailbox. Send to run:<id> instead, or start a new Dispatch for follow-up work."). A worker is re-engaged only through the terminal (`terminal send` with Enter) or a new Dispatch, so this row stays. No runtime caller issues `send --to dispatch:`. |
| T7 | `terminal-rename` with the `[Op]`/`[Kernel]` title | `--display-name` names the Task, not the tab. This is presentation; the handle comes from the start receipt. |
| M3 | Decision Items plus the doorbell | DIs carry the decider, escalation and claims. Orca's `send` is transport only (the doorbell follows T6). |
| M4 | Peer messages between workflows (`starci kernel notify`/`starci kernel inbox`) | Peer-wait gating and dispositions are ledger semantics, and the Kernel never calls Orca. |
| M5 | Owner and Supervisor channel (`supervisor/channel.mjs`, `tell.mjs`, Telegram) | The owner's desktop chat and Telegram are not Orca terminals. An Orca `ask` never reaches the owner. |
| D1 | The ledger work graph (generations, cuts, path leases, goal revisions, cross-workflow waits) | Orca Tasks have plain deps only. Mirroring the graph into Orca would be new code for sidebar display. |
| G1 | Decision Items (`decision_items`, `sup_decision_items`, the escalation ladder) | Orca gates are Task-scoped and can be resolved by any coordinator. They have no decider class, due date, escalation, claim or evidence, and most DIs have no Task. |
| G2 | Owner asks (`serve-ask.mjs`, `ask_requests`, `owner-answers.mjs`) | An Orca `ask` or `reply` reaches only the coordinator, never the owner. |
| G3 | Owner gates and typed waits holding queued jobs | Ops have no Task until dispatch, so an Orca gate has nothing to block. |
| G4 | The land gate (`supervisor/land.mjs`, `land_queue`, the host lock) | Orca has no equivalent (a detached cherry-pick base, checks on the candidate, owner authority). |
| R3 | Run accumulation | Orca has no run close or archive. Nothing to delete; every query is Run-scoped. |
| WT3 | Runtime-internal scratch trees (land, push, verify-proof) | Orca's `worktree create` always makes a branch and runs setup hooks. The land gate needs a detached tree that one process creates and removes, with no agent. |
| AU1 | The reconciler cadence (`schedules`, single leader, crash reclaim) | Orca automations run an LLM prompt per run. The duties are deterministic node steps, many below one minute. |
| AU2 | Host boot (`reconciler/boot.mjs` scheduled task, `services.mjs`) | Orca must itself be up, and automations do not launch services (Windows). |
| AU3 | The owner digest and urgent pushes (Telegram) | Orca has no owner notification channel. |
| AC3 | Devin quota probe (`api/quota/devin.mjs`) | Orca manages Claude and Codex accounts only. |
| AC4 | Account selection and rotation | Orca has `account add` and `account list` only. Nothing to build. |
| RR3 | Host outage tolerance (`hostUnavailableOf`, `awaitOrcaHost`) | A CLI that cannot spawn cannot answer. Orca's auto-update replaces `orca.exe` and answers `runtime_unavailable` for about a minute (Windows). |
| O1 | The live CLI drift check (`calls.yaml` `liveSchema`, `checks/providers.mjs --live`) | It consumes Orca's `agent-context`; it is the check that keeps the adapters honest. |
| O2 | Launch trust (`agent/trust.mjs`) | Orca has no provider project config, Devin model pin or guard hooks. |
| O3 | Remote placement (`calls.yaml` forbids `--on`) | The host is a single Windows machine. If remote placement is ever used, route by Dispatch id. |
| O4 | Depth budget | Orca refuses nesting past its limit with `nested_worker_depth_exceeded`. The runtime has no mechanism to delete; the limit belongs in the launch preflight later (smoke E5 measures it). |

## WRAP: thin adapters, one reason each

Each adapter carries a one-line `// Deep map WRAP <IDs>: <reason>` comment naming its row.

| ID | Adapter | What stays the runtime's |
|---|---|---|
| T2 | `terminal-show.mjs`, `terminal-read.mjs` | The frame classifier, for turn-idle versus active, a staged draft and provider rate-limit text. The death verdict moves to `worker-list` `exited`. |
| T5 | `terminal-list.mjs`, `terminal-close.mjs` | Closing tabs that Orca restored and no ledger binds. Ownership of worker terminals comes from `worker-list`. |
| W2 | `worker-show.mjs` | The route-versus-effective attestation policy. The data is Orca's `startOptions.launch.effective`. |
| W3 | `worker-start.mjs` | Running the receipt's recovery argv, and the ledger's no-effect proof. |
| W6 | none yet | When the ledger fences `effect_unknown`, the attempt should also be `worker-abandon`ed. There is no adapter yet; adding one is pending. |
| W7 | `worker-show.mjs`, `worker-list.mjs` | The seat state machine (parked, quarantined, replacement rate limit, `kernel_rev` ack). The death proof is a positive `exited`. |
| A2 | `worker-list.mjs` | The admission policy (fair-share slots, hysteresis, RAM throttle). The live count is Orca's. |
| M2 | `reply.mjs` | The ledger disposition of a worker question. |
| M6 | `worker-show.mjs` | Lease renewal from `dispatch.lastHeartbeatAt`. |
| R1 | `run-show.mjs`, `run-use.mjs`, `run-create.mjs` | The rebind-once guard, because a repeated `run-use` fences live consumers. |
| R2 | `run-create.mjs`, `worker-start.mjs` | Which Run a seat or [Worker] launch reuses. |
| WT1 | `worktree-create.mjs`, `worktree-list.mjs`, `worktree-rm.mjs` (scripts/api/orca/) and `scripts/machine/worktree-orca.mjs` | The per-repo cap, the ownership registry, links-first removal and the main-checkout assertion. |
| WT5 | `worktree-ps.mjs` | Merged, clean and idle stay git facts. The owner test reads Orca resources, not titles. |
| WT6 | `worktree-rm.mjs`, `worktree-remove.mjs` | The branch-deletion fallback. Orca deletes a branch only when it proves the merge. |
| P1 | none yet | The workspace binding keeps sides and the work path. Resolving the checkout through Orca's project setup is pending (no `project setups` adapter yet). |
| P2 | `repo-add.mjs` | It runs only on `repo_not_found`, inside the runtime's create. |
| AC1 | `account-list.mjs` | The quota circuit. |
| AC2 | `account-list.mjs` | The credential fingerprint policy. |
| RR2 | `worker-start.mjs` | `--retry-of` is for a same-attempt infra retry only. A semantic retry (new model, new packet) stays a new Task, or Orca's three-strike breaker would fail it for good. |
| RR4 | `worker-stop.mjs` | The no-effect proof on owned paths, and the settle. Orca proves the exit. |
| RR5 | `worker-read.mjs` | The sink: Orca's archive is unredacted and on Orca's retention, so the blob store plus `redact.mjs` stay. |
| RR6 | `worker-read.mjs` | Moving the session file stays. Identifying the session from Orca's transcript source instead of content scanning is pending (`kernel/op-session.mjs`). |

## Worker output and worker handles (deep map T1, coordinator item 11)

Orca 1.4.209 states that not every worker has a terminal and that `orca terminal` verbs do not accept every worker
handle; `worker-read --source auto` always works. A worker's **output** is therefore read by Dispatch only:

- `scripts/api/orca/worker-read.mjs` `workerRead` reads one page; `scripts/machine/worker-output.mjs` `workerOutput` follows the top-level cursor
  unchanged until a page is empty, and restarts once without the cursor on `source_changed`. Its `contentComplete`
  is true only when every page said so; `clipping` is kept.
- `starci kernel observe` returns `output` (read by the job's Dispatch). The turn state is still classified from the frame (T2).
- `kernel/transcripts.mjs` reads attempt snapshots, the final transcript and Kernel/Supervisor seat snapshots by
  Dispatch. The seat's Dispatch is `seats.detail_json` `value.dispatch`. Every stored text starts with a header line
  that carries `contentComplete` and `clipping`.
- `close-op-terminal.mjs` and `quit-agent.mjs` read no output. Settle captures the output by Dispatch before an
  unmanaged terminal is closed, and after a managed worker's release (Orca serves the archive).

The **frame** reads that remain on worker handles cannot become `worker-read`. In 1.4.209, `worker-read --source
terminal` serves the terminal's stream tail plus its draft (`runtime.readTerminal`), not the rendered screen that
`terminal read --screen` returns, and the classifiers match rendered frames. A worker without a PTY answers
`terminal_unsupported_for_agent_session`. That code is not in `TERMINAL_GONE_CODES` (only `terminal_handle_stale`
is), so such a worker reads unverified, never dead.

| Site | Fact read | Row | Disposition |
|---|---|---|---|
| `kernel/transcripts.mjs` (was `readScrollback`/`captureTerminal`) | output | T1 | replaced by `worker-read` |
| `kernel/api-verbs/observe.mjs` | output, and the frame for the turn state | T1, T2 | output replaced by `worker-read`; the frame stays |
| `kernel/close-op-terminal.mjs` capture, `kernel/quit-agent.mjs` capture | output | T1 | deleted; settle reads by Dispatch |
| `kernel/verbs/settle.mjs` (connected after close) | PTY state | T3 | done (alpha.5, lane ORCA): a worker's close is `worker-release` followed by the runtime's terminal close and process-tree proof (`scripts/machine/worker-close.mjs`, the one close path); the command-terminal path is deleted |
| `kernel/cli.mjs` `quitWorkerTerminal`, the quit input, the tab close, the process reaper, `closeDeadWorkerTerminal` | PTY state | T3, T4, D2 | done (alpha.5, lane ORCA): the quit input and the name-matching process reaper are deleted; the one close path (`scripts/machine/worker-close.mjs`) releases, closes the terminal and proves no process of that terminal's shell tree remains. `custody` is the release receipt's state, with one terminal READ-back (disconnected or gone proves release) when Orca answers retained for a dead worker |
| `kernel/cli.mjs` status liveness and prefetch; `reconciler/controllers/job.mjs` worker-health; `reconciler/services.mjs` seat turn; `supervisor/poll.mjs` `kernelState`; `supervisor/stall.mjs` `kernelTurnState` | frame classification | T2 | WRAP: the frame stays for turn-idle and rate-limit; the death verdict moves to `worker-list` |
| `kernel/host-outage.mjs` `kernelTerminalVerdict`; `kernel/kernel-watchdog.mjs`; `supervisor/supervisor-watchdog.mjs`; `kernel/cli.mjs` Kernel seat gone check | seat liveness | W7, T2 | WRAP: the death proof moves to `worker-list` `exited`; the seat state machine stays |
| `kernel/close-op-terminal.mjs` `closeExitedTerminal` | exited-shell proof | T2, T3 | WRAP until lane SETTLED moves worker closes to `worker-release` |
| `kernel/terminal-dedupe.mjs`; `supervisor/start-supervisor.mjs` seat dedupe | restored-tab frames | T5 | WRAP |
| `kernel/wake-delivery.mjs`; `kernel/clear-draft.mjs`; `agent/lib.mjs` prompt delivery | frame and draft as proof of a turn | T6 | KEEP |
| `kernel/op-session.mjs` (terminal still open before the session archive) | PTY state | RR6 | WRAP, pending the transcript-source identity |
| `lib/close-verify.mjs` | PTY state after a close | T3 | non-worker terminals stay; worker paths go with lane SETTLED |
| `reconciler/controllers/gc.mjs` screens | frame | A1 | lane WLIST (worker accounting through `worker-list`) |

## REPLACE rows landed by lane SETTLED (guarded by smoke E3)

| ID | Was | Now |
|---|---|---|
| W4 | Settle, finish, `reconcile --release-worker` and the [Worker] report ran `worker-stop` + `worker-release`, then close, then reap | `starci kernel report` (in the op's pane) sends one `worker_done` through `scripts/api/orca/send.mjs`; settle reads the Dispatch (`worker-show`) and closes the worker through `scripts/machine/worker-close.mjs`: `worker-release`, the terminal close and a bounded proof that no process of the terminal's shell tree remains. `worker-stop` is only the fallback for a Dispatch that did not settle. |
| D2 | One Task per op attempt, closed by hand (`closeOperationTask`, `staleTasks`, `reconcile --orca-tasks`, the gc tasks collector) | The `worker_done` settlement closes the Task. All four are deleted. |

### Known limits that stay (alpha.5)
- `worker-release` alone does NOT end every agent: live smoke E1 proved it for claude, codex and devin, never for cursor, and a released cursor worker kept its
  `cursor-agent` process running (about 11,200 CPU seconds, 2026-10-02 19:25 to 23:27). Every worker close therefore goes through `scripts/machine/worker-close.mjs`: release, terminal close, and a
  bounded proof that no process of that terminal's shell tree remains (membership is proven by the `ORCA_TERMINAL_HANDLE` the process inherited, never by name); a survivor is stopped only on that
  proof and raises the host-hygiene finding `worker-process-survived`, which never changes the worker's outcome. The Kernel's own close, the GC's leftover sweep and the host controller's
  replaced Kernel close their terminals through `close-verify` (terminal-level proof).
- The terminal of a worker is read from worker-show (`result.dispatch.assigneeHandle`): the live start receipt has no `result.worker`.
