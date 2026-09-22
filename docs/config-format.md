# Local config format

StarCi keeps **local runtime preferences** in ignored `config.yaml` at the skill root. That file is host-local state, never part of the shipped source payload, and is not overwritten by install/update when it already exists.

## Example source

| File | Role |
| --- | --- |
| `config.example.yaml` | The authored example and the shipped defaults (`language: vi`, `model: null`, `effort: medium`). |
| `config.yaml` | User-local runtime config. Seeded verbatim — comments included — from `config.example.yaml`, only when missing. |

## Init copy policy

`engine/config.mjs` `loadConfig(root, {initialize:true})`:

1. With `initialize`, copy `config.example.yaml` verbatim to `config.yaml` under `root` when `config.yaml` is absent (best effort).
2. Read `config.yaml` if present; otherwise read `config.example.yaml`.
3. Validate the result and refuse an unknown key; an existing owner file is never rewritten by example updates.

## Shape

Required keys:

- `language` — BCP-47-like tag (`vi`, `en`, …)
- `model` — `null` (inherit host) or non-empty host model name
- `effort` — one of `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`
- `models.selection` — `quota-aware`; selection happens before a call
- `models.pools` — the one closed cross-provider pool, `sol-opus` (`claude-agent` and `codex-agent`, in route
  order); every member is a known runtime with the role its consumers require
- `models.nonOperation` — the closed mapping from the three non-operation roles to one declared pool

Optional keys:

- `kernel` — the `[Kernel]` seat: a single pin `{agent?, model?, effort?}` or a group
  `{group: [{agent, model?}, ...], effort?}` (below); absent or all-null means routing decides
- `budgets` — `{maxOps?, perOpMs?, dailyTokens?}` owner ceilings; positive integers or null
- `parallel` — `{gear}`; the one parallelism knob, below
- `allocation.mode` — `adaptive`; fresh quota, current admitted load, recent service and task/model suitability
  are recomputed before every future assignment
- `allocation.preferredProvider` — `null` for automatic capacity or one declared provider id for a bounded
  preference; this never forms a fallback chain
- `debug` — boolean

## Kernel group

The kernel is a model group, not a single model. The shipped default is
`kernel: {group: [{agent: claude, model: claude-opus-5-5}, {agent: codex, model: gpt-6-sol}], effort: high}`:
`scripts/kernel/start-workflow.mjs` tries the members in order, skips one whose provider quota probe reads
`dead` or whose ledger provider-health circuit is open, puts a `limited` one last, and — when a member's
launch is refused before the model took any input (an interactive gate such as the Claude first-run screen,
an auth screen, a readiness or model-attestation failure) — closes that terminal and boots the next member in
the same start (the rule and its step list are `modules/kernel/start-workflow.yaml` `spawn.fallThrough`).
`engine/config.mjs` refuses an empty group, an agent named twice, an unknown agent, a model no runtime of
that agent declares, and a group mixed with `agent`/`model` keys. A single pin `{agent, model, effort}` keeps
its meaning: it is authoritative and fails closed rather than substituting. With no `kernel` key the unpinned
route is the same think group, resolved by `scripts/route/route-model.mjs` (`modules/models/selection.yaml`
`decisionFlow` `kernel-function` and `kernel-availability`).

## Parallelism

`parallel.gear` is the only knob for how wide one operation runs. It is an integer that indexes the
agent table in `modules/models/runtimes.yaml` `allocation.slicing.size`, whose keys are the classes
`api estimate` assigns a measured write closure:

| size | what it is | agents at each declared gear |
| --- | --- | --- |
| `s` | the whole closure fits inside `allocation.slicing.targetMinutes[0]` | always 1 |
| `m` | larger than `s`, below the `l` bounds | always 1 |
| `l` | a count reaches `size.l.from` | `size.l.agents[gear]` |
| `xl` | a count reaches `size.xl.from` | `size.xl.agents[gear]` |

The classes' bounds and the agent counts are data in `runtimes.yaml`, not here — read them there.
The declared gears are `allocation.slicing.gears`; a `gear` outside that list fails closed like any
other unknown key, and an absent `parallel` block means the first declared gear
(`engine/config.mjs` `slicingGears`, `parallelGear`).

Three rules hold at every gear:

1. **`s` and `m` operations are always one agent.** The table applies to `l` and `xl` only.
2. **A gear never raises a ceiling.** It raises only what `api estimate` *requests*. A pool's
   `runtimes.<pool>.maxParallel`, the fleet's `maxParallelOps` and the workflow's `budgets.maxOps`
   all clamp it afterwards, and the lowest one admits.
3. **Requested is not achievable.** `api estimate` returns `agentsRequested` from this table and
   `agentsAchievable` after the closure's disjoint path partition bounds it — a two-directory
   closure runs two agents however high the gear is, and `reason` says so.

| non-operation role | required runtime role | default pool |
| --- | --- | --- |
| `planner` | `plan` | `sol-opus` |
| `kernelManager` | `decide` | `sol-opus` |
| `validator` | `verify` | `sol-opus` |

The roles and the default pool are `engine/config.mjs`
(`NON_OPERATION_ROLES`, `DEFAULT_MODEL_POOLS`), which also refuses an unknown
pool name, a pool that is not its canonical pair, or members that lack the
required role. The kernel's own model call kinds are
`modules/models/selection.yaml` `kernelFunctionKinds`.

## Model routing

Model routing holds the owner's rules as data. The `[Kernel]` seat is the Claude Opus 5.5 then GPT-6 Sol
group ([Kernel group](#kernel-group)). Every kind has one
entry in `modules/models/runtimes.yaml` `roleOfKind` — its role, whether its work is `think` or `hands-on`,
and the difficulty `floor` read from what its op does. Think work is any op whose output is a canonical
record (SRS, SDS, scope, goal, decision, brand, UI, Work, workspace, rule) or a verdict about quality; it
runs only on `allocation.preference.think`, Claude Opus 5.5 then GPT-6 Sol, at a hard floor where
`codex-agent` pins Sol, and neither `allocation.preferredProvider` nor `--prefer` can add a pool to that
order. Hands-on work — implementing, testing, refactoring, running and measuring under a settled record —
walks the `allocation.tiers` implement, write and verify orders: Qwen and Devin first, the frontier pools as
overflow. Source setup (`backend.scaffold`, `interface.scaffold`, `package.scaffold`) keeps the difficulty
its scope measures and may land on any pool. A floor raises a measured difficulty and never lowers it
(`scripts/agent/models.mjs` `selectPool`). The non-operation pool lists its members in route order, Claude
first; Qwen and Devin carry neither `plan` nor `decide`, so these functions never reach them. Functions
retain separate typed inputs and independent contexts even though they share a pool.

Operation candidates still come from the operation policy and runtime catalog, but adaptive allocation treats
catalog order as eligibility/suitability rather than sequential fallback. It groups candidates by provider
family so several models do not multiply one family's quota, and combines fresh quota with atomic admitted
family load. The runtime pin seals the accepted `config.yaml` digest, so config changes apply to future
assignments only after a new pin and an orderly same-id restart/retry boundary; a running dispatch never changes
identity.

## Runtime naming

| Name | Meaning | Example |
| --- | --- | --- |
| `launcher` | Human chat surface invoking entry skills | `codex-chat` |
| `host` | Workflow execution environment | `orca` |
| `agent` | Executable/Orca adapter | `codex` |
| `provider` | Credential, billing and quota family used by allocation | `codex` |
| `model` | Concrete model identifier | `gpt-6-sol` |
| `profile` | StarCi capability/routing profile | `codex-agent` |
| `runtimePool` | Capacity pool selected by the allocator | `codex-agent` |

An `agent` and `provider` may currently carry the same string, but their fields
are not interchangeable. Routing records use `provider` for quota authority.

Files without `allocation` resolve to `{mode:"adaptive", preferredProvider:null}` in memory.
