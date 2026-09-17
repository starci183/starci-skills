# W4 fan-out / allocation notes

## kernel.mjs call-site changes needed: none

The op-level cut gate is wired entirely inside `syncLedgerOps` (kernel/sync.mjs), which the kernel already
invokes every tick (`kernel/kernel.mjs` ~4128, inside the `sync` stage):

- `settleOpCuts(store, state)` runs at the top of `syncLedgerOps` — before the `!ctx.work` early return, so
  plan-ledger workflows settle their groups too.
- `cutOversizedOps(store, state, ctx)` runs at the top for the plan-ledger early return, and again at the end
  of the Work-ledger derivation loop, so an op minted this tick is still cut before the scheduler can reach
  it in the same tick.

No edit to `kernel/kernel.mjs` was required. Verified read-only call sites:

- `difficulty: effectiveDifficulty(op)` reaches `ctx.allocator.allocate` unchanged at kernel.mjs ~1208. The
  same measurement now also reaches `allocator.review` inside `planDispatch` (dispatcher.mjs).
- `fanOutDeferral(state, op, busy, ctx)` at kernel.mjs ~1175 — nothing pins siblings to the parent runtime;
  every child goes through `allocate()` on its own and lands by real headroom.
- `resumePaused` (kernel.mjs ~1950) only resumes `paused` ops that carry `waitingFor`; a cut parent parks as
  `paused` with `waitingFor: null` and is settled by `settleOpCuts`, never resumed into a launch.
- `verificationCandidates` (kernel.mjs ~2956) requires every implement op covering a ledger item to be `done`
  before the group proof is planned — a paused cut parent holds the proof until its children settle, and the
  children's `ledgerIds` put the implement runtimes on the proof's avoid list.
- `ledgerWrite`/`recordDone`/`kernelProof` are safe for cut children: children keep `nodeId: null` (they are
  slices of an op, not ledger nodes), and the Work-mode lane accounting flows through their `ledgerIds`.

## Group shape

`state.opCuts[parentOpId] = {children, seam, assertions}` — parallel to `state.cuts` for node cuts, kept in a
separate map so `cutParentOf` node-id lookups can never collide with op ids (a real node named `feat.pay.1`
must not read as a child of the op `feat.pay`). Children carry `cutChildOf`, `nodeId: null`, the parent's
`ledgerIds`, `dependsOn` on the seam, `origin: 'gate'` (a cut is not new dynamic work — the parent's scope
already covered every file a child names) and `difficulty: effectiveDifficulty(parent)` as the declared floor.

`fanOutDeferral` and the dispatcher's `groupOf` resolve `op.cutChildOf ?? cutParentOf(nodeId)`, so the
seam-first and `maxPerGroup` rules apply identically to both group kinds.

## runtimes.yaml: unchanged on purpose

The brief's literal hard order `[codex-agent, claude-agent, devin-agent]` is stale. HEAD (eafd53e3) moved the
hard tier to `[claude-agent, devin-agent, codex-agent]` — Opus first, Devin only when the owner grants a slot,
Sol last — and `tests/runtime-allocator.spec.mjs` asserts exactly that ("Sol is the last resort, never the
first answer"), which is also the brief's own deeper requirement. `decide`/`plan` prefer `[claude-fable, ...]`,
`devin-agent` stays `maxParallel: 0` + `capacityAuthority: explicit-workflow-quota`. No inconsistency found.

## quota alias merging: verified, not regressed

`applyQuota` (schedule.mjs ~119-122) canonicalizes every `slots` key through `canonicalTarget` and merges by
`Math.max` — `gpt-5.6-luna`/`gpt-5.6-sol`/`gpt-6-astra` all resolve to `codex-agent`, and a zero on an unused
spelling cannot close slots another alias granted. `parseQuota` additionally sums repeated spellings of the
same window at parse time. Covered by `tests/w4-fanout.spec.mjs`.
