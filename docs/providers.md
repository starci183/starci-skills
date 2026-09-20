# Providers — adapter cards

Everything StarCi knows about a coding-agent provider is **data** under
`providers/`; the mechanism (`scripts/agent/lib.mjs`) is provider-blind. The
contract an op or kernel is spawned through is the **adapter card**:
`providers/orca/adapters/<provider>.yaml` (schema
`starci/orca-agent-adapter@1`). Shipped cards: `devin`, `qwen`, `claude`,
`codex`.

The invariant: **no caller ever assembles a provider command by hand.**
`--yolo`, `--dangerously-skip-permissions`, credential prefixes and env strips
live only in the card, so they can never be forgotten.

## Card anatomy

```yaml
schema: starci/orca-agent-adapter@1
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

bypassMode:                      # how to unstick a permission menu / run headless
  interactive: 'send "5" + Enter (switch to bypass mode)'
  headless: 'devin -p "<prompt>" …'

knownFailures:                   # observed signals → meaning → action, dated
  - {signal: 'agent child exited: exit code: 0', meaning: …, action: …, seenAt: 2026-09-20}

verifiedAt: 2026-09-20           # when this card was last proven live
verifiedAgainst: 'devin CLI v3000.10.27'

forbidden:                       # things this provider must never be asked for
  - provider-native-subagent
  - reuse-existing-terminal
  - unsupervised-retain-as-success
  - inferred-underlying-model
```

## How `scripts/agent` consumes a card

`scripts/agent/spawn.mjs` is the thin CLI; `scripts/agent/lib.mjs` is the
mechanism (`spawnAgent({provider, worktree, title, prompt|promptFile, command,
kernel})`):

```text
loadAdapter(provider)            → parse providers/orca/adapters/<provider>.yaml
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

## The wider provider tree

The adapter card is the spawn contract; sibling files are provider facts used
for validation and routing: `providers/catalog.yaml` (host-mode router +
contract references), `providers/<name>/{index,capabilities,api,recipes,validation}.yaml`,
`providers/common/envelopes.yaml`, and `providers/validate.mjs` (fail-closed
cross-contract validation). Provider facts are data only — resolve live
command signatures from the provider's own runtime output immediately before
effects and fail closed on mismatch.

## Checklist for a new provider

1. Add `providers/orca/adapters/<name>.yaml` with every field above — a card
   without `commandRequirements` (or `terminalFallback`) yields no command and
   refuses.
2. Prove `readiness` and `submission` patterns against the real TUI; record
   `verifiedAt`/`verifiedAgainst` and every observed failure in
   `knownFailures`.
3. Keep dangerous/bypass flags only in `kernelCommandRequirements` where the
   kernel lane genuinely needs them — and justify in `kernelPermissionReason`.
4. Declare the `forbidden` list honestly; `spawnAgent` and the kernel packet
   enforce it.
