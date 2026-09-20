# k2 REPORT — kernel host routing via route-model (start-workflow.mjs)

## Scope
Lane k2. Owned file: `scripts/kernel/start-workflow.mjs` (+ doc update in
`modules/kernel/start-workflow.yaml`). No commits.

## Changes

### `scripts/kernel/start-workflow.mjs`
- **Routing (default, no `--provider`)**: new `resolveKernelRoute()` spawns
  `node scripts/route/route-model.mjs --kind model.manageWorkflow --risk high --json`
  (60s timeout, cwd = skill root). `model.manageWorkflow` is a
  kernelFunctionKind in `modules/models/selection.yaml` (closedSets line ~51).
  The pick's `target` (e.g. `qwen-agent`) is mapped to a provider by reading
  `modules/models/profiles/<target>.yaml` `provider:` field via
  `core/yaml.mjs parseYaml` (same pattern as dispatch-op.mjs `resolveModel`).
  Returns `{provider, routedBy: 'route-model', route: {target, model, mode, rule}}`.
- **Fallback**: router exit ≠0, spawn error, non-JSON output, `pick: null`
  (refusal — 'no eligible model'), or a profile with no `provider` field →
  `{provider: 'devin', routedBy: 'fallback', routeError: <reason>}`.
  `routeError` surfaces the refusal rule (`decisionFlow.verdict: no eligible
  model`) so the fallback is typed, never silent.
- **Override**: `--provider <name>` short-circuits → `routedBy: 'override'`.
- **Spawn flags**: new `providerCommand(provider)` parses
  `providers/orca/adapters/<provider>.yaml` and builds the terminal command:
  - `credentialRefresh[win32|posix]` + `commandPrefix[win32|posix]` prefixes
    (qwen stale-key unset; devin ACP_BACKEND strip + auth probe + alias)
  - `commandRequirements` joined (qwen `--exclude-tools agent --yolo`;
    devin `--permission-mode accept-edits --respect-workspace-trust false`)
  - `terminalFallback.command` + first token of `terminalFallback.bypassFlag`
    for native-managed agents (claude `--dangerously-skip-permissions`;
    codex `--full-auto` — bypassFlag there carries a prose tail, first token
    extracted via `/^(--?\S+)/`)
  - Adapter card missing/unreadable/no command fields → `PROVIDER_CMD` map
    kept as fallback (unchanged entries).
- **Boot prompt**: now states every state mutation goes through
  `node scripts/kernel/api.mjs <cmd>` — survey/status/plan/enqueue/dispatch/
  settle/incident/retire; never direct sqlite, never self-spawned op
  terminals (dispatch via api dispatch). SKILL.md + modules load-order lines
  kept.
- **`--plan`**: prints `provider`, `routedBy` (route-model/override/fallback),
  the picked `route {target, model, mode}` or `routeError`, resolved
  `command` + `commandSource`. JSON output carries the same fields.
- Singleton/claim/finished-refusal logic untouched; routing resolves lazily
  (after the live-signal short-circuit) so an already-live kernel doesn't
  spawn a route-model child. `routedBy` also recorded in the signals
  value_json and the `kernel-booted` event payload.

### `modules/kernel/start-workflow.yaml`
- `usage` line: `--provider <name>` documented as override; note that without
  it the host is routed, not chosen.
- `spawn.provider` replaced by `spawn.routing` (route-model
  kind=model.manageWorkflow risk=high → profile provider; fallback devin /
  routedBy: fallback; override / routedBy: override) and `spawn.command`
  (adapter-card fields + PROVIDER_CMD fallback). Prompt doc updated for the
  api.mjs mutation contract.

## Verification (against real repo)
- `node --check scripts/kernel/start-workflow.mjs` → OK.
- `--plan --goal wf-e2e-canary-mu9h0c4g` (default): route-model refuses today
  (qualifications.yaml has no measured evidence → probation banned at risk
  high) → `provider: devin (routedBy: fallback — decisionFlow.verdict: no
  eligible model)`; command assembled from `adapters/devin.yaml`
  (win32 commandPrefix + reqs). Correct per spec.
- `--plan --provider qwen` → `routedBy: override`, command
  `Remove-Item Env:BAILIAN_TOKEN_PLAN_API_KEY …; qwen --exclude-tools agent --yolo`.
- `--plan --provider codex` → `codex --full-auto`; `--provider claude --json`
  → `claude --dangerously-skip-permissions` (terminalFallback path).
- No real spawn attempted (live kernel signal exists for the canary wf and
  no pending inbox goal to claim anyway).

## Notes for parent / other lanes
- Until `modules/models/qualifications.yaml` carries measured evidence,
  route-model will always refuse `model.manageWorkflow` at risk high → every
  real boot takes `routedBy: fallback` → devin. That is intended; the wiring
  picks automatically once evidence lands.
- `scripts/kernel/api.mjs` does not exist yet in this tree — owned by another
  lane; the boot prompt references it per spec.
- `route-model.mjs` `--kind` is required (exit 2 without); invoked exactly as
  spec'd (`--kind model.manageWorkflow --risk high --json`).
