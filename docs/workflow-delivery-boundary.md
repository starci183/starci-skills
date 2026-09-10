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

If a workflow does not make sense in actual use, distinguish a product defect, an
executor deviation and a runtime defect. Record the expected/actual mismatch and
its impact once. Under explicit runtime-maintenance authority, repair the smallest
relevant rule or mechanism and verify it with a representative regression scenario;
otherwise return a proposed correction. Do not alter active requests, weaken
acceptance or rewrite prior receipts to make a result pass. Adopt changed runtime
guidance at a safe workflow boundary unless the defect prevents safe execution.
