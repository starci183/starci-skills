# Worktrees

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `contexts/worktrees/schema.json` | file | validate project-local cache and durable business roots |

## Record

This module decides where run state belongs. Product truth that must survive is versioned in the project business worktree. Design candidates, authored previews, review manifests and selected compositions are session-local cache. The accepted product outcome becomes durable only when the same skill invocation writes and proves frontend source.

## Law

State is placed by what must survive. Evidence-backed business truth lives on its own branch. Rebuildable design and review material lives below the project cache and never becomes a second product authority. A design skill that asks the owner to choose a candidate must implement that choice in the same invocation; another task never resumes from cached design state.

The project segment is mandatory. `.claude` is a trust tree, never runtime storage. Target repositories receive product source only after their disclosed write boundary is approved; run bookkeeping never enters them.

## Situation codes

| Code | Situation | Where it goes |
|---|---|---|
| `WORKTREE-1` | Evidence-backed product truth must survive and be reviewed | `<Source>/.worktrees/<project>/businesses`, locked linked worktree on `codex/businesses/<project>` |
| `WORKTREE-2` | Draft, candidate, preview, review manifest or selected design awaiting same-session execution | `<Source>/.worktrees/<project>/cache`, ignored |
| `WORKTREE-3` | A path lacks the project segment or sits under `.claude` | rejected |
| `WORKTREE-4` | A durable business worktree is foreign, unlocked, dirty or on the wrong branch | rejected |
| `WORKTREE-5` | Parallel agents will mutate one file or one target source boundary | isolate or run sequentially |
| `WORKTREE-6` | A linked worktree is stale or prunable | prune deliberately through Git |
| `WORKTREE-7` | A frontend design is reviewed before implementation | keep its complete session pack in cache and execute the selected candidate before the invocation ends |
| `WORKTREE-8` | Product truth must serve FE, BE and design | stable `featureId` heads in `businesses` |

## Reading a run

1. Name every output and whether another task must read it. Business truth is durable; design review material is rebuildable and session-local.
2. Require `.worktrees/<project>/` before any state path.
3. Verify Git ownership only for durable business worktrees.
4. Isolate actual file collisions, not mere parallelism.
5. Keep candidates under `cache/design/<session-id>/`. The pack contains `baseline.json`, optional deviations-only page override, artifacts, previews, screenshots, `review-manifest.json` and `visual-proof.json`.
6. After owner approval, retain the selected pack only long enough to implement and prove the source in the same invocation. Source history, tests and browser proof are the durable record.
7. Never create layout heads, block heads, immutable design revisions or design-registry branches.

## `WORKTREE-1` — durable business truth

Business feature decisions are not reproducible from code alone, so they remain versioned under `businesses`. This situation does not authorize any design registry or accepted-preview store.

## `WORKTREE-2` — rebuildable session state

Candidates, render output, screenshots, indexes and selected design metadata can be rebuilt from business authority, grammar, contracts and source. They remain ignored cache even when expensive to produce.

## `WORKTREE-3` — invalid state path

State without a project segment can mix projects. State under `.claude` contaminates the trust tree. Both are refused.

## `WORKTREE-4` — foreign or invalid durable worktree

Only business authority requires a linked durable worktree. It must be owned by this Source, locked, clean and on the declared project branch.

## `WORKTREE-5` — parallel writes

Parallel readers and disjoint writers need no extra isolation. Agents that mutate the same source file or shared authority file run sequentially or in separate target worktrees.

## `WORKTREE-6` — stale linked worktree

Prune through Git after proving the exact target. Never delete a linked worktree directory by hand.

## `WORKTREE-7` — same-session design and execution

A design candidate has no durable head. The review pack binds the four-lock baseline, StarCi MASTER, deviations-only page override, business head, grammar/profile receipt, contract evidence, candidate key and same-viewport proof. Approval authorizes the selected candidate and exact source boundary once. That invocation implements, tests and visually proves the result.

## `WORKTREE-8` — product truth

Business feature heads remain durable because FE, BE and design must share the same actors, flows, rules, states and outcomes. Design choices do not enter that registry.

## Inputs

| Input | Evidence required |
|---|---|
| project | explicitly declared project |
| source | Source repository owning trust and local state |
| business root | Git-owned, locked, clean project business worktree |
| cache root | ignored project cache path |
| design session | one invocation identity and routed source baseline |
| target source | approved exact frontend write boundary |

## Rules

1. Business truth is durable; design review material is cache.
2. Design approval and source execution happen in one skill invocation.
3. No task may consume another task's cached design as authority.
4. The project segment is mandatory.
5. `.claude` never stores runtime state.
6. Durable business worktrees must be Source-owned, locked and clean.
7. Isolation follows actual write collisions.
8. Stale linked worktrees are pruned through Git.
9. Frontend source plus executable proof is the durable accepted design outcome.
10. No design registry, layout head, block head or immutable preview revision is created.

## Exceptions

- A cache pack may remain after completion for local debugging, but it stays ignored and has no authority.
- Conversation provenance and business authority may use their own explicitly routed durable stores; they are not design registries.
- A design-only request that explicitly forbids implementation may render candidates, but the result expires with the invocation and cannot be called accepted authority.

## Output

```text
output: <business authority | design session | source implementation>
durability: <durable | rebuildable | product source>
path: <business worktree | project cache | routed frontend>
session: <same invocation identity when design is involved>
reason: <fact deciding placement>
```
