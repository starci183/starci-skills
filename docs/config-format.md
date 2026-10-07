Task: write the host-local config.yaml
# Local config format

StarCi keeps **local runtime preferences** in ignored `config.yaml` at the skill root. That file is host-local state, never part of the shipped source payload, and is not overwritten by install/update when it already exists.

## Example source

| File | Role |
| --- | --- |
| `config.example.yaml` | The authored example and the shipped defaults (`language: vi`, `model: null`, `effort: medium`). |
| `config.yaml` | User-local runtime config. Seeded verbatim — comments included — from `config.example.yaml`, only when missing. |
| `secret.env.example` | Tracked credential placeholders; [Host credentials](host-secrets.md) owns local setup. |
| `secret.env` | Owner-created local plaintext credentials; excluded from Git, package payload and installer custody. |

## Init copy policy

1. The installer (`scripts/install/install.mjs` seedConfig) copies `config.example.yaml` verbatim to `config.yaml` when it is absent; nothing else writes it.
2. `engine/config.mjs` `loadConfig(root)` reads `config.yaml` if present, otherwise `config.example.yaml`.
3. Validate the result and refuse an unknown key; an existing owner file is never rewritten by example updates.

## Shape

Required keys:

- `language` — BCP-47-like tag (`vi`, `en`, …)
- `model` — `null` (inherit host) or non-empty host model name
- `effort` — one of `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`

Optional keys:

- `launchTrust` — null by default, or `{profile: automatic | declined, approvedBy: owner, approvalRef, roots}`. The current owner records adoption and exact absolute repository roots; this declaration authorizes the managed launch trust/settings/guard preparation for those roots. Existing Git worktrees are checked against their exact main repository root. A directory prefix, unrelated checkout, missing profile or provider-side decline grants no consent. The runtime never copies a historical owner's approval into a new installation. Native provider account authentication remains separate.
- `retention.workflowPurge` — null by default, or `{approvedBy: owner, approvalRef, repos}` with exact absolute ledger-owner repository roots. Adoption permits automatic verified archive-and-purge of settled, uncited workflows after the declared retention window. Without adoption the sweep reports and keeps those candidates. This profile does not authorize deleting an unidentified database or changing live jobs.
- `kernel` — the `[Kernel]` seat pin `{agent?, model?, effort?}` (below); absent or all-null means the `high` tier chain decides
- `models` — optional overlay of the shipped model tiers: `{tiers?, seats?, balance?, usage?}` ("Model tiers" below)
- `budgets` — `{maxOps?}`: the concurrent-op ceiling of one workflow; a positive integer or null
- `parallel` — `{gear}`; the one parallelism knob, below
- `allocation.grants` — `['<pool>=<slots>@<role>+<role>']`, the default grant every workflow gets; once
  declared it is the whole set, so a `capacityAuthority: explicit-workflow-quota` pool (Devin) routes only
  for the granted roles and up to the granted running slots
- `debugLoop` — `{interval?, worktreeLimit?}`: the cadence of the chat `/loop` that runs `starci debug digest`
  (`<n>s`, `<n>m` or `<n>h`, positive; shipped default `10m`) and the positive integer worktree alert threshold of
  `starci debug run core-watch` (shipped default 40). Both keys are optional and read through `engine/config.mjs`
  `debugLoopSettings`. The removed `debug` and `coreDebug` keys are refused by name.
- `specs` — `{harness?, unit?, e2e?}` booleans or null (owner, 2026-09-28 and 2026-09-29; `engine/config.mjs`
  `specsSettings`, defaults in `SPEC_DEFAULTS`); a config without the key gets the defaults, so the shipped example
  carries no block. `harness` (default **false**, touching-only): `.claude` work writes and runs the specs of new or changed
  code, the land gate runs only the specs touching the landed files (`land.mjs --specs touching`, its default) and refuses
  `--specs all` unless `harness: true`; `--specs none` needs `--reason`. The full `.claude` suite runs in exactly one place,
  `/starci release` selects the [release procedure](../skills/starci/references/release.md), after the owner sees
  the concrete release context and approves it with `OK`; this needs no specs key. That procedure invokes
  `starci release cut` through `scripts/supervisor/release-cut-cli.mjs` and `scripts/supervisor/release-cut.mjs`.
  The native owner runs L4 once, including Linux parity, checks that frozen main stayed unchanged, and
  gates the annotated tag and atomic main-plus-tag push ([release governance](git-governance.md)).
  `unit` (default **true**): a code-writing
  op writes or updates the unit specs of the source it changes and runs only those; the whole unit suite is `unit.verify`'s
  (only when the goal asks) or that approved release. `e2e` (default **false**): e2e runs only when the goal or the owner asks,
  then `e2e.verify` runs the full e2e suite (see "Product test switches")
- `connectors` — the public owner-ask channel `{repos?, gateway?, cloudflare?, telegram?}`,
  all off by default; credential fields name environment variables ([connectors](connectors.md)).
  [Host credentials](host-secrets.md) owns their local storage and selected-action preflight.
- `supervisor` — `{mode?, kernel?, pollIntervalMs?, repos?, stallMinutes?, frozenMinutes?, workers?, landGate?}`:
  the Supervisor seat, optional chat digest cadence and managed product repositories; the reconciler
  Host and Workflow controllers own seat recovery and stall detection ([supervisor](supervisor.md);
  defaults `scripts/machine/home.mjs` `DEFAULTS`)
- `reconciler` — `{enabled?, profile?, controllers?}`: `profile` `operational` (job, host, workflow, resource active; gc, workers,
  learning shadow) or `observe` (all shadow) sets every controller's default mode; `controllers.<name>.mode`
  (`off|shadow|active`) overrides one. Approved workflow startup automatically ensures the host is ready;
  `/starci start` is also an explicit inspection or recovery action and checks `operational`. No separate
  manual startup skill is required. Only an explicit profile update writes that block
  (docs/architecture.md "The reconciler")
- `delegation` — `{asks, until, excludes?, note?}` or null: a named delegate answers owner asks until `until`;
  the excluded classes stay owner-only
- `asks` — `{autoAcceptRecommended?, excludes?}` or null: answer an ask that carries a recommended option with
  it instead of serving it; `excludes` names the ask classes that always reach the owner (`engine/config.mjs`
  `ASKS_DEFAULTS`; a handover ask is always excluded; `draw-review` opts drawings out - otherwise a drawing
  the owner did not ask to review is accepted without the owner)
- `uat` — `{maxConcurrent?}` or null: the machine-wide ceiling of concurrent UAT runs (`scripts/uat/uat-slots.mjs`;
  default `engine/config.mjs` `UAT_DEFAULTS`)

## Caller and automatic maintenance

The single public `/starci` entry resolves the Source host and project binding, presents the concrete
goal and startup scope, and waits for the owner's `OK` before workflow startup.
An unclear request or a new goal needs its own approval. The native `starci workflow start` owner
ensures the host is ready before claiming that goal; `--plan` starts neither services nor workers.

Kernel `--agent`, `kernel` pins, the configured Supervisor and operation routes are the only model inputs of a start;
the calling chat's own model is not a routing input. Debugging is a `/loop` of that chat (`skills/starci`), not a seat.

Public startup readiness belongs to the existing host owner:
`/starci start` succeeds only after the required checklist, including the public harness, is green.

## Kernel seat

`kernel` is `{agent?, model?, effort?}`. The seat takes the `high` tier. `agent` and `model` pin it as the bias
`only`, keeping the tier's model of that agent; an absent or all-null pin lets the chain decide.
`scripts/kernel/start-workflow.mjs` applies `modules/models/selection.yaml` `newAgentAdmission` to the chain before launch;
a later member is tried only after the prior attempt has definitive no-effect evidence, as specified by
`modules/kernel/start-workflow.yaml` `spawn.fallThrough`.

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
   `registry.yaml` `pools.<pool>.maxParallel`, the workers' `maxParallelOps` and the workflow's `budgets.maxOps`
   all clamp it afterwards, and the lowest one admits.
3. **Requested is not achievable.** `starci kernel estimate` returns `agentsRequested` from this table and
   `agentsAchievable` after the closure's disjoint path partition bounds it — a two-directory
   closure runs two agents however high the gear is, and `reason` says so.

## Model tiers

`modules/models/tiers.yaml` owns which model takes which work; `config.yaml` `models` overlays it. A **tier** is an
ordered chain of members `{agent, model, effort?}`; a model may sit in several tiers, and a new tier or member is one line.

| tier | chain (first to last) | takes |
| --- | --- | --- |
| `frontier` | Claude Opus 5.5, Codex `gpt-6.1-sol` | the Supervisor; planner, validator, kernelManager; ops of difficulty `insane` |
| `high` | Claude Sonnet 5.5, Codex `gpt-6.1-sol` | the Kernel and `[Worker]` seats; ops of difficulty `hard` |
| `medium` | Devin `swe-2-max`, Codex `gpt-6.1-sol` | ops of difficulty `medium` |
| `low` | Devin `swe-2-max`, Codex `gpt-6-luna` | ops of difficulty `easy` |
| `imagegen` | Codex `gpt-6.1-sol` | a call tier: only the headless image call (below), never a seat or an op |

### Call tiers

A tier named `call` under `tierUse` in `tiers.yaml` is taken by one headless call, never by a seat or an op: the
validator refuses a config whose seat, difficulty, kind, order or caller reference names it, and the picker refuses to
seat an op on it. `calls.<name>` binds a call to its tier and bounds it (`timeoutMs`, `maxImages`, `maxReferences`).

`imagegen` is the one call. An op that draws (`interface.draw`, `interface.asset`, and the image part of `brand.decide`)
runs on the tier of its difficulty like every core op and, when it needs an image, runs

```
starci work imagegen --prompt <file> --out <dir in the worktree> [--reference <image>]... [--count N] [--size WxH] [--name <stem>] --json
```

The verb admits the call through the picker over the `imagegen` chain (hard filter, owner bias, balance, a member at
`reservePercent` of its tokens is skipped), holds one provider slot for the duration of the run, runs `codex exec`
headlessly with the built-in image tool (read-only sandbox, nothing persisted, no seat identity), copies the generated
PNGs into `--out` as `<stem>-<n>.png` with `<stem>-<n>.prompt.txt` and appends one entry per image to
`<out>/generation-receipts.yaml` (`starci/generation-receipts@1`: model, effort, sha256 of image and prompt, toolOutputBasename,
real pixel size, duration, token usage). `--size` is a request: the tool decides the size and the receipt records it. A
refusal is typed and carries no retry: `IMAGEGEN_QUOTA`, `IMAGEGEN_CAPACITY`, `IMAGEGEN_UNAVAILABLE`,
`IMAGEGEN_RUNNER_FAILED`, `IMAGEGEN_TIMEOUT`, `IMAGEGEN_NO_OUTPUT`, `IMAGEGEN_BAD_INPUT`, `IMAGEGEN_OUT_OF_WORKTREE`; the op
reports it and the kernel's incident policy decides any retry. Only the ops named under `calls.imagegen` of
`modules/kernel/command-policy.yaml` may run the verb, and a hand-run `codex exec` stays refused.

`models` accepts four optional keys: `tiers` (`{<tier>: [{agent, model, effort?}, ...]}` replaces or adds a chain),
`seats` (`{<seat>: <tier>}` remaps a seat), `balance` (`{maxStreak, maxSharePercent}`) and `usage`
(`{reservePercent, biasPercent, exhaustedPercent}`). `engine/model-config.mjs` validates every member against
`registry.yaml` and refuses an unknown key.

### The pick

One function (`scripts/lib/tier-pick.mjs`) serves every seat and every op; `scripts/agent/admission.mjs` runs it with
the live facts. Precedence: hard filter, owner bias, a live seat keeps its member, balance, chain order by tokens.

1. **Hard filter** (a bias cannot override it): the member is not authenticated or its token is stale; its provider circuit
   is open or its runtime or binary is missing; it is not qualified for the role (including Devin's explicit grant, below);
   its pool is at maximum parallel. A member that failed to launch earlier is skipped for that pick and the failure is
   recorded, but it stays in the chain.
2. **Owner bias** from the goal prompt applies to every seat: `prefer X` moves X to the front, `avoid Y` removes it,
   `only X` keeps X. A bias that empties the chain refuses with the reason. `--agent` and `kernel.agent` /
   `supervisor.kernel.agent` are `only <agent>` and keep the tier's model of that agent.
3. **A live seat keeps its member.**
4. **Balance**: a head member picked more than `maxStreak` times in a row, or holding more than `maxSharePercent` of
   the tier's running seats, yields to the next eligible member; a bias skips this step.
5. **Tokens**: an automatic pick skips a member at `reservePercent` (90) or more of its tokens. A member the owner bias
   names stays usable from 90 up to `biasPercent` (95); from 95 it is refused even with a bias; from 100 it is never used.
   A chain with no member left refuses and reports the earliest reset.
6. **Reserve, launch, attest.** A proved no-effect failure continues down the chain in the same attempt; an unknown effect
   stops for reconciliation (`modules/kernel/start-workflow.yaml` `spawn.fallThrough`).
7. **Record**: every pick keeps its tier, the chain after each step, who was dropped and why, and the winner with the
   deciding step. `workflow start --plan`, `route-model --plan` and the route receipt print it.

The Devin grant gate stays: a pool whose `registry.yaml` `capacityAuthority` is `explicit-workflow-quota` is in the hard
filter unless `allocation.grants` opens it for the role and slot count.

## Model routing

Model routing reads each kind's role and difficulty floor from `modules/models/runtimes.yaml` `roleOfKind`. A floor raises
measured difficulty and never lowers it; the difficulty names the tier (`tiers.yaml` `difficulty`).
`modules/models/selection.yaml` owns common admission for all agent roles: quality and eligibility, every fresh quota
window, authentication, provider circuit, shared capacity and Critic independence. `allocation.admission` owns the role
floors. See [agent admission](agent-admission.md) for the reservation and uncertain-launch lifecycle.

### Keys of an earlier shape

A `config.yaml` that still holds one of these keys is refused, naming the key and its new place:
`models.pools`, `models.nonOperation`, `models.selection`, `allocation.shares`, `allocation.windowHours`,
`allocation.preferredProvider`, `allocation.policy`, `allocation.mode`, `kernel.group`, `supervisor.kernel.group`
(`engine/model-config.mjs` `REMOVED_KEYS`).

The runtime pin seals the accepted `config.yaml` digest. Config changes apply to future assignments
through a new pin and an orderly same-id restart or retry boundary; a running dispatch keeps its identity.

## Runtime naming

| Name | Meaning | Example |
| --- | --- | --- |
| `launcher` | Human chat surface invoking entry skills | `codex-chat` |
| `host` | Workflow execution environment | `orca` |
| `agent` | Executable/Orca adapter | `codex` |
| `provider` | Credential, billing and quota family used by allocation | `codex` |
| `model` | Concrete model identifier | `gpt-6.1-sol` |
| `profile` | StarCi capability/routing profile | `codex-agent` |
| `runtimePool` | Capacity pool selected by the allocator | `codex-agent` |

An `agent` and `provider` may currently carry the same string, but their fields
are not interchangeable. Routing records use `provider` for quota authority.

Files without `allocation` resolve to `{grants:null}` in memory: no grant gating.

## Product test switches (`specs.unit`, `specs.e2e`)

Owner rulings 2026-09-28 ("speed up development; test later when asked") and 2026-09-29. `specs.unit` (default on)
covers the back end's unit tests in workflows (jest and its per-file coverage threshold, and the coverage Sonar
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

`roots: {archive?, lanes?, temp?}` (config.yaml, gitignored) relocates the three host roots the runtime owns: the archive (session files, blob
retention, ledger backups), the lane worktrees and the temp root (every temporary file the runtime creates). Each key is an absolute directory or `null`; a relative path, a non-string or an
unknown key is refused with `Invalid config.yaml: roots...`. Resolution, in one place each (`archiveRoot()` and `lanesRoot()` in
`scripts/machine/home.mjs`, `tempRoot()` in `engine/temp-root.mjs`): the environment variable (`STARCI_ARCHIVE_ROOT`, `STARCI_LANES_ROOT`, `STARCI_TEMP_ROOT`), then the owner key, then
`<starciLocalRoot>/archive` (`<runtime root>/.runtime/archive`) and, for lanes, a per-user profile directory kept out of the checkout (`<LOCALAPPDATA>/StarCi/lanes`, `<STARCI_LOCAL_ROOT>/lanes` when that seam is set); an absent `temp` means the OS temp directory (`TEMP`, `TMP`, `TMPDIR`, else `os.tmpdir()`). The tracked config declares no host location.

The temp root receives the runtime's own temp directories and files (land and release scratch, gate staging, dispatch prompts, op scratch,
scan work dirs). The processes the runtime starts through `scripts/api/` (git, npm, node, docker, the sonar scanner, program and shell runners)
get `TEMP`, `TMP` and `TMPDIR` set to it, so what npm, tsc, jest, Playwright and the scaffolds write follows it; the directory is created
when missing. Processes the runtime does not start (the workers Orca launches, the owner's own shells) keep their own temp directory. The housekeeping
tmp sweep removes prefixed entries older than `allocation.housekeeping.tmpMaxAgeMs` from the temp root and, when the OS temp directory is a
different directory, from it as well, because tools the runtime does not control keep writing there.

## Host resource floors (`resources`)

`resources: {minFreeDiskGb?, minFreeDiskPct?, minFreeRamPct?}` (config.yaml, gitignored) sets the capacity floors the dispatch gate
(`starci kernel dispatch --spawn`, `scripts/machine/host-resources.mjs`) enforces. Each key is a number above 0 or `null`
(`minFreeDiskPct` and `minFreeRamPct` at most 100); an unknown key or another value is refused with `Invalid config.yaml: resources...`.

- `minFreeDiskGb`: the free space, in GB, a drive must keep. `minFreeDiskPct`: the same floor as a percentage of the drive's size. When both are
  set the larger requirement applies (`5 GB (1 % disk)` on a 500 GB drive requires 5 GB; on a 2 TB drive 20 GB).
- `minFreeRamPct`: the free-RAM percentage below which no new heavy op starts (the RAM throttle's heavy floor).
- Precedence: owner `config.yaml resources`, key by key, over the shipped policy `modules/models/runtimes.yaml allocation.resources`. The shipped file is
  the only place that carries default numbers (`minFreeDiskGb`, `minFreeRamPct`, no percentage); code holds none, and a shipped policy without them is an error.
- The disks measured are the drive holding the temp root (`tempRoot()`) and the drive of the repository; the worst margin binds. Moving
  `roots.temp` to another drive moves the measured drive with it.

A refused dispatch (`host-resources-low`) names the drive, the floor and the keys above, and the temp root in use.
