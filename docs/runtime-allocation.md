# Runtime allocation: prefer, then overflow

In runtime 5.0 the kernel no longer walks an ordered list of providers. Every
runtime is a pool declared in `profiles/runtimes.yaml` with the roles it may
take, how many operations it can run at once and what it may spend in a day.
For each ready operation the kernel calls `allocate(kind, {avoid})` and receives
one eligible pool — one that has the role, a free slot, budget left and no
cooldown — plus the role the worker will play. `maxParallelOps: 10` caps the
whole workflow, so ten ready operations can be in flight across Codex, Claude
and Qwen at the same time instead of queueing behind one provider.

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
    decide: [claude-fable-5.1, gpt-6-astra, claude-opus]
    plan: [claude-opus, claude-fable-5.1]
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

## Budgets

`budget: {opsPerDay, tokensPerDay?}` is per runtime and per UTC day. `usedToday`
and the token counter roll over when the day changes, so a pool that burned its
ops by 23:00 is allocatable again at 00:00. When either budget reaches zero the
pool is refused with `daily op budget exhausted` or `daily token budget
exhausted`; `snapshot()` prints `remaining.ops` and `remaining.tokens` per pool
(`null` means unlimited) so the kernel can show the day's headroom before it
schedules the next wave.

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
`profiles/runtimes.yaml` must also be declared in the `environments` of the
operations of that role in `profiles/registry.yaml`; a runtime whose role has no
profile for that operation (Astra has no working profile, so it cannot take a
`uat.verify`) is excluded by `restrictTo` instead of failing at launch.

`serialize()` returns a plain object — day, loads, used counters, streaks,
cooldowns and the last allocated runtime — and `createAllocator({runtimes,
state})` restores it, so the allocator lives inside the workflow's `state.json`
and a resumed kernel still remembers which provider is cooling down. Pools
always come from the profile; saved state contributes counters only.
