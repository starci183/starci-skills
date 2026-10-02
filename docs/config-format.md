# Local config format

StarCi keeps **local runtime preferences** in ignored `config.yaml` at the skill root. That file is host-local state, never part of the shipped source payload, and is not overwritten by install/update when it already exists.

## Example source

| File | Role |
| --- | --- |
| `config.example.yaml` | The authored example and the shipped defaults (`language: vi`, `model: null`, `effort: medium`). |
| `config.yaml` | User-local runtime config. Seeded verbatim — comments included — from `config.example.yaml`, only when missing. |

## Init copy policy

1. The installer (`scripts/install/install.mjs` seedConfig) copies `config.example.yaml` verbatim to `config.yaml` when it is absent; nothing else writes it.
2. `engine/config.mjs` `loadConfig(root)` reads `config.yaml` if present, otherwise `config.example.yaml`.
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
- `budgets` — `{maxOps?}`: the concurrent-op ceiling of one workflow; a positive integer or null
- `parallel` — `{gear}`; the one parallelism knob, below
- `allocation.mode` — `adaptive`; fresh quota, current admitted load, recent service and task/model suitability
  are recomputed before every future assignment
- `allocation.preferredProvider` — `null` for automatic capacity or one declared provider id for a bounded
  preference; this never forms a fallback chain
- `allocation.policy` — `prefer-then-overflow` (the `runtimes.yaml` default: first eligible pool of the tier
  order) or `balanced` (the first eligible pool of the order still below its target share of the jobs
  dispatched in the last `windowHours`, counted over this repo's ledger and the host's other product ledgers;
  when every eligible pool is at or over its share, the one furthest below)
- `allocation.shares` — `{<runtime pool>: <weight>}` target shares, normalized over the named pools
- `allocation.windowHours` — the balanced window in hours (default and bound: `engine/config.mjs`)
- `allocation.grants` — `['<pool>=<slots>@<role>+<role>']`, the default grant every workflow gets; once
  declared it is the whole set, so a `capacityAuthority: explicit-workflow-quota` pool (Devin) routes only
  for the granted roles and up to the granted running slots
- `debug` — boolean
- `specs` — `{harness?, unit?, e2e?}` booleans or null (owner, 2026-09-28 and 2026-09-29; `engine/config.mjs`
  `specsSettings`, defaults in `SPEC_DEFAULTS`); a config without the key gets the defaults, so the shipped example
  carries no block. `harness` (default **false**, touching-only): `.claude` work writes and runs the specs of new or changed
  code, the land gate runs only the specs touching the landed files (`land.mjs --specs touching`, its default) and refuses
  `--specs all` unless `harness: true`; `--specs none` needs `--reason`. The full `.claude` suite runs in exactly one place,
  the `/push-git` flow (`scripts/supervisor/push-git.mjs`), which needs no key. `unit` (default **true**): a code-writing
  op writes or updates the unit specs of the source it changes and runs only those; the whole unit suite is `unit.verify`'s
  (only when the goal asks) or `/push-git`'s. `e2e` (default **false**): e2e runs only when the goal or the owner asks,
  then `e2e.verify` runs the full e2e suite (see "Product test switches")
- `connectors` — the public owner-ask channel `{secretsFile?, repos?, gateway?, cloudflare?, telegram?}`,
  all off by default; secrets are named by env var, never stored (docs/connectors.md)
- `supervisor` — `{mode?, kernel?, pollIntervalMs?, repos?, stallMinutes?, frozenMinutes?, workers?, landGate?}`:
  the Supervisor seat, optional chat digest cadence and managed product repositories; the reconciler
  Host and Workflow controllers own seat recovery and stall detection ([supervisor](supervisor.md);
  defaults `scripts/machine/home.mjs` `DEFAULTS`)
- `reconciler` — `{enabled?, profile?, controllers?}`: `profile` `operational` (job, host, workflow, resource active; gc, fleet,
  learning shadow) or `observe` (all shadow) sets every controller's default mode; `controllers.<name>.mode`
  (`off|shadow|active`) overrides one. The `start` skill applies and checks `operational` (docs/architecture.md "The reconciler")
- `delegation` — `{asks, until, excludes?, note?}` or null: a named delegate answers owner asks until `until`;
  the excluded classes stay owner-only
- `asks` — `{autoAcceptRecommended?, excludes?}` or null: answer an ask that carries a recommended option with
  it instead of serving it; `excludes` names the ask classes that always reach the owner (`engine/config.mjs`
  `ASKS_DEFAULTS`; a handover ask is always excluded; `draw-review` opts drawings out - otherwise a drawing
  the owner did not ask to review is accepted without the owner)
- `uat` — `{maxConcurrent?}` or null: the machine-wide ceiling of concurrent UAT runs (`scripts/uat/uat-slots.mjs`;
  default `engine/config.mjs` `UAT_DEFAULTS`)

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
route is the `sol-think` order - Sol first, Opus as overflow - resolved by `scripts/route/route-model.mjs`
(`modules/models/selection.yaml` `decisionFlow` `kernel-function` and `kernel-availability`).

## Parallelism

`parallel.gear` is the only knob for how wide one operation runs. It is an integer that indexes the
agent table in `modules/models/runtimes.yaml` `allocation.slicing.size`, whose keys are the classes
`starci kernel estimate` assigns a measured write closure:

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
2. **A gear never raises a ceiling.** It raises only what `starci kernel estimate` *requests*. A pool's
   `runtimes.<pool>.maxParallel`, the fleet's `maxParallelOps` and the workflow's `budgets.maxOps`
   all clamp it afterwards, and the lowest one admits.
3. **Requested is not achievable.** `starci kernel estimate` returns `agentsRequested` from this table and
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
runs only on `allocation.preference.think`, Claude Opus 5.5 and GPT-6 Sol, at a hard floor where
`codex-agent` pins Sol, and neither `allocation.preferredProvider` nor `--prefer` can add a pool to that
order; under `balanced` Opus takes it until it reaches its share and Sol after. Review is the exception:
the verify kinds still declared on it and `work.author` walk the `review` order - Devin,
with Opus and Sol as overflow only (`allocation.overflowByOrder`, under either policy) - and a
verify kind goes to another audit family than the op whose output it reads (`allocation.frontier` and
`allocation.hands`): what Devin implemented is reviewed by Opus or Sol. Owner routing
2026-09-26 adds two more orders: the UI verifications (`interface.audit`, `e2e.verify`, `security.verify`,
`uat.assisted.verify`) walk `ui` - Sol first, Devin behind it - and the mechanical ops
(`provision.ask`, `workspace.manage`, `task.execute`, `knowledge.repair`) walk `implement`, which the hands
serve whatever the kind's role. `interface.draw` and
`interface.asset` walk the `draw` order, Codex only (the image tool). Hands-on work — implementing, testing,
refactoring, running and measuring under a settled record — walks the `allocation.tiers` implement, write
and verify orders: Devin first, then Codex, at medium and hard, Codex first at
easy, Opus as overflow. Scaffold, docs, content and grammar work and every hands-on cut slice walk the
`scaffold` order, Devin first. Source setup (`backend.scaffold`, `interface.scaffold`, `package.scaffold`) keeps the difficulty
its scope measures. A floor raises a measured difficulty and never lowers it
(`scripts/agent/models.mjs` `selectPool`). The non-operation pool lists its members in route order; with no
`kernel` key the kernel's own model calls walk `sol-think`, Sol first, and Devin carries neither
`plan` nor `decide`, so those functions never reach them. Functions
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

Files without `allocation` resolve to `{mode:"adaptive", preferredProvider:null, policy:null, shares:null,
windowHours:24, grants:null}` in memory: the `runtimes.yaml` default policy and no grant gating.

## Product test switches (`specs.unit`, `specs.e2e`)

Owner rulings 2026-09-28 ("speed up development; test later when asked") and 2026-09-29. `specs.unit` (default on)
covers the back end's unit tests in workflows (jest and its per-file coverage threshold, and the services' coverage Sonar
judges; the front end has no tests): while on, an op that writes code also writes or updates the specs of that code and runs only
those - the specs of the changed or added source and the specs that import it - through the op gate (`gate.mjs --tests`),
never the app's whole unit suite; `unit.verify` is the op that runs the whole unit suite (`npm test`), dispatched only when the goal
or the owner asks for it ("full unit", or its Vietnamese phrase for running the whole unit suite), never by default. `specs.e2e` (default off) covers product
e2e (e2e.verify, Playwright and `*.e2e-spec.*` specs): it runs only when the goal or the owner asks, and `e2e.verify`
then runs the full e2e suite. `false` for either family switches that class off for the workflow. uat.verify is neither:
it is owner-deferred separately until credentials. The switches are read per call
(`scripts/route/spec-deferral.mjs` `ownerSpecs`), so the route plan and a Kernel pick a flip up on the next wake with
no restart.

What an op does when a class is off is its brief's `policy.specsToggle.<class>`:

- `defer-leg` (test.author, e2e.verify; a test.author leg is e2e when every owned path is an e2e path) - never
  dispatched. `starci kernel enqueue`, `starci kernel route` and `starci kernel dispatch` settle its queued job `succeeded` with result
  `{verdict: deferred, deferred: {kind, reason: specs.<class>=false, at, via}}` and a `tests-deferred` event: no
  lease, no dispatch, no attempt spent. Nothing waits on it: plan ancestors, the dependency gate and nextActions
  skip it, and a deferred queued job is a dispatch nextAction whatever held it.
- `skip` (backend.implement, interface.implement, code.refactor) - the op runs; the dispatch prompt's `specs:`
  line tells it to run and write no such tests and to demand no changed-line coverage. Sonar still runs, with
  `sonar-local.mjs scan`, which reads `specs.unit`: while it is off the scan runs no unit test, reports the slice's
  coverage as NOT MEASURED with an owner-mode note in the scan JSON (never green), and settle accepts that note only
  while the owner switch is really off; bugs, smells and security findings still gate. A skipped gate is recorded as a check named `specs.unit` / `specs.e2e`, exit 0.
- `not-counted` (review.verify, handover.review) - the gate does not count those tests or that coverage; `api
  coverage` (and the handover-proof-owed refusal) drops that `requiresProof` kind from must-haves (`notCounted`).

`starci kernel status` lists `testsDeferred {off, jobs, planned}` and a `tests deferred` line (legs carry `deferred`);
`starci kernel plan` and `route-plan.mjs` mark deferred legs. `starci kernel run-deferred-tests --workflow <id> [--kind unit|e2e|integration]
[--dry-run]` is "test later": it re-queues the deferred jobs on their same attempt with `payload.specsForced`, and
they then run their whole brief even while the switch is still off.

## Host roots (`roots`)

`roots: {archive?, lanes?}` (config.yaml, gitignored) relocates the two host roots the runtime owns: the archive (session files, blob
retention, ledger backups) and the lane worktrees. Each key is an absolute directory or `null`; a relative path, a non-string or an
unknown key is refused with `Invalid config.yaml: roots...`. Resolution, in one place (`archiveRoot()` and `lanesRoot()` in
`scripts/machine/home.mjs`): the environment variable (`STARCI_ARCHIVE_ROOT`, `STARCI_LANES_ROOT`), then the owner key, then
`<starciLocalRoot>/archive` and `<starciLocalRoot>/lanes`. The tracked config declares no host location.
