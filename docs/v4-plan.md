# StarCi 4.0 plan: orchestration that cannot silently fail

Status: proposal, not accepted. Written 2026-09-12 against runtime `3.0.0-alpha.3`
(`.claude` branch `codex/host-bootstrap-routing`, head `c45997b8`, 738/738 tests green)
and Orca app `1.4.188` (`agent-context` schema 1, 232 commands).

## 1. Why 4.0

Three observed failure classes stop orchestrated mode today. None is a product defect.

| # | Observed (reproducible) | Where it lives now | Root cause |
| --- | --- | --- | --- |
| F1 | `worker-start --agent qwen-code` boots a branded Qwen TUI, then fails at `dispatch_input` with `agent_prompt_stalled` / `session_not_reported`; retries create idle duplicate terminals. | `docs/orca-runtime-upgrades.md`, `providers/orca/adapters/qwen.yaml` | Orca's Qwen adapter uses `stdin-after-start` prompt injection; Qwen 0.23.3 expects an interactive startup prompt. StarCi cannot fix Orca, but it can *detect* the stall as `effectState: none` and fall through. Today it throws a string. |
| F2 | Workflow Monitors (Codex, `gpt-5.6-sol`) end in `stage: process_exited`, `last_error: "Agent process stop was requested but never confirmed"`, terminal retained with `identity_unproven`. Seen on `run_4f84cba16322` (`ctx_d54000752ea9`, `ctx_a7a7b599bc7d`). | `execution/orca-supervised-launch.mjs` (`startMonitor` hardcodes `codex` + `gpt-5.6-sol`, `--timeout-ms 60000`, runner timeout 90 s) | No monitor provider chain, no liveness/replacement loop, no settlement (`worker-stop` → `worker-release` → verify) before retry. |
| F3 | Every Orca failure is reduced to `Error(message)`; the structured `stage`, `failedStage`, `effects`, `residualResources`, `recovery` JSON that Orca returns on exit 1 is discarded. | `createOrcaRunner` in `orca-supervised-launch.mjs` | The launcher takes `candidates[0]` only and never classifies effect state, so the registry's fallback rule (`requiredEffectState: none`) can never be satisfied mechanically. `--retry-request <id>` (Orca's idempotency key for unknown mutation results) is never used. |

The 8 most recent `fix(orchestration)` commits each patched one symptom. 4.0 replaces the
prose-driven call path with a typed call contract and a launcher that resolves, attempts,
classifies, fences and falls through by contract.

## 2. Non-goals

- No change to Work/SRS/SDS schemas, `workflows/*.yaml` job matrices, `ops/*` or knowledge content.
- No npm publish, no product `.starciwork` migration, no Orca runtime patch. (Pushing the `.claude` repository after the exit criteria pass is in scope; see §6.)
- No new execution mode. Solo and orchestrated stay the only two.
- Qwen prompt-delivery bug inside Orca is contained (detected, fenced, fallen through), not fixed here.

## 3. Target architecture (4.0)

```text
profiles/registry.yaml        per-op ordered chains (policy only)
        │
providers/orca/api.yaml       live-verified command signatures (from agent-context)
providers/orca/calls.yaml     NEW: one typed call contract per Orca mutation/read
        │
execution/orca-calls.mjs      NEW: runner that returns {outcome, effectState, receipt, recovery}
        │                      never throws on Orca exit 1; throws only on contract violation
execution/orca-supervised-launch.mjs   REWRITE: start-op / start-monitor / settle / replace
        │                      resolve chain → attempt → classify → fence → next candidate
execution/orca.mjs, solo.mjs  consume the same call layer through adapters
```

### 3.1 Call contract (`providers/orca/calls.yaml`, schema `starci/orca-call@1`)

One entry per call StarCi may make. Each entry declares:

- `command` (must exist in live `agent-context`; flags are a subset of the live entry's `flags`)
- `kind`: `read` | `mutation`
- `idempotency`: `retry-request` (mutations) | `natural` (reads)
- `timeoutMs` and `budget` (max attempts inside one candidate)
- `receipt`: required JSON paths (`result.task.id`, `result.worker.agent_terminal_handle`, …)
- `classify`: rules mapping receipt/exit code to `{outcome: ready|settled|failed|unknown, effectState: none|partial|unknown}` using Orca's own `stage`, `effects[]`, `residualResources[]`
- `recovery`: the Orca-declared recovery commands to run before the caller may retry or fall through
- `forbidden`: e.g. `worker-start` with `--terminal`, `dispatch --inject`, literal `--on`

Calls in scope: `run-create`, `run-use`, `run-show`, `task-create`, `task-update`, `worker-start`,
`worker-show`, `worker-read`, `worker-stop`, `worker-abandon`, `worker-release`, `worker-list`,
`check`, `send`, `reply`, `worktree set|show|current`, `terminal rename`, `status`, `agent-context`.

### 3.2 Runner (`execution/orca-calls.mjs`)

- Loads `calls.json` and the live `agent-context` once; refuses to run if a declared command or flag is missing (`onMismatch: stop-before-effects`, already declared in `validation.yaml` but not executed today).
- Every mutation carries `--retry-request <deterministic id>` derived from `(run, task, operation, attempt)`; a timeout or non-JSON reply is re-issued with the same id and the receipt is reconciled instead of assumed lost.
- Returns a `starci/orca-call-result@1` envelope. `ok:false` with `effectState` is a *result*, not an exception.

### 3.3 Launcher 4.0 (`orca-supervised-launch.mjs`)

`start-op`:
1. attest nested Run and `coordinator_handle` (unchanged);
2. `resolveExecutionChain` → ordered candidates; inventory from live `worker-list`/`status`;
3. for each candidate: `task-create` (once, shared across candidates) → `worker-start` → `worker-show` attest immutable identity (dispatch, task, agent, model) → **prompt-delivery proof** (`effects[]` contains `dispatch_input: accepted` **and** worker `stage` beyond `dispatch_input` within `promptAckTimeoutMs`) → rename → verify title;
4. on failure: classify; if `effectState: none` → `worker-stop` → `worker-release` → verify `already_released|released` → record attempt → next candidate; if `partial|unknown` → stop, emit reconciliation request;
5. exhausted chain → `ok:false, exhausted:true, attempts[]` (never a bare throw).

`start-monitor`: same loop over a new `workflowManager` chain in `profiles/registry.yaml` (no hardcoded `codex`/`gpt-5.6-sol`).

`settle --dispatch`: new subcommand; stop → release → verify; reports `settled|retained|unknown`.

`replace-monitor`: new subcommand for F2; fences the dead monitor, settles, relaunches with `--retry-of`, re-binds Run cursor.

### 3.4 Chain policy (`profiles/registry.yaml`)

Decided per op family (user decision 2026-09-12; per-op placement is the maintainer's call):

| Family | Ops | Chain |
| --- | --- | --- |
| Deep reasoning | `business.decide`, `architecture.decide` | `claude-fable-5.1` → `codex-gpt-6-astra` |
| Independent review | `review.verify` | `qwen-qwen3.8-flash-reviewer` → `claude-fable-5.1` → `codex-gpt-5.6-sol-reviewer` |
| Execution | `backend.implement`, `interface.implement`, `uat.verify`, `content.generate`, `release.deliver`, `runtime.operate`, `scope.retire`, `task.execute`, `workspace.manage` | `qwen-qwen3.8-flash-worker` → `claude-opus` → `codex-gpt-5.6-sol` |
| Runtime maintenance | `knowledge.repair` | `claude-opus` → `codex-gpt-5.6-sol` → `qwen-qwen3.8-flash-worker` |
| Draw | `interface.draw` | `codex-gpt-5.6-sol` → `claude-opus` → `qwen-qwen3.8-flash-worker` |
| Workflow Monitor (new) | — | `claude-opus` → `codex-gpt-5.6-sol` |
| Plan Coordinator (new) | — | `claude-opus` → `codex-gpt-5.6-sol` |

Constraint to state honestly: Orca `worker-start --model` accepts Claude/Codex/Cursor ids only, and
`qwen-code` inherits the model from the Qwen runtime configuration. Qwen candidates therefore never
carry a model override; Qwen 3.8 Max and DeepSeek stay outside automatic chains as command-terminal
exception targets. Target names drop the `-reviewer` suffix where the profile has no working twin
(`codex-gpt-6-astra`); `codex-gpt-5.6-sol-reviewer` and `qwen-qwen3.8-flash-reviewer` keep it because
the same model also exists as a working target.

## 4. Phases

| Phase | Deliverable | Files | Proof | Est. |
| --- | --- | --- | --- | --- |
| 0 Baseline | Branch `v4/orchestration` from current head; capture live `agent-context` snapshot as fixture; record failing dispatch receipts as fixtures | `tests/fixtures/orca/*.json` | `npm test` 738 green before any change | 0.5 h |
| 1 Chains | Registry per §3.4; `workflowManager`/`planCoordinator` chains; Qwen Max as managed-agent with attested model; docs/costPolicy updated | `profiles/registry.yaml`, `profiles/qwen.yaml`, `tests/profiles-assets.spec.mjs`, `tests/execution-resolve-v3.spec.mjs`, `docs/orca-execution.md` | chain tests rewritten; build:check | 1.5 h |
| 2 Call contract | `calls.yaml` + schema + validator wired into `providers/validate.mjs`; live-vs-contract diff test | `providers/orca/calls.yaml`, `schemas/orca-call.schema.yaml`, `providers/validate.mjs`, `tests/provider-orca.spec.mjs` | validator rejects a missing flag / unknown command / literal `--on`; passes against the captured snapshot | 3 h |
| 3 Runner | `execution/orca-calls.mjs` with retry-request, classification, recovery execution; fixture-driven tests for every Orca exit-1 shape (`process_exited`, `agent_prompt_stalled`, `session_not_reported`, `outcome_unknown`, non-JSON, timeout) | `execution/orca-calls.mjs`, `tests/orca-calls.spec.mjs` | each fixture yields the expected `effectState`; no path throws on Orca exit 1 | 4 h |
| 4 Launcher | Rewrite `start-op`/`start-monitor` on the runner; add `settle`, `replace-monitor`; prompt-delivery proof; chain fall-through | `execution/orca-supervised-launch.mjs`, `execution/supervision.mjs`, `tests/orca-supervised-launch.spec.mjs` | simulated Qwen stall → fenced → released → Opus selected; simulated monitor death → replaced with `--retry-of` | 5 h |
| 5 Coordinator loop | `orca.mjs` adapter consumes the runner; `check --wait` with `--ack`, keepalive filtering; liveness → `replace-monitor` | `execution/orca.mjs`, `tests/orca-execution.spec.mjs` | event-loop tests: timeout re-arm, worker_done ack, escalation routing | 3 h |
| 6 Solo parity | `solo.mjs` uses the same result envelope for Agent-tool operations (no behavior change beyond envelope) | `execution/solo.mjs`, `tests/solo-execution.spec.mjs` | existing solo tests green + envelope assertions | 1.5 h |
| 7 Contracts & docs | `providers/orca/index|recipes|validation.yaml` reference `calls`; `docs/orca-execution.md`, `execution-agent-model.md`, `orca-runtime-upgrades.md` (mark F1–F3 resolved-in-runtime); `SKILL.md` paragraph on Orca launch rewritten to point at `start-op`/`settle`/`replace-monitor`; version `4.0.0-alpha.1`; `INDEX.yaml`, `README.yaml` | as named | `npm run build`, `build:check`, `build:knowledge:check`, `npm test`, `starci doctor --quick` in a scratch host | 2 h |
| 8 Live proof | One bounded op on `nivo-backend` R14 Core child (`review.verify` read-only or a `task.execute` no-op): Qwen first; then a forced-unavailable drill proving fall-through to Opus; then `settle` on the two retained `identity_unproven` terminals | receipts under `docs/examples/v4-live-proof/` | receipts show `[Op]` name, attested provider, effectState per attempt, released terminals | 2 h |

Total ≈ 22–24 h of work, sequential (phases 2→3→4 depend on each other; 1 and 6 can interleave).

## 5. Exit criteria for 4.0

1. No code path in `execution/` converts an Orca exit-1 JSON into an untyped `Error`.
2. Every mutation StarCi issues carries `--retry-request`.
3. A Qwen prompt stall is classified `effectState: none`, fenced, released and followed by the next candidate within one `start-op` invocation, proven by fixture and by one live run.
4. A dead Workflow Monitor is replaced without human intervention when `effectState` is provable; otherwise a reconciliation request is emitted with residual resources listed.
5. Chain tests encode §3.4 exactly; `resolveExecutionChain` rejects any non-managed candidate.
6. `npm test`, `build:check`, `doctor --quick` green; `orca-runtime-upgrades.md` records F1–F3 as runtime-resolved with the regression test names.

## 6. Decisions (user, 2026-09-12)

1. **Qwen Max is dropped** from every automatic chain. Deep reasoning is `claude-fable-5.1` → `codex-gpt-6-astra`. `qwen-qwen3.8-max-*` targets stay installed as explicit user-approved exceptions only.
2. **Monitor and Coordinator** use `claude-opus` → `codex-gpt-5.6-sol`. Rationale: the supervisor only decides, dispatches and waits, so model quality matters less than session stability; the Codex monitors are the ones observed dying, and 4.0 adds `replace-monitor` regardless of provider.
3. **Branch**: `main` is fast-forwarded to `codex/host-bootstrap-routing`; 4.0 work happens on `v4/orchestration` branched from that head and is merged back to `main` when the exit criteria pass.
4. **Solo parity stays in 4.0** (phase 6): solo is the simpler special case (one workflow, current worktree) of the same control loop and must consume the same result envelope.
5. **Live proof and completion**: phase 8 runs on the real `run_4f84cba16322` (`nivo-backend` AgentOS R14). After 4.0 passes its gates the orchestration must run stably until the R14 backend implementation and its E2E evidence are complete, and the `.claude` repository is pushed to its remote. Push is therefore an explicitly named allowed action for this delivery; product-side publish/deploy remain outside it.
