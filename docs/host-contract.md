# Host contract — Orca calls and agent cards

Everything StarCi knows about driving a coding agent on the Orca host is
**data** under `modules/`; the mechanism (`scripts/agent/lib.mjs`,
`scripts/api/orca/`) is agent-blind. There is no `providers/` registry: the
host contract and the per-agent cards are two ordinary module trees.

## `modules/host/orca/` — the typed host contract

`modules/host/orca/` is the typed contract behind every
`scripts/api/orca/` wrapper and every orchestrated call StarCi issues:

| Document | Contents |
| --- | --- |
| `index.yaml` | Hierarchy names (`[Kernel] <Workflow>`, `[Op] <operation> - <scope>`), environment binding, kernel and operation-agent call templates, routing rules, forbidden calls |
| `api.yaml` | The observed `orca agent-context` public-command inventory and the StarCi orchestration allowlist |
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
old Orca adapter-card fields at top level plus an optional `capabilities:`
key for agent-specific provider facts. Shipped cards: `devin`, `qwen`,
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
credentialRefresh: {win32: '…', posix: '…'}   # optional card-owned credential step
environmentStrip:                # vars removed INSIDE the terminal command
  - {name: ACP_BACKEND, reason: "…"}

commandRequirements:             # op-agent flags — always injected
  - '--permission-mode accept-edits'
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
  fileDirectory: .starciwork/_local/runtime   # delivered, then removed
  fileName: orca-dispatch-<dispatch>.md
  prompt: 'Read <file> completely. …'

submission:                      # proof the prompt was consumed
  stagedPattern: 'Pasted Content|<file>|orca-dispatch-'
  activityPattern: 'Thinking|Working|Running|esc to (?:cancel|interrupt)|tokens'
  settleMs: 3000
  timeoutMs: 45000
  maxEnter: 2

approvalMode:        {working: accept-edits, reasoning: accept-edits, reason: "…"}
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

capabilities:                    # optional — agent-specific provider facts
  …
```

## How `scripts/agent` consumes a card

`scripts/agent/spawn.mjs` is the thin CLI; `scripts/agent/lib.mjs` is the
mechanism (`spawnAgent({provider, worktree, title, prompt|promptFile, command,
kernel})`):

```text
loadAdapter(provider)            → parse modules/models/agents/<agent>.yaml
buildSpawnCommand(...)           → credentialRefresh[plat] + commandPrefix[plat]
                                   + command | commandRequirements
                                   (kernel → kernelCommandRequirements;
                                    native-managed → terminalFallback.command + bypassFlag)
terminalCreate(worktree, title)  → [Op] <op-id> / [Kernel] <workflow_id>
awaitReadiness(handle, card)     → screen must match readiness.screenPattern
                                   (+ identityPattern) inside timeoutMs
deliverPrompt(...)               → inline, or file-reference above maxInlineChars
awaitSubmission(handle, card)    → screen must show submission.activityPattern;
                                   re-enter while stagedPattern persists
```

`api dispatch --spawn` drives the same path. Auth or readiness/submission
failure means the job is **not** running — the reservation is settled and the
terminal closed (`spawn-failed`), never a ghost lease. `settle` closes the
worker terminal via the card's `release` block.

## Managed-agent dispatch (`kind: native-managed-agent`)

Claude and Codex are **native managed agents**: the host starts a supervised
worker — no terminal is created and no provider command is assembled. The
launch sequence (typed calls from `calls.yaml`, wrappers under
`scripts/api/orca/`):

```text
run-create(objective = workflow title)          → runId
task-create(run, spec = prompt/packet,
            displayName '[Kernel] <Workflow>'
            | '[Op] <operation> - <scope>')     → taskId
worker-start(task, worktree, agent = provider,
             model, effort, run)                → dispatchId
dispatch --return-preamble(task, to = dispatch) → preamble (prompt delivery)
worker-show(dispatch)                           → attestation: worker ready AND
                                                  effective agent/model match
```

Attestation is required before the seat is accepted — a worker whose
`startOptions.launch.effective` mismatches the resolved agent/model is fenced:
`worker-stop` then `worker-release` on the exact Dispatch, never a retry
beside it. On success the job's `worker_id` is the **Dispatch id**, and
`settle` releases it with `worker-stop` + `worker-release` (the
`settle-dispatch` recovery in `calls.yaml`).

The kernel seat follows the same rule. `start-workflow.mjs` resolves the
provider by precedence `--provider` > `config.yaml kernel.{provider,model,
effort}` > route-model, then reads the provider's card: `native-managed-agent`
launches the orchestration sequence above (the bound run/task/dispatch ids
persist in the kernel job payload); `command-terminal-agent` keeps the
terminal pipeline. A config pin whose provider probes `dead` in
`account list` (not authenticated) is ignored with a printed warning and
routing falls through to the next eligible pool — an unauthed pin never fails
the workflow.

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
