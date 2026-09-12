# Provider observation

A supervised operation runs inside an agent's own TUI, so the only honest statement about its liveness is the
one its screen makes. Until 5.0 that reading lived in the wait tick as a single union of regexes — Claude's
`esc to interrupt` next to Qwen's `Allow execution`, one hard-coded `1` for every confirmation dialog — which
meant that adding a provider meant editing the kernel, and that a dialog was answered with a keystroke the
provider might not understand. `execution/provider-observe.mjs` holds that knowledge per provider family
instead, and `execution/orca-protocol.mjs` consumes it: `classifyWorker` is now the protocol-side name for
`observe`, and the tick sends the keystroke the observed family declares.

## The signature table

`SCREENS` has one row per family — `claude`, `codex`, `qwen`, `shell` — and each row says what that family
renders in each phase, what accepts its confirmation dialog once, and how it can be recognized.

| family | busy | idle | confirmation prompt | answer |
| --- | --- | --- | --- | --- |
| `claude` | `esc to interrupt` | a bare `❯` line, `bypass permissions on` | `Do you want to proceed?`, `Allow … once` | `1` |
| `codex` | `esc to interrupt`, `Working` | `› Ask Codex`, `Type your message` | `Allow …? (y/n)`, `Approve` | `y` |
| `qwen` | `esc to cancel`, `Thinking…` | `Type your message or @path` | `Allow execution`, `Waiting for user confirmation`, `(y/n)` | `1` |
| `shell` | — | a trailing `PS …>`, `$`, `#` or `%` prompt | `(y/n)`, `[Y/n]`, `[y/N]`, `Overwrite?` | `y` |

Two kinds of marker identify the family. `detect(screen)` reads the footer the provider owns: `bypass
permissions` or `Claude Code` for Claude, `Ask Codex` or `OpenAI Codex` for Codex, a `qwen3…` model marker or
the `Token Plan` account line for Qwen. `terminalTitleHints` reads the terminal title instead, so a screen
whose footer has scrolled away is still placed: `✳ Qwen - sales` is Qwen, `Report task outcome` and any title
naming Codex is Codex, `PowerShell - …` is a shell. The screen outranks the title, because Orca re-canonicalizes
a title to the task name and a title can outlive the agent that was started under it; an explicit `provider`
argument outranks both, and an unknown name falls back to the scan rather than failing.

Families overlap on purpose — Claude and Codex share `esc to interrupt`, Qwen and a shell share `(y/n)` — so
when nothing names a family, `observe` scans `SCAN_ORDER` (`claude`, `codex`, `qwen`) phase by phase: every
family's prompt signatures first, then every family's busy signatures, then idle. A dialog is therefore never
read as work, and the family that matched is the family whose keystroke gets sent. `shell` is deliberately out
of that scan: a bare prompt character and a `(y/n)` tail are too common to classify an unknown agent screen by,
so a shell row is only used when the caller or the title selected it. Codex's generic `Type your message`
placeholder carries a negative lookahead for Qwen's `or @path`, so an untitled Qwen screen keeps its own
identity.

## observe

`observe({screen, terminal, now, stalledAfterMs, reported, provider})` returns the verdict the wait tick
already consumed — `liveness` in `dead | reported | rate-limited | stalled-prompt | working | stalled-idle |
stalled-silent` with a `reason` — plus `provider` (the family the verdict came from, or `null`) and `answer`
(that family's accepting keystroke, or `null`). `screen` may be the tail array that `terminal read` returns or
one joined string; both are the same text.

The precedence is fixed, and facts come before text. A terminal that is not listed, or listed as exited or
closed, is `dead` whatever its last screen said. A written report file means the operation ended, so `reported`
wins over a stale dialog or refusal still visible on the screen. Then the provider's own refusal
(`rate-limited`, see below), then the phase signatures, and only then silence: a screen no family claims and no
output for longer than `stalledAfterMs` is `stalled-silent`, and anything else is `working` with the reason
`recent output`, which is what the tick's heartbeat rule looks for.

In the tick, three things follow from this. The auto-answer sends `verdict.answer` instead of a hard-coded `1`,
and records the family and keystroke it used in `approvals`; the re-read after the answer is classified with
the same family pinned, so a cleared dialog cannot be re-identified as another provider; and `rate-limited`
joins `stalled*` and `dead` as a boundary, because a parked runtime is worth returning for immediately rather
than at the end of a fifteen-minute wait. The tick's `next` line for that event tells the kernel to park the
runtime with `allocator.failed` and re-dispatch the operation elsewhere.

## Rate-limit signals

`rateLimitSignal(screen)` returns `null` or `{kind, text}` with `kind` in `http-429`, `rate-limit`,
`overloaded` or `quota`, matched in that order, where `text` is the matched fragment so the reason line quotes
what the provider actually said. It covers a bare `429`, rate-limit and `too many requests` and
`resource_exhausted` wording, `overloaded` and `server is busy`, and quota, `insufficient_quota`, `billing` and
`credit balance`. This is a deliberately sensitive reading: the cost of missing a refusal is an operation that
burns its whole wait window against a provider that will not answer, while the cost of a false positive is one
op re-dispatched to another runtime. `kind` is passed on as the failure reason, which is what
`execution/runtime-allocator.mjs` classifies into a cooldown, so a quota lockout cools longer than a burst.

## Token accounting

Liveness says whether a provider is working; the budget needs to know what it charged. `runHeadlessWithUsage(provider, prompt, options)`
runs a headless provider and returns `{text, usage}`, where `usage` is `{input, output, total, cost}` or `null`.
`runHeadless` keeps its old contract — it returns the answer string — so every existing caller is unchanged;
it is now a one-line wrapper over the usage-returning call. Usage is telemetry, never a contract: it is parsed
from the same stdout the answer came from, and a parse that fails or finds nothing yields `null` instead of
failing a valid answer.

Each provider reports it differently. Claude prints one envelope: `usage.input_tokens`, `usage.output_tokens`
and the priced `total_cost_usd`; because Claude bills cache writes and cache reads as input,
`cache_creation_input_tokens` and `cache_read_input_tokens` are folded into `input` so the budget sees what the
call actually cost. Qwen prints an event list that may carry a per-event `usage` object or a final `stats` tree
with one token block per model (`prompt`, `candidates`, `total`); the per-model blocks are summed when they are
present, and a run that reports neither yields `null`. Codex streams JSONL in which `token_count` carries a
cumulative `total_token_usage` while a turn event's `usage` covers one turn only: the cumulative number wins
when it appears, and otherwise the per-turn records are summed, so the same stream is never counted twice.

`callFunction` adds the usage of every attempt it paid for — including the invalid ones that were sent back to
the model for a correction — and returns it as `usage` on both the successful and the exhausted result, so
`assessGoal`, `planOp` and `decide` all carry what they spent. A caller that injects a plain string-returning
runner (as the unit tests do) simply produces `usage: null`.

The kernel is what turns that into budget. `execution/runtime-allocator.mjs` charges tokens when a slot is
freed, so an operation that finished hands the total it spent to `release`, and a failed one hands its total to
`failed` with the reason:

```js
const call = assessGoal({job, inputs, material, providers, cwd});
allocator.release(runtime, {tokens: call.usage?.total ?? 0});
```

`tokens` is a count, not a cost: `usage.total` is the number the daily `tokensPerDay` budget is measured in,
while `usage.cost` is reporting only and is summed across attempts when the provider priced them. Usage of
`null` means the provider said nothing, and `0` is then the honest charge — the allocator still frees the slot
and still counts the operation against `opsPerDay`, so an unreported call cannot make a runtime look free
forever.
