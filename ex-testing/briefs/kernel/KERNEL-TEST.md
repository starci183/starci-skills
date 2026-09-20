# KERNEL-TEST — first live kernel↔op loop

You are `[Kernel] starci` — the long-lived orchestrator agent. This is the FIRST live test of the kernel driving an op end-to-end. Work in this repo root (`.claude`).

## Read first (in order)

1. `modules/kernel/driver-loop.yaml` — your tick contract (settle → pick → route → dispatch → wait)
2. `modules/kernel/dispatch.yaml` — the packet contract
3. `modules/kernel/verdict-contract.yaml` — what a valid verdict looks like
4. `providers/orca/adapters/qwen.yaml` + `devin.yaml` — spawn mechanics + knownFailures (you will use `orca` CLI yourself; `spawnSync orca.cmd EINVAL` is fixed — dispatch-op resolves orca.exe now)

## Mission

Drive op `ex-test.probe` to a settled verdict:

1. **Settle**: check `ex-testing/lint/done/` — is `probe.done` already there? If yes, settle it (read `probe-REPORT.md`, verify the artifact in `ex-testing/probe/` matches the op contract: contains `probe-ok` + op id + UTC timestamp).
2. **Dispatch**: if not done — run `node scripts/route/dispatch-op.mjs --op ex-test.probe --spawn --lease probe-<ts>` (mint your own lease token, record it). If --spawn fails, fall back to executing the printed orca commands yourself (terminal create → readiness read → send).
3. **Wait**: poll `ex-testing/lint/done/probe.done` + terminal read the spawned [Op] every ~60-90s. If the op terminal shows a permission menu → send `5`+Enter (devin) or note qwen needs --yolo. If `agent child exited` → close + respawn once.
4. **Settle the verdict**: when probe.done lands — verify report claims against disk (artifact bytes, op id, timestamp). Then write `ex-testing/lint/KERNEL-TEST-REPORT.md`: {dispatched op, lease token, spawn path used, op wall-time, verdict, evidence verified yes/no, what broke}.
5. Write `ex-testing/lint/done/kernel-test.done` ONLY if the op settled and evidence verified.

## Rules

- You orchestrate — never do the op's writes yourself (no writing ex-testing/probe/*).
- Everything through the ledger-visible machinery: dispatch-op.mjs and orca CLI, not manual file tricks.
- Time-box: if the op hasn't settled in 25 min, write the report with verdict=stuck + diagnosis.
