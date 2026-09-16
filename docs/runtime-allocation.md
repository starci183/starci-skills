# Runtime allocation: adaptive observed capacity

For enrolled workflows, measured eligibility or explicitly bounded local probation filters this pool
before budget ranking. SQLite admission enforces the shared ceiling for operation workers and model jobs;
native Orca writers also require the exclusive canonical-root reservation. Read [the execution contract](execution-contract.md).

The workflow-bound runtime profile uses adaptive allocation by default. It does
not walk an ordered provider chain. Every runtime is a pool declared in
`model/runtimes.yaml` with roles, task tiers and real parallel slots. Before
each assignment the allocator filters role, tier, tool/host launchability,
model qualification or bounded probation, independent review, cooldown, slot
capacity and fresh provider quota. Only those candidates enter allocation.
Unknown or stale quota is unknown and does not authorize an adaptive launch.

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

## The weighted observed-capacity heuristic

Allocation groups eligible runtimes by provider family before it scores them.
Two Claude models therefore contribute different suitability and real slots,
but do not duplicate Claude's family quota. Within a family, the runtime with
the best applicable fresh window is chosen first and the authored role/tier
order breaks remaining model ties.

For each family the allocator derives:

- usable headroom: the tightest applicable provider/model window's exact
  remaining percentage, with exhausted windows excluded;
- projected work: admitted operations already reserved locally or by other
  workflows, using a median duration observed for the same role and difficulty;
- recent service: actual settled run duration in the current provider-window
  segment, bounded to a rolling six hours;
- a conservative cold estimate of 15, 45 or 90 minutes for easy, medium or hard
  work when no suitable observation exists.

The explainable score is
`usableHeadroom × ownerPreference / (observedService + reservedService + estimatedNewService)`.
Service is normalized to 30-minute units only for relative scheduling; it is
never reported as provider tokens or quota consumption. The chosen family has
the highest score. A deterministic family rotation and then provider name break
an exact tie. This is a greedy heuristic over current observations, not a claim
of globally optimal scheduling.

`config.json` controls the owner bias:

```json
{"allocation":{"mode":"adaptive","preferredProvider":"codex"}}
```

`preferredProvider` is optional. A preferred feasible family receives a fixed
1.25 multiplier. This decides close choices and remains subordinate to quota,
capacity, qualification, role, tier, tool and independent-review constraints.
The old `providers: ["codex", "qwen", "claude"]` form remains readable: only
its first member becomes the preferred family; it is never interpreted as a
try-until-success chain. No preference field means automatic adaptive capacity.

Every answer carries alternatives, explicit candidate exclusions and an
`adaptive` receipt containing quota headroom, observation window, observed and
reserved service, authoritative admission load/capacity, cost estimate,
preference, score, chosen family/runtime and an `excluded` list for ineligible,
quota-unknown, exhausted, cooling or capacity-blocked candidates.
The kernel records the same bounded facts as `allocation-adaptive`; it never
records credentials or raw provider output.

A pre-admission deferral or proven no-effect launch refunds its projected
reservation idempotently. A launched attempt that did work before failing keeps
its observed service, distinct from measured provider quota. Unknown effects
retain both the adaptive reservation and the authoritative SQLite admission
lease until settlement.

No runtime available is not an error: the kernel keeps the operation queued and
waits for a slot.

## The budget is the provider's window

The shipped pools declare no budget of their own. What bounds them is the window
the provider actually keeps — Claude's session and week, Fable's own week,
Codex's week — probed by the supervisor and written beside the stores as
`runtime-budget.json`. A window at or past 95% is exhausted: its runtimes are
skipped with `provider window exhausted until <reset>` and come back by
themselves at the reset. Adaptive scoring uses exact remaining percentage and
requires a budget no older than the shared freshness bound. A stale or unread
provider stays queued with an explicit reason; it is never promoted to 100%.
A cap of our own on top of the provider window is what once stalled a migration
just before midnight while the provider still had half its week.

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
`createAllocator({shared:{path, workflow}})` reads it before it chooses. Adaptive
selection performs a locked compare-and-reserve against the ledger revision, so
a concurrent selector either sees the projected reservation or retries; it
cannot commit a decision based on the older revision. `launched(runtime,{op})`
advances that reservation, and settlement removes it. Successful or
work-consuming settlement adds a bounded duration observation; no-effect
failure and deferral do not. Rate-limit and exhausted-quota cooldowns remain
shared.

This JSON ledger is scheduling telemetry, not custody. Enrolled operation,
model and judge jobs atomically reserve `ai/global` plus
`ai/provider:<family>` in the SQLite admission journal. Provider capacity is
shared across those job kinds and across workflows; an `effect_unknown` job
keeps both leases. SQLite is the hard admission decision if telemetry and
admission race or disagree. `sharedSync(ops)` drops abandoned heuristic
reservations at restart, and unreadable telemetry never manufactures provider
quota. See
[workflow-kernel.md](workflow-kernel.md#runtimes-are-shared-across-workflows).

## Why there is no chain

A chain made every operation start at the same provider and treated alternatives
as sequential retries. Adaptive allocation treats catalog entries as an
eligible candidate set, filters them before scoring and hands the typed launcher
exactly one resolved candidate. The launcher therefore cannot reintroduce the
old Codex→Qwen→Claude order after allocation. Two independent rules remain.
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
