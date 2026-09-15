# Runtime allocation: prefer, then overflow

For enrolled workflows, measured eligibility or explicitly bounded local probation filters this pool
before budget ranking. SQLite admission enforces the shared ceiling for operation workers and model jobs;
native Orca writers also require the exclusive canonical-root reservation. Read [the execution contract](execution-contract.md).

In runtime 5-plus the kernel no longer walks an ordered list of providers. Every
runtime is a pool declared in `model/runtimes.yaml` with the roles it may
take and how many operations it can run at once. No pool declares a daily cap:
the only budget is the provider's own window, probed and read from
`runtime-budget.json`. For each ready operation the kernel calls
`allocate(kind, {avoid})` and receives one eligible pool — one that has the
role, a free slot, an unexhausted provider window and no cooldown — plus the
role the worker will play. `maxParallelOps: 10` caps the
whole workflow, so ten ready operations can be in flight across Codex, Claude
and Qwen at the same time instead of queueing behind one provider.

`allocation.fanOut` is the one bound the allocator answers but does not apply
itself: `{seamFirst: true, maxPerGroup: 9}`. When a heavy node has been cut into
children with disjoint write scopes, the scheduler reads that policy from
`allocator.fanOut` and holds the group to it — the **seam** (the one child that
owns the module wiring, the migrations and the shared contracts every other
child would otherwise touch) runs alone in its group, and at most nine of one
parent's children run at once. Against `maxParallelOps: 10` that means eight or
nine builds of a single heavy node in flight while the rest of the tree still has
a slot to run in: one parent can never take the whole pool and leave everything
else queueing behind it. The rule itself lives in `fanOutDeferral`
(`kernel/sync.mjs`), because it is a fact of the cut group rather than of the
pools, and a profile that declares no `fanOut` still gets it with
`maxPerGroup` defaulting to one below `maxParallelOps`.

The role of an operation kind comes from the kind graph (`model/kinds.yaml`
through `kernel/graph.mjs`), which is the one place a kind is defined;
`roleOfKind` in `model/runtimes.yaml` stays the fallback for a kind the graph
does not carry, which is every 4.x operator id the graph never adopted.

## The policy: prefer, then overflow

The kernel does **not** spread work evenly. Each role has a preference order in
`allocation.preference`, and every new operation goes to the first runtime in
that order that is eligible. When the preferred runtime is saturated (all
`maxParallel` slots busy), out of budget or cooling down, the operation
overflows to the next runtime; when a preferred slot frees up again, the next
operation returns to it.

```yaml
allocation:
  policy: prefer-then-overflow
  preference:
    implement: [claude-opus, gpt-5.6-sol, qwen3.8-flash]
    verify: [claude-fable-5.1, gpt-6-astra, claude-opus, gpt-5.6-sol, qwen3.8-flash]
    decide: [claude-fable-5.1, gpt-6-astra, claude-opus, gpt-5.6-sol]
    plan: [claude-fable-5.1, gpt-6-astra, claude-opus, gpt-5.6-sol]
    write: [claude-opus, gpt-5.6-sol, qwen3.8-flash]
```

With the shipped pools — Claude Opus 5 slots, Codex Sol 3, Qwen 3.8 Flash 4 —
six `backend.implement` operations land five on Opus and the sixth on Codex Sol.
A 429 from Opus parks it for the rate-limit cooldown, so the next operations go
to Codex Sol until its three slots are busy and then to Qwen; when the cooldown
ends and an Opus slot is free, the next operation goes to Opus again. Nothing in
the policy is a special case: a saturated or cooling runtime simply is not in the
eligible set, and the next preference takes the operation.

`least-loaded-with-budget` remains the fallback ranking, and a role that
declares no preference list uses it even under `prefer-then-overflow`: eligible
pools are ordered by load ratio (`load / maxParallel`), then by free slots, then
by remaining daily budget, with an exact tie broken by round robin from the last
allocated runtime.

Every answer also carries `alternatives`, `overflowed` and a `blocked` list
saying why each other pool was skipped, which is what the kernel logs when it
has to wait. `release(runtime, {tokens})` returns the slot when an operation ends
and charges the tokens it used. `failed(runtime, {reason})` returns the slot too,
refunds the operation (a launch that produced nothing costs no budget) and parks
the pool.

No runtime available is not an error: the kernel keeps the operation queued and
waits for a slot.

## The budget is the provider's window

The shipped pools declare no budget of their own. What bounds them is the window
the provider actually keeps — Claude's session and week, Fable's own week,
Codex's week — probed by the supervisor and written beside the stores as
`runtime-budget.json`. A window at or past 95% is exhausted: its runtimes are
skipped with `provider window exhausted until <reset>` and come back by
themselves at the reset. Among the ready ones, more window left comes first, in
bands of 25 points. A cap of our own on top of that is what once stalled a
migration just before midnight while the provider still had half its week.

The daily counters remain in the allocator for a profile that does declare
`budget: {opsPerDay, tokensPerDay?}` — a host profile with a metered key, say —
and a pool that spends one is refused with `daily op budget exhausted` or
`daily token budget exhausted` until the UTC day rolls over. `snapshot()` prints
`remaining.ops` and `remaining.tokens` per pool; with the shipped profile both
are `null`, which is what unlimited looks like.

## Cooldowns instead of fallback

`classifyFailure(reason)` sorts a failure into `rate-limited`, `quota`, `auth`
or `other`, and `allocation.cooldownMs` gives each class a wait: ten minutes for
a rate limit (429, rate limit, too many requests, overloaded, capacity), an hour
for an exhausted quota or a billing signal, a day for a rejected credential,
five minutes for anything else. Repeated failures of the same pool multiply the
wait by `backoffFactor: 2` up to `maxCooldownMs: 3600000`; the cap limits the
backoff only, so an auth lockout keeps its full day. A successful `release`
clears the streak. A cooling pool is simply not a candidate, and `snapshot()`
lists it with its `wakeAt`, so a 429 parks one provider for ten minutes while
the other pools keep working.

## One ledger per repository

A workflow is not alone on its runtimes. Every kernel of a repository shares one
file beside the workflow directories - `.starciwork/_local/workflows/runtime-loads.json`,
schema `starci/runtime-loads@1`, written by `kernel/loads.mjs` - and
`createAllocator({shared:{path, workflow}})` reads it before it chooses. Another
kernel's live operations on a runtime are load here too, so `maxParallel` holds
across kernels; a rate limit or an exhausted quota one kernel ran into cools the
runtime down for all of them; and among candidates that all qualify the one no
other kernel is using wins, ties going to the local order. That is the whole
difference: `preferredOver` and `sharedLoad` on the receipt name what the shared
view passed over, `launched(runtime, {op})`, `release(runtime, {op})` and
`failed(runtime, {op, reason})` keep the file current, `sharedSync(ops)` drops
this workflow's leftovers at start, and `takeSharedNotices()` hands the kernel
the cooldowns it learned from somebody else. A workflow's quota is untouched by
all of it, and an unreadable ledger is not an error: the allocator falls back to
the local view. See
[workflow-kernel.md](workflow-kernel.md#runtimes-are-shared-across-workflows).

## Why there is no chain

A chain made every operation start at the same provider, so one runtime was
always the bottleneck and a rate limit there stalled the whole workflow while
four idle pools watched. Allocation inverts that: the order is a preference the
user owns, and eligibility — slots, budget, health — decides how far down it the
operation actually goes. Two rules survive from the chain era.
`verifyAvoidsImplementRuntime: true` keeps review independent —
`allocateVerify(kind, {implementRuntime})` excludes the runtime that wrote the
code, and when no other pool qualifies it returns `ok:false` with the reason so
the kernel decides whether to wait or to accept a same-runtime review. And the
launch shape still comes from the operator's environments:
`candidateFor(kind, target)` resolves it through `resolveExecutionChain` and
throws by name when a target is not in that operation's environments, so the
kernel passes `restrictTo: launchableTargets(kind)` to keep allocation inside
the launchable set. That is why every runtime carrying a role in
`model/runtimes.yaml` must also be declared in the `environments` of the
operations of that role in `model/registry.yaml`; a runtime whose role has no
profile for that operation (Astra has no working profile, so it cannot take a
`uat.verify`) is excluded by `restrictTo` instead of failing at launch.

`serialize()` returns a plain object — day, loads, used counters, streaks,
cooldowns and the last allocated runtime — and `createAllocator({runtimes,
state})` restores it, so the allocator lives inside the workflow's `state.json`
and a resumed kernel still remembers which provider is cooling down. Pools
always come from the profile; saved state contributes counters only.
