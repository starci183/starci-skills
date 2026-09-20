# W5 test-suite findings

Baseline: `npm run build` clean (495 files, no stale). Full suite `npm test`
(`node --test tests/*.spec.mjs`): **2134 tests — 2128 pass, 0 fail, 6 skipped, 0 todo**.
The 6 skips are intentional `test.skip` placeholders in `goal-contract.spec.mjs` (each names the
spec that covers it), not stale or weakened checks. No expectation was weakened and no stale
fixture needed repair.

## Source observations (not fixed here — runtime source is out of scope)

1. `kernel/kernel.mjs` `runtime-gate-binding` refusals (lines ~1145, ~1203) block the op with a
   permanent refusal and a pending record but never push a `needUser` entry. Every sibling refusal
   in `scheduleOps` (`amendment-effect-ceiling`, `host-unsupported`, `candidate-root-binding`)
   pushes one. Owner visibility currently relies on the event log and `workflow-status` only; if
   the blocked op binds no unmet goal metric, the finish path (`needUser.length ? 'blocked' :
   'done'`) has no owner-facing line naming why the op died. Likely a small owner-visibility gap
   rather than a deadlock — the pending kind provably holds no lease (it is set before admission).
   Flagged for the kernel owner to confirm intent.

2. No pending kind currently wedges a writer lease without a reconcile path —
   `tests/w5-retry-coverage.spec.mjs` proves the invariant per kind: quarantined kinds reach
   `refusal='runtime-reconciliation'` and are retry-admitted, `dispatch-reconciliation` and
   `required-validation` have named readmission in `workflow-retry`, `answered-decision-late-report`
   re-admits by its retained immutable report, `model-quota-wait`/`durable-job` replay through
   `acceptReports`, and `prepareGenerationRetry` drains never-launched and dead-process durable
   jobs while a live process keeps the fence up.

3. `cli.spec.mjs` `forwarded` list matches `LAUNCHER_COMMANDS` in `bin/starci.mjs` exactly
   (22 commands). No `workflow-ops` command exists on either side; per the brief the list was
   left alone.

4. Test hygiene (fixed in this branch): specs launching through the Orca host with the
   repo-relative worktree `fixtures/orca/agentos-r14-sales` (`workflow-kernel.spec.mjs`,
   `orca-headless.spec.mjs`) left `.starciwork/_local/runtime/orca-dispatch-ctx_*.md` files in
   the real repo-root `fixtures/` tree. Both now point at per-run temp roots (the headless spec
   keeps the launcher-required relative path under a `process.cwd()` temp dir, matching the
   `orca-supervised-launch.spec.mjs` pattern). The mutation also had a latent flake: mutating
   that tree mid-run can race `integration.spec.mjs`'s payload `cpSync` enumeration.

Environment note: `node_modules` was absent in the worktree; `npm ci` was required before the
suite could run (specs importing `typescript`, `@jest/globals`, etc. fail at module resolution
without it).
