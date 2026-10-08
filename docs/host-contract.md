Owner: modules/host/
# Host contract — Orca calls and agent cards

Everything StarCi knows about driving a coding agent on the Orca host is
**data** under `modules/`, in two module trees: `modules/host/orca/` is the
host contract and `modules/models/agents/` holds the per-agent cards. The
mechanism that reads them (`scripts/agent/lib.mjs`, `scripts/api/orca/`) is
agent-blind.

## Host platform boundaries

The executable resolver is `scripts/api/orca/lib.mjs#resolveOrcaCommand`. It keeps the explicit
StarCi override, then Orca's managed-session executable hint, before selecting the OS command.
Linux uses the IDE CLI name because the bare name belongs to the GNOME screen reader; macOS uses
the registered Orca CLI, and Windows retains its executable-only lookup. A selected executable's
failure is reported by the existing host-unavailable receipt; the runtime does not retry another build.
Orca development sessions may select their exact executable through the explicit override.

Managed host startup requires the service actuator capability declared by
`scripts/reconciler/services.mjs#servicePlatformProblem`. The current harness and scheduled-task
lifecycle uses Windows Task Scheduler; `scripts/reconciler/start.mjs#hostPlatformItem` makes an
unsupported managed profile a required preflight refusal before startup effects. Read-only checks
still report the actual capability. OS-specific process-table reads retain their existing receipt
and unknown-ownership boundaries; command selection alone proves no managed macOS/Linux startup,
restart, recovery or process-cleanup conformance. Those require actual disposable-host evidence.

Primary references read on 2026-10-04: [Orca CLI reference](https://www.onorca.dev/docs/cli/reference),
[Orca install platform notes](https://www.onorca.dev/docs/install), with version-matched CLI discovery owned by
[Orca CLI guide](../skills/starci/references/orca-cli.md).
These document executable selection and managed WSL hints; StarCi's service lifecycle and
its actual qualification remain owned by the runtime paths above.

## `modules/host/orca/` — the typed host contract

`modules/host/orca/` is the typed contract behind every
`scripts/api/orca/` wrapper and every orchestrated call StarCi issues:

| Document | Contents |
| --- | --- |
| `index.yaml` | Hierarchy names (`[Kernel] <Workflow>`, `[Op] <operation>`), environment binding, kernel and operation-agent call templates, routing rules, forbidden calls |
| `api.yaml` | The `orca agent-context` public-command inventory and the StarCi orchestration allowlist |
| `calls.yaml` | One typed entry per Orca call (`command`, `kind`, `flags`, `required`, `receipt`) plus the result-envelope and idempotency rules |
| `capabilities.yaml` | Supported host modes, roles and agent forms |
| `recipes.yaml` | Lifecycle sequences built from the typed calls |
| `validation.yaml` | Live-discovery and preflight contract — compare against `orca agent-context --json` and fail closed on mismatch |
| `envelopes.yaml` | The operation-input / report envelopes exchanged with agents |

`calls.yaml` is an **enforced** contract, not documentation:
`tests/repo/provider-orca.spec.mjs` proves every `scripts/api/orca/*.mjs`
wrapper's verb and `--flag` set is declared by a `calls:` entry, and every
entry names a real, allowed command from `api.yaml`.

Where the runtime keeps its own mechanism instead of Orca's, or wraps an Orca call
with a policy of its own, is recorded row by row in `orca-boundary.md`. That page
also covers why a worker's output is read by Dispatch (`worker-read`) and never
from its terminal.

## `modules/models/agents/` — per-agent cards

The contract an agent is started through is the **agent card**:
`modules/models/agents/<agent>.yaml` (schema `starci/agent-card@1`) — the
Orca adapter-card fields at top level plus an optional `capabilities:`
key for agent-specific facts. Shipped cards: `devin`, `claude`, `codex`.

The invariant: **every agent launch is `orchestration worker-start`**
(`modules/kernel/start-workflow.yaml`) and **no
caller assembles an agent command**. Orca composes it with the owner's per-agent
default args (Orca settings `agentDefaultArgs`: claude
`--dangerously-skip-permissions`, codex `--dangerously-bypass-approvals-and-sandbox`,
devin `--permission-mode bypass --respect-workspace-trust false`); the runtime
passes only `--agent`, and `--model`/`--effort` where the card takes them.
`terminal create` and `orchestration dispatch` are forbidden for the runtime
(`api.yaml` `forbiddenForStarciOrchestration`), and `scripts/checks/check-host-boundary.mjs`
rule `agent-launch` fails on any terminal-creating code.

## Card anatomy

```yaml
schema: starci/agent-card@1
agent: devin                     # binary/identity name
kind: native-managed-agent       # every card: Orca starts and supervises the worker

start:                           # the one launch
  api: orchestration.worker-start
  agentArgument: devin           # worker-start --agent <agentArgument>
  modelArgument: false           # false: no --model/--effort (Orca takes them for Claude, Codex, Cursor only)
release: {api: orchestration.worker-release, closeTerminal: true, verify: terminal-process-tree}   # then the runtime closes the terminal and proves its process tree gone (scripts/machine/worker-close.mjs)

readiness: …                     # screen patterns the liveness classifier and follow-up sends read
delivery: …                      # how a follow-up prompt reaches a live agent (inline or file reference)
submission: …                    # proof a follow-up was consumed (agent/send.mjs, nudge)
gateAutoAnswer: …                # the launch gates the runtime answers once (nudge)

knownFailures:                   # observed signals → meaning → action, dated
  - {signal: '…', meaning: …, action: …, seenAt: 2026-09-20}

verifiedAt: 2026-09-24           # when this card was last proven live
verifiedAgainst: 'devin CLI v3000.10.27, Orca 1.4.209'

forbidden:                       # things this agent must never be asked for
  - provider-native-subagent
  - reuse-existing-terminal
  - unsupervised-retain-as-success
  - inferred-underlying-model

capabilities:                    # optional — agent-specific facts
  …
```

## How `scripts/agent` launches an agent

`scripts/agent/lib.mjs` is the mechanism:

```text
spawnAgent({provider, model, effort, worktree, title, spec, run, from, request})
  ensureLaunchTrust(agent, worktree)   → the owner never answers a trust prompt
  worker-start(spec, worktree, --agent, [--model, --effort], run, from, --retry-request)
                                       → dispatchId + taskId (Orca filed the Task from --spec and injected it)
                                         (+ result.worker.agentTerminalHandle when present: live 1.4.209 has no `worker` key)
  worker-show(dispatch)                → attestation: effective agent (and model, when pinned) = the route;
                                         result.dispatch.assigneeHandle: the agent terminal when the start receipt named none (live: always)
  terminal rename(terminal, title)     → [Op] … / [Kernel] … / [Supervisor] main / [Worker] …
startAgent({…, prompt, objective, entry, priorRunId, request})
  run-create(objective, from = entry, --retry-request)
                                       → the agent's own Run (Kernel, Supervisor, [Worker])
  spawnAgent(spec = prompt, ...)       → spilled to a file past the host argv (task-spec.mjs)
```

Every mutation declares `replay` in `calls.yaml` (`idempotency`): `request`
mutations (run-create, run-use, worker-start) carry `--retry-request <id>` from
their first issue, the id derived from the caller's ledger identity (`request`),
and a lost receipt is settled by `request-show` and one replay under that id;
`reissue` mutations (worker-stop, worker-release, task-update) are naturally
idempotent and re-issued once; `none` is never re-issued by the runner.

A failed start is reconciled before it returns: no effect → nothing; unknown →
worker-show first, cleaned only when Orca shows the worker ended; partial →
`worker-stop` + `worker-release`. The job is then **not** running
(`dispatch-rejected`, per `modules/kernel/api.yaml`), never a ghost lease.
`settle` releases the worker with `worker-stop` + `worker-release`.

The host launch is only the delivery half of the op lifecycle; the durable
record is the ledger's op IPC (docs/ledger-db.md §4a): `starci kernel dispatch` writes
the `contracts` row — the contract is the dispatch authority, the Task spec
only delivers it — the worker reads it via `starci kernel op-contract` and files its
outcome with `starci kernel report`; the kernel marks it integrated with `starci kernel consume-report`,
records its re-run via `starci kernel record-checks`, and `starci kernel settle` releases the leases, the
worker and consumes the job's report row (`reports.consumed_at`) as part of
recording the verdict.

## Operation dispatch

Every operation - Claude, Codex, Devin - is a worker-start worker. The launch
sequence (typed calls from `calls.yaml`, wrappers under `scripts/api/orca/`):

```text
run-create(objective = workflow id + title,
           from = Kernel terminal)              → runId (once per workflow)
spawnAgent(spec = prompt/packet, taskTitle '<op> #<attempt>',
           displayName '[Op] <operation>', workflow worktree, agent, model,
           effort, run, from = Kernel,
           request = {job, lease})              → taskId + dispatchId + agent terminal + attestation
```

The workflow worktree is the one git worktree of the product repository that
Orca created before the Kernel started (`orca worktree create --name
wf-<workflowId> --base-branch main --setup run`, a real `npm ci` at the app root,
no junctions); the Kernel and every op of the workflow start on it with
`worker-start --worktree <its path>`.
Attestation is required before the seat is accepted — a worker whose
effective agent/model mismatches the route is fenced: `worker-stop` then
`worker-release` on the exact Dispatch, never a retry beside it. On success the
job's `worker_id` is the **Dispatch id**.

The Kernel is a worker too: `start-workflow.mjs` creates the Kernel's entry Run
from the launching terminal (its coordinator) and starts the Kernel with
`startAgent` (worker-start --spec files the Kernel Task). The Kernel's first operation creates the workflow Run from
the Kernel's own terminal (Orca takes Run-scoped calls only from a Run's
coordinator). An explicit Kernel agent/model pin fails closed when unavailable;
it is never silently substituted. `starci kernel hierarchy` projects `workflow → Kernel → Op`.

**The nested Run rule.** An agent that starts agents binds its OWN Run and starts
them there, which is the shape Orca's own worker preamble prescribes (SUB-DISPATCH):
the Kernel runs `run-create --from <kernel terminal>` (so it coordinates that Run),
and `worker-start --spec --run <it> --from <kernel terminal>`, which files each
op Task there. No Task names a `--parent`: Orca accepts a parent only
from the same Run (`Parent task … must belong to run …`), and the Kernel cannot
file a Task in its entry Run, where it is a worker (`consumer_fenced`). Orca nests
the workflow Run under the Kernel's Dispatch; `worker-show` reports the Kernel at
depth 1 and its op at depth 2 (real-Orca smoke 2026-10-01, lane dv-c0-launch).
`calls.yaml` `worker-start` declares no `parent` flag, so the wrapper cannot build one.

Nested workers need Orca's Settings → Orchestration → Nested worker depth of at
least 2 when the owner's chat starts the Kernel (chat → Kernel → Op), and 3 when the
`[Supervisor]` does (chat → Supervisor → Kernel → Op); the owner runs it at 4. Below
that, a worker-start from a worker is refused `nested_worker_depth_exceeded`.

## Pre-workflow launch smoke

`scripts/kernel/launch-smoke.mjs` (`starci/launch-smoke@2`) is the live proof of
every nesting path and of the workflow worktree, run by hand from a plain Orca shell before a workflow run (docs/releasing.md "Pre-workflow
readiness"). It starts no-op agents through the runtime's own launchers and checks the depth and creator Dispatch
`worker-show` reports:

| Path | Chain (depth) | Child launcher |
|---|---|---|
| `supervisor-worker` | entry (0) -> `[Supervisor]` (1) -> `[Worker]` (2) | `agent/start-worker.mjs startWorkerAgent`, from the Supervisor's terminal |
| `op-critic` | entry (0) -> `[Kernel]` (1) -> `[Op]` (2) -> critic (3) | `startAgent` from the Kernel's terminal; `draw-critic.mjs launchCriticWorker` from the Op's |
| `workflow-worktree` | entry (0) -> `[Kernel]` (1) -> be `[Op]`, fe `[Op]`, failing be `[Op]` (2) | `ensureWorkflowWorktree` first (Orca's `worktree create`), then the Kernel with `--worktree <its path>`; each op with `opWorktreeArgs`, from the Kernel's terminal |

The `workflow-worktree` path proves the one-worktree-per-workflow model on a scratch app (`--app-repo`): the Kernel's
worktree appears in `orca worktree list` (`scripts/api/orca/worktree-list.mjs`); the be op and the fe op start
together in it (`canDispatchConcurrently` admits them across sides and refuses a second be op beside the first); each
green op is a checkpoint whose gate base is the previous checkpoint; the failing op is preserved to
`preserved/<workflowId>/opFail` and the worktree reset to the last checkpoint; and, with every agent released,
`finishWorkflow` fast-forwards main and marks the worktree `release-pending`, then the host-side controller removes it
(gone from `orca worktree list`). Main's checkout is compared byte for byte before the run and after the removal:
exactly the two green files are added, every other tracked file and the `node_modules` listing are unchanged.
Each no-op file sits in a slot every scaffolded app owns (a be payload fixture under `be/src/tests/fixtures/`, an fe
static file under the `public/` folder of the first fe app (`fe/apps/<app>/public/`)), so the finish gate's lint judges the smoke, never an invented folder.

Each parent creates and coordinates the Run of its child (`run-create --from <its terminal>`). The draw critic is
placed on a runtime worktree detached at the empty tree (`draw-critic.mjs criticWorkspace`): Orca places a worker
only on a worktree it resolves, and a bare temp directory is refused `selector_not_found`. The critic's terminal is bound
to a job guard of role `critic` (`critic-guard.mjs`): its shell, file tools and, on Claude and Devin, its read tools reach
that directory and its verdict file and nothing else (`scripts/guards/critic-reach.mjs`, `modules/kernel/command-policy.yaml` `critic`).

## Checklist for a new agent card

1. Add `modules/models/agents/<name>.yaml` with `start` (worker-start,
   `agentArgument`, `modelArgument`) and `release`; Orca must know the agent
   and carry its unattended default args.
2. Prove `readiness` and `submission` patterns against the real TUI; record
   `verifiedAt`/`verifiedAgainst` and every observed failure in
   `knownFailures`.
3. Name it in a profile (`launch.orca.agent`) and the registry (`orcaLaunch.agent`);
   `scripts/checks/check-providers.mjs` refuses an unknown card.
4. Declare the `forbidden` list honestly; `spawnAgent` and the kernel packet
   enforce it.
5. If the card drives Orca calls the wrappers do not cover yet, extend
   `modules/host/orca/calls.yaml` in the same change — the parity spec fails
   on any wrapper flag the contract does not declare.
