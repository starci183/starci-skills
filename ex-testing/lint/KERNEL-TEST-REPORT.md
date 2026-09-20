# KERNEL-TEST-REPORT — first live kernel↔op loop

- **kernel:** `[Kernel] starci` (this agent)
- **dispatched op:** `ex-test.probe` — `modules/ops/ops/ex-test.probe.yaml`
- **lease token:** `probe-20260920T064534Z` (minted by kernel at dispatch)
- **spawn path used:** `node scripts/route/dispatch-op.mjs --op ex-test.probe --lease probe-20260920T064534Z --spawn --json` → Orca `terminal create` on worktree `active`, title `[Op] ex-test.probe`, model profile `qwen-agent` (`qwen --model qwen3.8-flash --approval-mode yolo ...`), terminal handle `term_3805879e-d027-41cf-ba9e-faff178442b0`
- **op wall-time:** ~4.5 min — packet re-sent ~06:46Z, `probe.done` + `probe-REPORT.md` on disk 06:50Z
- **verdict:** **pass** (kernel-reproduced, not taken on trust)
- **evidence verified:** yes

## Evidence re-verification (kernel side)

| claim in `probe-REPORT.md` | kernel observation | result |
| --- | --- | --- |
| artifact `ex-testing/probe/probe-20260920T064534Z.txt`, 130 bytes | on disk, 130 bytes | match |
| sha256 `145de0f9…0d0207` | recomputed `145de0f9ebb0917d8382ab80a0249976614f601efc20726cfa87b9476b0d0207` | match |
| contains UTC timestamp | `2026-09-20T06:48:57Z` present | match |
| contains `probe-ok` | present | match |
| names op id `ex-test.probe` | present | match |
| `probe.done` 0-byte marker, pass-only | 0 bytes on disk | match |
| writes confined to 3 declared paths | `git status`: only `ex-testing/probe/`, `probe-REPORT.md`, `probe.done` new | match |

## What broke / notes for the machinery

1. **Pre-readiness send loss.** `dispatch-op.mjs --spawn` sends the packet immediately after `terminal create`; the readiness read ran while the screen was still `screen-unavailable` (qwen booting), so the 653-byte packet went into a PTY with nothing listening and was silently dropped. Kernel re-sent after the `Type your message` readiness pattern rendered — the op then proceeded normally. *Fix: dispatch-op.mjs should poll the readiness screenPattern (per adapter `readiness.timeoutMs`) before `terminal send`, not just read once.*
2. **Op suspicion (legitimate, non-gating):** `writes.artifact.path` templates `<run-id>` but nothing binds it — the op derived the filename from the lease token. Naming rule belongs in the brief (e.g. `<lease-token>.txt`), not per-agent judgement. Routed to the op-spec owner; op correctly did not edit out-of-scope.
3. Op caught and corrected its own false-negative regex check before finalizing — observed live via `terminal read`.
4. Op terminal self-closed after settlement (`tab_not_found` on close) — consistent with "the op's terminal dies when its verdict settles."

## Loop health

settle → pick → route → dispatch → wait → settle ran end-to-end through ledger-visible machinery only (`dispatch-op.mjs` + `orca` CLI). No op writes performed by the kernel. Time-box (25 min) not reached.
