# Workflow kernel

The kernel is **one long-lived LLM agent per workflow**. It is not a service
and not a scheduler process: it is an agent that reasons over ledger
projections and mutates state only through `scripts/kernel/api.mjs`. This page
is the map; the authoritative contracts are the YAML files it cites — when
they disagree with prose, the YAML wins.

## Lifecycle

```text
owner prompt
  → node scripts/goal/define-goal.mjs        workflows + goals(rev) + inbox rows
  → node scripts/kernel/start-workflow.mjs   claims the inbox row, spawns [Kernel] <workflow_id>
  → driver loop (below)                      until every job settled + final verify pass
  → api retire                               phase=finished; history preserved, never deleted
```

Kernel death is recoverable: re-running `start-workflow` with the same goal
spawns a *replacement* kernel (attempt+1, same workflow generation) — durable
plan, jobs and events survive agent churn. A `signals` singleton row enforces
one kernel per workflow in data, not by politeness. Contract:
`modules/kernel/start-workflow.yaml`.

## The tick — `modules/kernel/driver-loop.yaml`

Each iteration, in order, expressed in api calls:

| Step | Call | Why |
| --- | --- | --- |
| survey | `api survey --workflow <id>` | Open on the ledger, never on memory: goal revision + `opChain`, all jobs, inbox, signals, event tail, open incidents. |
| plan | `api plan --workflow <id> --file <plan.json>` | Persist the derived plan; the api stores its digest and the *structural* diff vs the approved `opChain`. Divergence → `incident --kind plan-divergence`; dispatch nothing on a divergent plan. |
| enqueue | `api enqueue --workflow <id> --op <opId> --paths <csv>` | One `pending` job row per planned op the queue lacks. Refusals: `already-queued`, `empty-paths` (an op without `owned_paths` is an unbounded grant), `unknown-op`. |
| drive | `status → dispatch → wait → settle → retry\|incident` | Launch only what is disjoint (paths) and admitted (leases/budgets); settle every arrived verdict before picking again; route retries inside the kind's budget, then escalate. |
| retire | `api retire --workflow <id>` | Last call. Refuses while any job is unsettled (`jobs-unsettled`) or the final verify leg has not passed (`verify-open`). |

The kernel decides order and assignment. It never decides scope, identity or
authority, never answers an `ask` itself, and never edits the ledger by hand.

## The verbs — `modules/kernel/api.yaml`

```text
node scripts/kernel/api.mjs <verb> --repo <path> [...]
survey   status                       reads: projections only
plan     --file <plan.json>           write: plan-derived event + structural diff
enqueue  --op <opId> --paths <csv>    write: pending job row
dispatch --job <id> [--spawn] [--model <t>] [--worktree <sel>]
settle   --job <id> --verdict <pass|fail|blocked> --report <path>
incident --kind <k> --detail <s> [--op <opId>]
retire
```

Every write is one transaction + one hash-chained `events` row; every refusal
exits 1 with `{ok:false, reason}` where the reason string is the contract.

## Dispatch — `modules/kernel/dispatch.yaml`

`dispatch` reserves the lease + budget atomically, renders the packet and —
with `--spawn` — runs the terminal sequence itself through
`scripts/agent/lib.mjs` (readiness attested, packet delivered, submission
attested; agent flags injected from `modules/models/agents/<agent>.yaml`).
The packet is a bounded grant: one op, its brief (`modules/ops/ops/<op>.yaml`),
a closed read set, a closed write set (`owned_paths`), one model, one budget,
one lease token. Without `--spawn` it is a dry-run — the packet prints and
nothing is reserved. A spawn that does not land is `spawn-failed`: the
reservation is settled, never left leasing a ghost.

## Verdicts — `modules/kernel/verdict-contract.yaml`

Two layers, kept distinct: the op's **report outcome**
(`done|partial|failed|ask|blocked`, schema `starci/op-report@1`) is what the
agent claims; the kernel's **verdict** (`pass|fail|blocked`) is what the api
records after re-proof. `settle` validates the report file — identity binds
`{workflow_id, op_id, attempt, generation, lease_token}` exactly, files stay
inside `owned_paths`, and `pass` is recorded only after the op's declared
checks re-ran green on bytes computed from git. A refused settle
(`stale-settlement`, `out-of-scope-files`, `report-invalid`) is a routed
fact, never silent loss.

## What the kernel may not do

- Open `.starciwork/runtime.sqlite` or write any row directly — api only.
- Call the host (Orca) API or spawn terminals directly — `dispatch` owns host mechanics.
- Pick a model by taste — `scripts/route/route-model.mjs` resolves eligibility from `modules/models/selection.yaml`; owner `config.yaml` and an explicit `--provider` override in that order.
- Delete history — `retire` preserves goals/jobs/reports/events.
- Retry forever — routes carry per-kind limits; exhaustion is an `incident`, and identical evidence is not progress.

## Durable memory

The ledger is the kernel's memory: findings, plans and settlements are
persisted as `events`/`state_snapshots` as they form — never hoarded in
context. Re-plans keep lineage (`replannedFrom`, blocker, path delta, routing
reason) so a replacement kernel reconstructs intent from rows, not from a
dead agent's transcript.
