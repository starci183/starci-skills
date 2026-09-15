# StarCi execution contract

Status: StarCi 1.0, open source under MIT. This contract governs enrolled workflows. An enrolled workflow carries
`engine.schema: starci/engine@1` in its durable state; a workflow enrolled by an earlier build keeps its recorded
policy until the explicit retry boundary in the upgrade note, which migrates its record.

## Participants and authority

The supervisor is a program that watches kernel processes. It is neither Codex nor a chat. The kernel is
the sole workflow-state writer: it derives executable actions, requests bounded model functions, collects owner
actions, checks evidence, integrates accepted changes and derives completion. With explicit
`engine.coordination: agent-v1` enrollment, a manager model function orders only the action IDs in a
digest-bound kernel snapshot. The kernel rechecks each precondition before acting. The manager cannot create
an action, edit Work or state, perform an operation, approve evidence, or answer for the owner. A worker executes one op.
A validator is an independent execution that evaluates a sealed result against canonical requirements and
machine evidence. It is not the worker's self-rating and is not made independent merely by choosing a
different provider. A supervising chat observes and repairs this runtime; it does not fill product inputs,
rescue workers or supply hidden hints during a workflow trial.

Canonical Work remains the semantic authority. Operation dependencies and ready work are derived from it;
the operational journal is execution history, reservations and checkpoints, not another product plan.
Identity is `(workflowId, opId, attempt, generation, jobId)`. Replies, artifacts and leases must match it.

## Scheduling and slow work

The local SQLite journal atomically admits resource reservations and records durable jobs. The manager,
operation agents, planners, technical decision functions and model judges share a global ceiling of ten
AI slots. Unrelated user chats are outside this enrollment. Operation/provider limits and exclusive resources
still apply. Eligibility precedes budget and load ranking. Ready work is ordered by completion pressure,
dependency critical path, downstream unlocks and age. Unverified candidate backlog constrains new builders.

Model and command-check jobs execute in detached processes. The kernel replays the same stable job identity
to obtain the recorded result; pending work yields the tick without spending an operation retry. Expired
leases become `effect_unknown` and retain capacity until actual settlement. A timeout, crash, empty readback
or missing receipt is not proof an external effect did not occur. Idempotency or conclusive reconciliation
is required before repeating an effect. A runtime switch alone does not reset an incident's progress budget. The manager decision is durable model
work bound to workflow, generation, decision version and snapshot digest. Pending execution yields the tick
without an operation retry. Stale identity, unknown or duplicate action IDs, unlisted context requests and
malformed output fail closed. Repeated no-progress remains a bounded, visible incident; free-form prose is
never an executable fallback.

Host-local `config.json` owns three non-operation roles: `planner` for `assessGoal`/`planOp`,
`kernelManager` for `manageWorkflow`/`decide`, and `validator` for `critiqueGoal`/`validateOp`. The manager
uses the cross-provider `opus-sol` pool; planner and validator use `fable-astra`. Admission selects an
eligible, qualified member using known quota and capacity before the call; unknown quota is not unlimited.
The functions keep separate typed inputs and independent contexts even when they share a pool. See
[the local config format](config-format.md) for the complete closed role map.

## What the journal keeps

The journal keeps what a workflow needs to continue and nothing it has settled. The bound generation keeps one
state body, every transition checkpoint (so a replayed transition is recognised, body or not) and the latest
save checkpoint. A retired generation keeps nothing: no snapshot rows, no settled jobs, none of their events;
the kernel retires them when it binds the next generation. A finished workflow retires every row it holds.
Live reservations, unsettled jobs and their events are never touched, whatever their generation. The policy is
one record in `kernel/journal.mjs`, and `journal-prune` and `journal-retire` are the only operator commands
that act on rows a kernel does not own. Workflow state keeps a candidate record - identity, roots and digests -
and the candidate manifests stay under the candidate's control root; the event log rotates by generation at
the retry boundary and history stays readable.

## Disk headroom

The kernel measures the free space of the volumes it writes to before its first tick and before every tick,
against one threshold it prints with every finding. Below it the kernel records `disk-headroom-exhausted`,
saves nothing and exits with its own code; a write the disk refused mid-stage is `disk-full` and ends the
kernel the same way, never one more kernel error toward a crash loop. The supervisor measures the same
volumes every round and starts nothing onto an exhausted one; it starts the kernel again when room returns.

## Candidate acceptance

Native operation jobs are reconciled through their exact host Dispatch, never inferred dead because the
model-process journal has no child PID. Before retrying a stopped unreported worker, the kernel requires
typed settlement matching its launch receipt, freezes its actual candidate under the writer fence and
preserves only sealed in-scope changes as provenance. Unknown or out-of-scope effects retain the fence.
A fresh exact native running heartbeat outranks a screen-only stall heuristic; it does not extend the
operation deadline or certify that a product result is correct.

The kernel collects observed bytes and Git changes; a worker's file list is diagnostic only. Candidates and
protected oracles carry digests, accepted-head identity, dependency inputs and environment binding. Required
gates have four states: pass, fail, inconclusive and unavailable. Only complete, independently resolved and
current pass evidence admits integration. A setup failure on base code does not prove a behavioral fix.
Full evidence references must resolve; a truncated diff is not a complete review.

The integrator checks expected Git head and candidate/canonical drift immediately before promotion/commit.
Files, Git and an external provider cannot join one SQLite transaction: record intent and receipts, reconcile
partial effects, preserve unknown bytes and never autorevert unrelated user work. Goal completion requires
all required operations, checks, goal criteria and owner decisions to be settled. A correct owner blocker is
an honest blocked result, not a completed product outcome.

Orca native workers currently use detection-only compatibility. A canonical-root writer reservation
serializes their writes; frozen copies and drift checks detect contamination. This does not prevent a
native process writing an absolute path outside its root. A hard-boundary adapter must be separately
implemented and demonstrated with adversarial worker-level tests before parallel native writers are enabled.

## Model choice and owner journey

Model qualification binds exact provider/model/version to independently measured workload, tools, context,
risk and quality evidence. Names, quota, model self-claims and authored test summaries do not certify it.
Bounded probation may admit approved local work with strict machine checks and fresh independent review;
it cannot relax a higher quality floor or authorize an external mutation. Qualification gaps remain visible.

An integration owner first reads current official documentation and declares the actual account, scopes,
auth lifecycle, callback/webhook applicability, prerequisites, credential fields and provider verification.
The workflow completes its own prerequisites, then presents researched input in one Orca page. Credentials,
information, accounts, access, consent, authority, business choices and irreversible confirmations have typed
requests. The server writes credentials through existing encrypted custody and queues an authenticated action;
the kernel alone applies it. Plaintext secrets never enter model context, workflow state or event logs.
Saved credentials remain saved until a separately collected provider verification receipt proves validity.
Wrong or expired values return a precise correction request bound to the exact requested credential revision.

## Feedback and release evidence

An interactive kernel emits bounded progress and wait summaries on stderr while preserving stdout JSON.
The manager's validated explicit rationale explains its selected actions; hidden model reasoning is not
part of the interface. Repeated waits are deduplicated. The status view separates selected from attested
models and distinguishes meaningful transitions from polling and repeated admission failures.

After feedback, repair the runtime, test it privately, seal a new build and explicitly retry the affected
unfinished workflow operations with fresh agent contexts. Agent-led coordination is a forward enrollment at
that retry boundary; migration preserves settled owner actions, accepted Work, evidence and spent budgets and
never reinterprets a model recommendation as an owner answer. Keep the goal, authority and accepted dependency
outputs. Record whether the trial resumes existing Work or starts a clean end-to-end scenario. A resumed
trial, unit tests, a synthetic credential form, and a container primitive probe are different evidence and
must never be reported as interchangeable proof of unattended delivery.
