# Orca runtime upgrade observations

This document collects reproducible Orca/runtime behavior discovered while executing approved product workflows. It is an upgrade input for StarCi, not product SRS/SDS, implementation evidence, or deferred product debt. Product delivery remains the primary goal; an observation may not widen product scope or block an independent ready operation.

## Active AgentOS R14 observation goal

While the Orca parent coordinates the Core/shared, Accounting, Chatbot, and Sales backend workflows, record only behavior that can be reproduced from a concrete command, dispatch, terminal, worktree, model selection, retry, approval, or handoff. For each confirmed behavior, state the expected contract, the observed result, the operational impact, and the smallest runtime change or regression test proposed for a later `.claude` upgrade.

## Confirmed observations

### The orchestration Coordinator must run inside the Orca main worktree

- Expected: an external Codex or Claude chat bootstraps an Orca orchestration, then a persistent native Coordinator agent in the main worktree owns the Run/DAG, boundary-event loop, decisions, and dynamic operation-agent lifecycle.
- Observed: keeping the event loop in the external bootstrap chat left the Orca main worktree as a plain shell and made the visible parent appear to have no managing agent.
- Impact: the UI hierarchy and runtime ownership diverge; closing the bootstrap chat can orphan supervision even though workflow children and operation terminals remain alive.
- Resolution: launch a native Coordinator agent in the main worktree, hand it the current Run and active Task/Dispatch/terminal identities, verify that it accepted the contract, then end the external bootstrap loop. The main worktree must not be represented as a shell-only Coordinator.
- Upgrade candidate: add a first-class coordinator handoff command that atomically creates the native main-worktree agent, transfers the Run cursor and pending deliveries, and returns a durable receipt to the bootstrap session.

### Active runtime readers can block the generated bundle swap on Windows

- Expected: `ensure-build` publishes a changed `.dist` bundle by atomically swapping the staged directory.
- Observed: the active Codex process held an open handle to `.dist/workflows`; Windows returned `EPERM` when the compiler tried to rename `.dist` to `.dist.previous`.
- Impact: authored profile changes compile correctly but cannot be published by a directory swap from the same long-lived agent process that is consuming the runtime.
- Upgrade candidate: add an explicitly tested Windows reader-aware publication path without weakening deterministic byte checks or allowing a partial bundle to be reported as current.

### Qwen headless readiness cannot rely on process exit status

- Expected: a failed provider/model readiness probe is reported as unavailable before dispatch.
- Observed: Qwen Code emitted an API `401` inside its JSON result while the process exited with code `0`.
- Impact: an exit-code-only Orca probe can misclassify an unusable provider as ready and dispatch an operation that never began.
- Upgrade candidate: parse the final Qwen JSON result, API error fields, turn count, and token usage; accept readiness only after a successful model response.

### Qwen safe mode disables stored authentication selection

- Expected: a no-tools benchmark can reuse a configured provider without loading project customizations.
- Observed: `--safe-mode` disabled the stored auth selection and provider settings; headless execution required explicit `--auth-type`, base URL, and an available named environment credential.
- Impact: Orca command-terminal launch must distinguish project customization isolation from provider authentication bootstrap.
- Upgrade candidate: resolve non-secret provider launch metadata in StarCi, require the configured environment-key name during readiness, and never place credential values in a prompt, command receipt, or log.

### A zero tool-call budget can reject a healthy Qwen model

- Expected: a read-only provider readiness probe distinguishes transport/model readiness from operation behavior without granting product effects.
- Observed: `qwen3.8-max` reached the configured provider but aborted with `FatalBudgetExceededError` when the probe set `--max-tool-calls 0`; the same model returned the requested token with one request, zero API errors, and zero actual tool calls when the probe supplied a no-tools system prompt and allowed a budget of one. `deepseek-v4-pro` also returned the requested token with one request and zero API errors.
- Impact: treating any zero-budget abort as provider unavailability can incorrectly skip a healthy first-choice model.
- Upgrade candidate: use an effect-free readiness contract with a narrowly positive tool budget, require a successful final model response, and separately reject any observed tool effect.

### A running Orca process does not inherit a refreshed user credential

- Expected: a newly available named provider credential can be used by later command-terminal operation agents without exposing the credential value.
- Observed: the current Orca process retained its earlier environment block after the named user environment variable was added. A new Qwen terminal became ready only when its bootstrap command explicitly hydrated the named variable from user scope before launching Qwen; no credential value was placed in the task, preamble, terminal title, or repository.
- Impact: a successful out-of-process readiness probe does not by itself make the provider ready inside an already-running Orca host.
- Upgrade candidate: add an approved credential-provider refresh boundary or a platform adapter that resolves only the configured key name at command-terminal launch, with secret redaction tests.

### Manual command-terminal operation agents are not supervised worker resources

- Expected: every isolated operation agent has one Task, one Dispatch, one terminal identity, liveness, settlement, and a worker resource visible to the parent DAG.
- Observed: Qwen launched through `terminal create`, then received a Dispatch using `--return-preamble` followed by `terminal send`. The Task and Dispatch were tracked, and lifecycle mail worked, but `worker-list` reported `workerState: unsupervised`, `terminalState: retained`, and no resource ownership record.
- Impact: provider/profile routing works, but the Coordinator lacks the same resource-accounting and stop/release guarantees available for Codex or Claude workers launched through `worker-start`.
- Resolution in StarCi: this command-terminal path is forbidden. Create a canonically named Task and launch it directly with `worker-start --agent qwen-code`; rename the returned native terminal and require `worker-show` provider/name attestation before accepting effects.

### Native Qwen branding can succeed while supervised prompt delivery fails

- Expected: `worker-start --agent qwen-code` creates one branded Qwen operation agent, injects its Task contract, reports a stable session identity, and owns the terminal until `worker-release`.
- Observed: Orca runtime 1.4.188 created a branded Qwen Code 0.23.3 TUI running the configured `qwen3.8-flash`, but three fresh native launches failed at `dispatch_input` with `agent_prompt_stalled`; another attempt surfaced `session_not_reported`. The installed Orca adapter declares `promptInjectionMode: stdin-after-start`, while this Qwen CLI exposes positional one-shot input and `-i/--prompt-interactive` for an interactive startup prompt. `dispatch --inject` rejected the residual live Qwen terminal as an unrecognized agent.
- Impact: native identity and model visibility alone do not prove Task delivery or supervised resource ownership. Blind retry creates idle duplicate Qwen terminals and failed Tasks; treating the live TUI as fully supervised makes stop/release accounting false.
- Immediate containment: fence or abandon the failed launch Dispatch, reconcile its exact effects and retry only after no effects are verified. New Qwen attempts use direct `worker-start --agent qwen-code`; never adopt the failed TUI through manual prompt submission or a command-terminal fallback.
- Upgrade candidate: change the native Qwen adapter to the Qwen 0.23.3 interactive startup-prompt contract (equivalent to `-i/--prompt-interactive`), recognize the Qwen session, and return a supervised resource only after the Task contract is observed as consumed. Add Windows regressions for multiline prompts, `agent_prompt_stalled`, `session_not_reported`, exact provider/model attestation, and canonical `[Op] <operation> - <scope>` naming.
- Runtime containment: automatic chains may contain only native managed-agent targets. After a verified no-effect Qwen startup failure, use the operation's next native managed fallback; never fall through to a Qwen/DeepSeek command terminal merely to keep work moving.

### Manual external-provider identity is not represented in the Orca agent tree

- Expected: an isolated operation launched with Qwen 3.8 Max or DeepSeek V4 Pro is visibly attributed to that provider/model in the Orca worktree tree as well as inside its terminal.
- Observed: Orca retained the explicit tab name and Qwen rendered `qwen3.8-max (Token Plan Singapore)` in its own footer, but terminal metadata reported `agentWait: null`; the worktree tree therefore kept the Codex workflow-wrapper icon and treated that manually launched Qwen operation as a generic command terminal. The installed Orca build does include native agent id `qwen-code`; `worker-start --model` remains limited to Claude, Codex and Cursor.
- Impact: the operation uses the resolved external model, but the sidebar icon cannot prove provider/model provenance and can mislead an operator into believing that the Codex wrapper executed the operation.
- Resolution: create the Task with display name `[Op] <operation> - <scope>`, launch configured Qwen 3.8 Flash directly with `worker-start --agent qwen-code`, rename the returned native terminal, then attest agent/model/title through `worker-show`. A DeepSeek or other exact Qwen-compatible model override remains a separate adapter gap until Orca can pass that model through a supervised native launch.

### Dispatch injection cannot adopt an agent that is already working

- Expected: when an operation terminal was opened before its Task/Dispatch, the Coordinator can safely attach the missing contract or receive a precise recovery path.
- Observed: `dispatch --inject` against an active Codex TUI returned `agent_prompt_stalled`; the attempted Dispatch failed and remained visible as a retained unsupervised attempt. Returned-preamble plus terminal-send could execute the task, but did not create supervised resource ownership.
- Impact: late adoption cannot repair an already-running untracked operation and leaves extra failed-attempt accounting unless the Coordinator explicitly settles it.
- Upgrade candidate: make direct native start return atomic prompt acknowledgement, canonical task/terminal naming, rollback and failed-attempt cleanup.

### An external operation agent can create hidden fan-out inside one Orca operation

- Expected: one workflow operation is executed by exactly one isolated agent, so its Task, Dispatch, worktree, effects, and output provenance remain one-to-one.
- Observed: a Qwen 3.8 Max `backend.implement` terminal invoked its built-in `agent` tool and started two local Explore subagents inside one Orca operation. Orca continued to see only the outer command terminal and could not supervise the nested agents individually.
- Impact: hidden fan-out breaks operation isolation, bypasses Orca resource accounting, and makes nested output provenance and effect ownership unverifiable.
- Immediate containment: every Qwen/DeepSeek operation launch excludes the canonical `agent` tool with `--exclude-tools agent`; prompts also prohibit delegation, but the executable tool fence is authoritative.
- Upgrade candidate: make `one operation = one agent` a launcher invariant for every external CLI adapter, deny all provider-specific delegation primitives before dispatch, and fail the operation if a subagent-start event is nevertheless observed.

### Qwen multiline dispatch text can remain staged after one Enter

- Expected: sending one lifecycle preamble plus operation contract with `terminal send --text ...`, followed by one `terminal send --enter`, submits exactly one Qwen turn.
- Observed: the full multiline text remained visible in Qwen's input editor after the first Enter and no model turn began; a second isolated Enter changed the UI to active thinking. The behavior reproduced on the Chatbot retry terminal and was distinguishable from provider latency by the rendered screen.
- Impact: a Coordinator can report an operation as running while the entire contract is still only staged in the TUI and no provider request has started.
- Upgrade candidate: the Qwen adapter should verify a post-submit state transition (`idle input` to `thinking/tool/response`) and submit one additional Enter only while the exact staged prompt remains unconsumed; it must never duplicate a turn that already started.

### Terminal stop and reset need observable settlement

- Expected: resetting an orchestration leaves no live worker terminals or processes for removed worktrees.
- Observed: some stops returned `stop_unknown` or `unverifiable`; removed-worktree terminals and orphaned CLI processes remained until explicitly closed or terminated after identity checks.
- Impact: stale processes can consume resources, retain filesystem handles, and confuse a subsequent run.
- Upgrade candidate: require terminal disconnect plus process settlement before worktree removal, and report unresolved settlement as a reset failure rather than success.

### Native Codex activity titles can drift after canonical operation naming

- Expected: an operation remains visibly named `[Op] <operation> - <scope>` while its immutable Task, Dispatch and provider identity remain stable.
- Observed: after a successful canonical rename, native Codex later changed the terminal title to `Report terminal task outcome | <worktree>` while the Task `display_name`, exact Dispatch/worker, `codex` agent and `gpt-5.6-sol` model remained correct. A Workflow Monitor treated that mutable title as an identity mismatch and stopped a valid Accounting implementation attempt.
- Impact: correct operation effects can be discarded because native activity metadata is mistaken for ownership or provider provenance.
- Resolution in StarCi: attest immutable Task/Dispatch/worker/provider identity first, then rename and verify the canonical title. During execution, recanonicalize title drift without fencing when immutable identity still matches; before release, rename once more. Never reject verified effects solely because the native terminal activity title drifted.
- Upgrade candidate: Orca should separate a stable user-assigned display title from its generated activity title so native adapters cannot overwrite the role label.

### DeepSeek V4.1 Flash is a conditional candidate, not a Token Plan alias

- Expected: a newly released lower-cost coding model can be added to an operation chain only when the configured provider accepts its exact model ID and reports the same observed model.
- Observed: DeepSeek documents V4.1 Flash under the canonical API model ID `deepseek-flash` and reports that it outperforms the outgoing V4 Pro across performance, cost, speed and total runtime. The current QwenCloud Token Plan exact-string allowlist does not list `deepseek-flash` or `deepseek-v4.1-flash`; it lists older DeepSeek V4 identifiers instead.
- Impact: treating a QwenCloud `deepseek-v4-pro` request as proof of V4.1 Flash can silently misstate provenance, fail authentication/model selection, or use a different billing channel.
- Immediate containment: keep V4.1 Flash out of automatic Token Plan chains. For canonical SRS/SDS-bound implementation, prefer Qwen 3.8 Flash on the current Token Plan; use DeepSeek V4 Pro for hard fallback and independent review, with Qwen 3.8 Max excluded from automatic backend/review routing.
- Upgrade candidate: add a first-class DeepSeek provider profile for `deepseek-flash`, run a bounded representative coding benchmark against Qwen 3.8 Flash, verify the returned model ID and billing source, then promote it only after an explicit routing decision.

## Resolved in runtime 4.0

The following observations are now handled by the runtime itself; the regression test names are the proof to rerun.

- **Native Qwen branding can succeed while supervised prompt delivery fails** and **Dispatch injection cannot adopt an agent that is already working**: `start-op` proves prompt delivery from the `worker-show` receipt, classifies a stall as `effectState: none`, settles the attempt and falls through to the next managed candidate inside the same invocation (`tests/orca-supervised-launch.spec.mjs`: "a Qwen prompt stall is classified as no-effect and the launcher falls through to Claude in the same invocation"; `tests/orca-calls.spec.mjs`: "worker-start receipts classify into ok, failed-none, failed-partial and unknown"). The Orca-side prompt-injection defect remains an Orca upgrade candidate.
- **Terminal stop and reset need observable settlement**: `settle` reports `none` only when `worker-release` returns `released` or `already_released`; `stop_unknown` and `release_unknown` stay `unknown` and block fallback (`tests/orca-supervised-launch.spec.mjs`: "settlement reports unknown when stop cannot be confirmed").
- **Workflow Monitors ending in `process_exited` with retained `identity_unproven` terminals** (observed on `run_4f84cba16322`): `replace-monitor` proves the Monitor is not live, settles it and relaunches with `--retry-of` from the supervisor chain (`tests/orca-supervised-launch.spec.mjs`: "a dead Workflow Monitor is settled and replaced"). Monitor and Coordinator providers now come from `profiles/registry.yaml` `supervisors`, not from a hardcoded Codex launch.
- **Untyped Orca failures**: every call is declared in `providers/orca/calls.yaml`, verified against the live `agent-context` (`verify`), replayed once with `--retry-request` on an unknown mutation result, and returned as `starci/orca-call-result@1` (`tests/orca-calls.spec.mjs`).

## Recording rules

- Record only reproduced runtime behavior; do not infer a defect from a slow or still-running operation.
- Keep credentials and user data out of this document.
- Do not change `.claude` automatically from a product worker. The Coordinator may propose an upgrade; implementation requires the separately authorized runtime-maintenance workflow.
- Add a regression test with any accepted runtime fix.
