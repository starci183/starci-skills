# Runtime 4.0 live proof against Orca 1.4.188

Captured 2026-09-12 from the real AgentOS R14 orchestration (`run_4f84cba16322`, host machine
paths redacted). These receipts prove the typed call path against a live Orca, not product
acceptance: no product source was changed and no operation agent was started.

| File | What it proves |
| --- | --- |
| `verify.json` | `orca-supervised-launch.mjs verify` compared every declared call and flag in `providers/orca/calls.yaml` with the live `agent-context` (232 commands) and found no drift. |
| `settle-core-monitor.json`, `settle-chatbot-monitor.json`, `settle-sales-monitor.json` | `settle --dispatch` on the three Workflow Monitors that had ended in `process_exited`. `worker-stop` reported `alreadySettled: true`; `worker-release` reported `retained` with reason `identity_unproven` and `processAction: none`. The settlement classifies this honestly as `effectState: none` with a recorded `residualTerminal`, because no process remains and Orca refuses to close a terminal whose identity it cannot prove. |

The first live settle before the receipt-shape fix had reported `release.state: null` and `ok`,
which is why `worker-stop` and `worker-release` receipts were captured into
`tests/fixtures/orca/live-1.4.188/` and the classification rules now read `result.state`
(`released`, `already_released`, `retained`, `release_pending`, `release_unknown`).

A dry run of `start-op --dry-run` for `backend.implement` in the Core child resolved the chain
`qwen3.8-flash` (no `--model`) → `claude-opus` (no `--model`) → `gpt-5.6-sol`
(`--model gpt-5.6-sol`), each with `--timeout-ms 120000`.

Not proven here: an actual `start-op` fall-through on the live run. That requires the exact
Workflow Monitor terminal bound as the nested Run coordinator, which only exists once the
Coordinator is re-bootstrapped on runtime 4.0.
