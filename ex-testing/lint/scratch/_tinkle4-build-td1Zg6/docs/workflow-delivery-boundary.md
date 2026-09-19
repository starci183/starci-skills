# Complete the workflow, not a sequence of approval fragments

This execution rule applies equally to solo and coordinated work, manual and auto.

At entry, review the whole bounded workflow: intended outcome, inputs and prerequisites,
write ownership, effect ceiling, required tools, verification and completion recording.
Present a brief in the actual task and link its complete goal. Obtain the applicable
user or delegated approval once for that concrete scope; never fabricate authority.

After entry, carry out the authorized workflow through implementation, tests, diagnosis,
in-scope corrections and retests. Do not stop for a fresh approval after each file,
operator instruction, failed check or formatting correction. Progress commentary is
not a handoff. A coordinator reviews entry and the complete final output, rather than
turning every internal step into a new plan or approval request. Runtime cell checks
and truthful observations still apply within the workflow.

Stop before genuinely new effects: changed business decisions, expanded scope,
unowned shared writes, missing authority, unsafe operations or a real dependency
blocker. Preserve verified progress and report the precise missing condition. Do not
relax schemas, invent receipts or claim completion merely to avoid a stop.

At exit, review actual outputs against every criterion, check completion can be
recorded, then return usable results in the task. Distinguish unfinished scope from
failed checks. Record meaningful workflow friction and its cause for later runtime
improvement; do not count paperwork milestones as product delivery.

## Coordinator owns decisions, executor owns delivery

Distinguish the Plan coordinator from the executing task's workflow runner. The
runner dispatches operators, validates cell responses and manages bounded repairs
inside an already approved workflow. Legacy engine labels such as "coordinator
gate" or `explicit-coordinator-only` refer to this internal transition gate, not
an instruction for the Plan coordinator to operate tools or approve every cell.
The runner cannot grant goal approval or final acceptance on the coordinator's
behalf. Current cell checks retain the actual mandate and approval identities;
they do not create another conversation decision.

A delegated coordinator manages the complete Plans, their dependencies and exclusive
shared ownership. At entry, approve or reject the concrete goal against current
SRS/SDS, prerequisites, scope and risk. If rejected, return the specific unmet
condition, not a replacement implementation. At exit, compare expected and actual
outcomes, inspect the evidence needed to establish each claim, accept or return
the complete result, then release eligible dependent workflows. Acceptance is not
merely repeating the executor's pass count.

Between these boundaries, the executor owns code, tests, diagnosis and in-scope
repairs. Progress checks use task-level state or the agreed handoff, not recurring
source diffs, per-file log inspection or duplicate test runs. Use the available
completion wait with its cursor; unchanged state produces no user-facing report,
new task, reminder message or restart. A wait timeout is not an execution failure.
Intervene only for a reported blocker, a real cross-task conflict, changed authority
or a concrete safety issue. Investigate that issue without taking over unrelated
work. A separate implementation role requires explicit ownership and scope; it is
not implied by being coordinator. In solo execution, keep the same entry/exit
boundaries without inventing a second task or repeated self-approval checkpoints.

## Event-driven supervision between workflow boundaries

Once a workflow has an accepted input envelope and an active executor, the workflow
wrapper owns its internal operation scheduling, provider fallback, bounded retries,
diagnosis, edits, tests and in-scope repairs. The coordinator becomes an event-driven
consumer of workflow state; it is not a live terminal supervisor.

The coordinator waits quietly for one of these actionable boundary events:

- `question`: the executor needs a decision that it cannot make inside its accepted
  authority;
- `escalation`: ownership, scope, effects, safety or a cross-workflow dependency must
  be resolved outside the workflow;
- `worker_done`: the workflow has produced a terminal outcome for exit review;
- an explicit runtime `blocked`, `failed`, `closed` or `crashed` state that the
  workflow wrapper cannot recover internally;
- a liveness breach: the declared deadline has expired or expected heartbeats have
  been absent beyond the configured interval and grace period.

Everything else remains executor-owned and is non-actionable to the coordinator:
ordinary command output, status prose, healthy heartbeats, long-running tests inside
their deadline, transient tool or check failures under bounded repair, provider
fallback with no effects, and an unchanged wait timeout. These signals do not permit
the coordinator to read logs repeatedly, rerun commands, send prompts asking for
progress, restart a healthy worker, create replacement work or report unchanged state
to the user.

Use one cursor-based blocking event wait and re-arm it after a timeout without treating
the timeout as failure. Do not create a fixed polling loop around terminal reads,
source diffs, task listings or event snapshots. A monitoring interval controls when
the coordinator may evaluate liveness; it does not authorize periodic inspection of
healthy work.

When a liveness breach is suspected, inspect the smallest task-level signal first:
workflow/dispatch state, terminal existence and most recent heartbeat. Read one bounded
terminal tail only if those signals are inconsistent or insufficient to distinguish a
slow worker from a stopped one. If the worker is alive, return to the event wait. If it
is stopped, preserve its effects, classify known versus partial/unknown state, and use
the workflow's recovery or escalation path. Never take over implementation merely
because a workflow is slow.

On `question` or `escalation`, answer only the reported boundary and let the workflow
resume its own operations. On `worker_done`, perform the exit review once, accept or
return the complete output, release the settled worker and unlock dependents. The
coordinator does not replay the executor's work to establish that it was busy; it
reviews the output contract and the proof required by the accepted goal.

If a workflow does not make sense in actual use, distinguish a product defect, an
executor deviation and a runtime defect. Record the expected/actual mismatch and
its impact once. Under explicit runtime-maintenance authority, repair the smallest
relevant rule or mechanism and verify it with a representative regression scenario;
otherwise return a proposed correction. Do not alter active requests, weaken
acceptance or rewrite prior receipts to make a result pass. Adopt changed runtime
guidance at a safe workflow boundary unless the defect prevents safe execution.
