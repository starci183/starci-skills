# Host contract — Orca calls and agent cards

Everything StarCi knows about driving a coding agent on the Orca host is
**data** under `modules/`, in two module trees: `modules/host/orca/` is the
host contract and `modules/models/agents/` holds the per-agent cards. The
mechanism that reads them (`scripts/agent/lib.mjs`, `scripts/api/orca/`) is
agent-blind.

## `modules/host/orca/` — the typed host contract

`modules/host/orca/` is the typed contract behind every
`scripts/api/orca/` wrapper and every orchestrated call StarCi issues:

| Document | Contents |
| --- | --- |
| `index.yaml` | Hierarchy names (`[Kernel] <Workflow>`, `[Op] <operation> - <scope>`), environment binding, kernel and operation-agent call templates, routing rules, forbidden calls |
| `api.yaml` | The `orca agent-context` public-command inventory and the StarCi orchestration allowlist |
| `calls.yaml` | One typed entry per Orca call (`command`, `kind`, `flags`, `required`, `receipt`) plus the result-envelope and idempotency rules |
| `capabilities.yaml` | Supported host modes, roles and agent forms |
| `recipes.yaml` | Lifecycle sequences built from the typed calls |
| `validation.yaml` | Live-discovery and preflight contract — compare against `orca agent-context --json` and fail closed on mismatch |
| `envelopes.yaml` | The operation-input / report envelopes exchanged with agents |

`calls.yaml` is an **enforced** contract, not documentation:
`tests/provider-orca.spec.mjs` proves every `scripts/api/orca/terminal-*.mjs`
wrapper's verb and `--flag` set is declared by a `calls:` entry, and every
entry names a real, allowed command from `api.yaml`.

## `modules/models/agents/` — per-agent spawn cards

The contract an op or kernel is spawned through is the **agent card**:
`modules/models/agents/<agent>.yaml` (schema `starci/agent-card@1`) — the
Orca adapter-card fields at top level plus an optional `capabilities:`
key for agent-specific facts. Shipped cards: `devin`, `qwen`,
`claude`, `codex`.

The invariant: **no caller ever assembles an agent command by hand.**
`--yolo`, `--dangerously-skip-permissions`, credential prefixes and env strips
live only in the card, so they can never be forgotten.

## Card anatomy

```yaml
schema: starci/agent-card@1
agent: devin                     # binary/identity name
kind: command-terminal-agent     # how the host drives it
model: devin-agent               # logical model label (never inferred)

commandPrefix:                   # env prep + auth probe, per platform
  win32: '…'
  posix: 'command -v devin >/dev/null && env -u ACP_BACKEND devin models list … && '
credentialRefresh: {win32: '…', posix: '…', secretsFile?: '.secrets/<file>.env'}   # optional card-owned credential step;
                                 # <secrets-file> in a step is the runtime-root path of secretsFile (lib.mjs credentialRefreshCommand),
                                 # read inside the terminal's shell so no secret value enters the command
hostLaunchPrefix: {win32: '&', posix: 'command'}  # codex/claude: keep Orca's create on the runtime-owned PTY path
environmentStrip:                # vars removed INSIDE the terminal command
  - {name: ACP_BACKEND, reason: "…"}

commandRequirements:             # op-agent flags — always injected; no interactive command gate
  - '--permission-mode dangerous'
kernelCommandRequirements:       # kernel-terminal flags (--kernel selects these)
  - '--permission-mode dangerous'
kernelPermissionReason: "…"      # why the kernel lane gets wider permissions

readiness:                       # proof the TUI is at a prompt before send
  screenPattern: '(?:Ask Devin|Message Devin|…)'
  identityPattern: 'Devin'
  timeoutMs: 120000
  intervalMs: 5000

delivery:                        # how the prompt reaches the agent
  mode: file-reference-above-inline-limit
  maxInlineChars: 3000           # longer prompts are written to a file and referenced
  # fileDirectory unset → a fresh os.tmpdir staging dir; delivered, then removed
  fileName: orca-dispatch-<dispatch>.md
  prompt: 'Read <file> completely. …'

submission:                      # proof the prompt was consumed
  stagedPattern: 'Pasted Content|<file>|orca-dispatch-'
  activityPattern: 'Thinking|Working|Running|esc to (?:cancel|interrupt)|tokens'
  settleMs: 3000
  timeoutMs: 45000
  maxEnter: 2

approvalMode:        {working: dangerous, reasoning: dangerous, reason: "approved contract + owned-path lease are the boundary"}
kernelApprovalMode:  {working: dangerous, reasoning: "…"}

start:                           # the ordered host-API sequence
  - {api: terminal.create, binding: declared-target-command-after-auth-status}
  - {api: terminal.read, phase: readiness}
  - {api: orchestration.dispatch, binding: return-preamble}
  - {api: terminal.send, phase: submit}
  - {api: terminal.read, phase: submission}
  - {api: orchestration.dispatch-show, phase: assignee-attestation}
release: {api: orchestration.worker-stop, then: terminal.close}

knownFailures:                   # observed signals → meaning → action, dated
  - {signal: 'agent child exited: exit code: 0', meaning: …, action: …, seenAt: 2026-09-20}

verifiedAt: 2026-09-20           # when this card was last proven live
verifiedAgainst: 'devin CLI v3000.10.27'

forbidden:                       # things this agent must never be asked for
  - provider-native-subagent
  - reuse-existing-terminal
  - unsupervised-retain-as-success
  - inferred-underlying-model

capabilities:                    # optional — agent-specific facts
  …
```

## How `scripts/agent` consumes a card

`scripts/agent/lib.mjs` is the mechanism (`spawnAgent({provider, model, effort,
worktree, title, prompt|promptFile, command, kernel, dispatchId, attest})`),
called by `api dispatch`:

```text
loadAdapter(provider)            → parse modules/models/agents/<agent>.yaml
buildSpawnCommand(...)           → credentialRefresh[plat] + commandPrefix[plat] + hostLaunchPrefix[plat]
                                   + command | commandRequirements
                                   (kernel → kernelCommandRequirements;
                                    native-managed → terminalFallback.command + bypassFlag)
terminalCreate(worktree, title)  → [Op] <op-id> / [Kernel] <workflow_id>; a handle-less create
                                   with effectUnknown is reconciled by tab title against a
                                   before-snapshot: adopt one live match, close the rest
                                   (createRecovery in the dispatch/kernel event)
awaitReadiness(handle, card)     → screen must match readiness.screenPattern
                                   (+ identityPattern) inside timeoutMs
deliverPrompt(...)               → inline, or file-reference above maxInlineChars
awaitSubmission(handle, card)    → screen must show submission.activityPattern;
                                   re-enter while stagedPattern persists
```

Auth or readiness/submission failure means the job is **not** running — the
reservation is settled and the terminal closed (`dispatch-rejected`, per
`modules/kernel/api.yaml`), never a ghost lease. `settle` closes the
worker terminal via the card's `release` block.

The host launch is only the delivery half of the op lifecycle; the durable
record is the ledger's op IPC (docs/ledger-db.md §4a): `api dispatch` writes
the `contracts` row — the contract is the dispatch authority, the terminal
prompt or orchestration preamble only delivers it — the worker reads it via
`api op-contract` and files its outcome with `api report`; the kernel marks it
integrated with `api consume-report`, records its re-run via `api check`, and
`api settle` releases the leases, closes the seat and consumes the job's
report row (`reports.consumed_at`) as part of recording the verdict.

## Managed-agent dispatch (`kind: native-managed-agent`)

Claude operations are **native managed agents**: the host starts a supervised
worker — no terminal is created and no agent command is assembled. Codex
operations are not: `worker-start` has no approval/sandbox flag, so the codex
profiles are card-composed command terminals that launch with the codex card's
`bypassArgs`, the same command the Kernel terminal boots with. The
launch sequence (typed calls from `calls.yaml`, wrappers under
`scripts/api/orca/`):

```text
run-create(objective = workflow id + title,
           from = Kernel terminal)              → runId
task-create(run, spec = prompt/packet,
            displayName '[Op] <operation>')     → taskId
worker-start(task, worktree, agent, model,
             effort, run, from = Kernel)        → dispatchId + prompt delivery
dispatch-show(task)                             → exact agent terminal
worker-show(dispatch)                           → attestation: worker ready AND
                                                  effective agent/model match
```

`worker-start` owns Task dispatch/injection. Calling `orchestration dispatch`
again is a double-dispatch defect, not prompt-delivery verification.

Attestation is required before the seat is accepted — a worker whose
`startOptions.launch.effective` mismatches the resolved agent/model is fenced:
`worker-stop` then `worker-release` on the exact Dispatch, never a retry
beside it. On success the job's `worker_id` is the **Dispatch id**, and
`settle` releases it with `worker-stop` + `worker-release` (the
`settle-dispatch` recovery in `calls.yaml`).

The Kernel seat is different: `start-workflow.mjs` always launches one
dedicated attested Orca terminal and does not create a Run at boot. The first
operation lazily creates the workflow Run with that terminal as coordinator.
An explicit Kernel agent/model pin fails closed when unavailable; it is never
silently substituted.

Command-terminal operation agents still join the same semantic hierarchy:
the api creates the Task, creates and attests the exact terminal, calls
`dispatch --return-preamble` once, and sends that preamble. Their terminal
handle remains `worker_id` for cleanup while the Orca Dispatch id keys
contracts/reports. `api hierarchy` projects all launch kinds uniformly as
`workflow → Kernel → Op`.

## Checklist for a new agent card

1. Add `modules/models/agents/<name>.yaml` with every field above — a card
   without `commandRequirements` (or `terminalFallback`) yields no command and
   refuses.
2. Prove `readiness` and `submission` patterns against the real TUI; record
   `verifiedAt`/`verifiedAgainst` and every observed failure in
   `knownFailures`.
3. Keep dangerous/bypass flags only in `kernelCommandRequirements` where the
   kernel lane genuinely needs them — and justify in `kernelPermissionReason`.
4. Declare the `forbidden` list honestly; `spawnAgent` and the kernel packet
   enforce it.
5. If the card drives Orca calls the wrappers do not cover yet, extend
   `modules/host/orca/calls.yaml` in the same change — the parity spec fails
   on any wrapper flag the contract does not declare.
