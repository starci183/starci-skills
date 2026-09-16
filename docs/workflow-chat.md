# Running a workflow from a chat

A workflow does not need Orca. The kernel (`kernel/kernel.mjs`, see
[workflow-kernel.md](workflow-kernel.md)) is one process that owns the whole control loop, and Orca
only ever supplied two things to it: worktrees and attested agent terminals. The headless host adapter
(`workflow-run --host-adapter headless`, or `STARCI_HOST=headless` in the environment) supplies the
same two things differently - the worktree is the checkout the command runs in, and an operation is a
sequential `claude -p` or `codex exec` process instead of an Orca terminal - so a plain Claude Code chat
or a Codex chat runs the very same kernel on the very same store. The law is **one chat = one
workflow**, and the chat is the workflow's monitor, not another agent layer:
[skills/workflow-chat/SKILL.md](../skills/workflow-chat/SKILL.md) is the instruction the chat follows.

## What a chat can and cannot run

| in a chat | in Orca |
| --- | --- |
| every command of the entry: `workflow-goal`, `workflow-amend`, `workflow-approve`, `workflow-answer`, `workflow-run`, `workflow-status`, `workflow-list`, `workflow-stop`, `workflow-supervise` | the same commands |
| operations run one after another as headless model processes; the kernel still verifies, commits and gates each slice itself | admitted AI work shares ten slots; operation agents use attested Orca terminals and an enrolled manager uses one slot while it runs |
| an operation kind the headless host cannot serve is reported `host-unsupported`; its `host` needUser item names the capability the kind needs and this host does not offer, as `model/hosts.yaml` declares it, so the chat relays it as "this needs the Orca host" and the workflow carries on with everything else | every kind the profiles declare |
| `--lane` asks the host adapter for a worktree of its own; what the adapter cannot create it refuses, and the refusal is printed as it came | an Orca worktree row `[Workflow] <id>` |
| no `[Kernel]` tab: the kernel's last words are `<dir>/kernel.log` | the `[Kernel] <id>` tab |
| the chat polls; nothing is pushed to it | the same: a workflow has no monitor agent in either host |

The kernel's guards, the validator, the review rounds, the dynamic-op budget, the critique of the goal
and the single human gate are host-independent, so a chat gives up parallelism and drawing, never
verification.

## What the chat sees

1. **The goal page.** `workflow-goal` writes `<dir>/goal.md` and stops. The chat prints the sections
   the owner decides on - the critique (`## Phản biện (critique)`: verdict, required changes, the one
   question of a `refuse`, prerequisites), `## Needs you first`, `## Definition of done` and
   `## Runtime allocation` - and links the file. Nothing is launched before the owner answers.
2. **The status page.** `workflow-status --id <id>` renders kernel liveness, running and blocked
   operations, the ledger by feature, the validator, `## Needs you (n)`, the rate and the last events,
   all derived from the store's own files (see [Reading a workflow](workflow-kernel.md#reading-a-workflow)).
3. **Questions.** An operation that reports `ask` is first offered to the kernel's `decide` function, which
   may answer only a mechanical question (which runtime, a retry, a format) and only from the closed options
   it was given; everything else becomes a `needUser` item with the question text, and the operation is
   `blocked` until the owner decides. The chat relays the item verbatim and says what answering it takes.

   A `decision` item is the one the kernel prepared options for, and one command answers it:

   ```
   workflow-answer --id <id> --op <op> --choice <n> [--note "<the owner's words>"]
   ```

   That item comes from one of two places, and `--op` names a different operation in each. An **`decision.prepare` (or `provision.ask` for a provision)**
   op prepared it - a business rule, a design choice, an authority, a credential the environment lacks - and
   `--op` is that ask op; the owner's pick reaches every paused requester in its next contract. Or a
   **reconciliation conflict** raised it: the intake found that the new feature cannot hold together with
   what a decided record settled, wrote the decision record under its own feature with both sides, the
   numbered options and one recommendation, and the kernel listed it. There `--op` is **the intake operation's
   id**, because the intake is the op that wrote the decision; the answer is recorded on that decision record
   and the intake itself is not re-run, since re-running it would undo the reconciliation the owner just
   settled. The item on the list names its own op either way, so the chat passes on what it reads.

   **`## Provisional decisions (n)` is not a question the workflow is waiting on.** Since 5-plus the owner is
   stopped for exactly two things - something only they can provide (a credential, an account on an outside
   system, a real dataset, a legal authority) and an effect nobody can undo (a message to real customers, a
   payment, a deletion of real data, a publish). Every other open question is taken **provisionally** on the
   runtime's own recommendation and the work carries on, so a workflow can finish `done` and still owe the
   owner a page of decisions. Relay that section as what it is: here is what the runtime decided for you, and
   here is the command that changes it. The same command answers it - `workflow-answer --id <id> --op <ask op>
   --choice <n>` - and the number matters: **the same option confirms what was built, a different one reopens
   every node that was built on it.** Say that when you relay one, so an answer is never given carelessly.

   The owner can also answer **in the operation's own terminal**, by typing the option number there while the
   `decision.prepare` (or `provision.ask` for a provision) op is still open; the kernel treats that exactly as the command. A credential is
   provided in the workflow's own researched Orca form; the kernel opens it, groups duplicate requests,
   checks encrypted custody presence and resumes satisfied requesters. On a headless host the fallback is
   the exact hidden `identity fill` command. The observer never opens substitute credential terminals and
   never accepts values in chat. Missing official-documentation research is repaired by the owning
   operation before the workflow asks for credentials. For runtime feedback, update the runtime and restart
   the workflow for a blind test from its canonical goal and Work; do not inject observer context or hints.

   A `host` item is different again: the operation's kind needs a capability this host does not offer, as
   `model/hosts.yaml` declares it. There is nothing to arrange locally - the same workflow resumes in Orca.
   Every other kind is answered in the world - a Work record, the goal's wording, the machine - and after the
   owner acted, `workflow-approve --id <id>` re-admits the operation.
4. **The end.** `state.finished` carries the outcome and the path of `<dir>/final-report.json`. A
   `blocked` finish with every gate green means questions for the owner remain; that is the report's
   `needUser[]`, not a defect.

## The exact command lines

`<skill root>` is the installed `.claude` directory; every command runs from the repository worktree
`<repo>` the job is about. `<dir>` is `<repo>/.starciwork/_local/workflows/<id>` (a lane shares it with
its base worktree through the git common dir; a repository that shares another repository's Work tree
keeps it in the owner repository).

`bin/starci.mjs` is the one command entry: it forwards a workflow command to the kernel launcher with its
argv untouched, so no command line a person types names a module path inside the runtime.

```
node <skill root>/scripts/ensure-build.mjs
node <skill root>/bin/starci.mjs workflow-goal    --host <skill root> --job "<the owner's prompt>" [--scope f1,f2] [--lane [<name>]]
node <skill root>/bin/starci.mjs workflow-approve --host <skill root> --id <id> [--allocation <runtime>=<slots>[:<tiers>][@<roles>],...] [--allow-dynamic N] [--accept-critique "<reason>"]
node <skill root>/bin/starci.mjs workflow-answer  --host <skill root> --id <id> --op <ask op or intake op> --choice <n> [--note "<the owner's words>"]
node <skill root>/bin/starci.mjs workflow-run     --host <skill root> --id <id> --host-adapter headless   # detached, output appended to <dir>/kernel.log
node <skill root>/bin/starci.mjs workflow-status  --host <skill root> --id <id> [--json true]
node <skill root>/bin/starci.mjs workflow-stop    --host <skill root> --id <id>
node <skill root>/bin/starci.mjs workflow-amend   --host <skill root> --id <id> --amendment <record.yaml>
node <skill root>/bin/starci.mjs workflow-list
STARCI_HOST=headless node <skill root>/bin/starci.mjs workflow-supervise --host <skill root>   # detached; starts and restarts every approved, unfinished workflow of the repository
```

`--host` stays on every command that reaches a ledger. Without it the kernel looks for the Work tree under
`<repo>/.claude`, which is right for a repository that owns its own tree and wrong for one that shares
another repository's - a frontend working its backend's Work - so the flag is what makes such a job
resolvable at all. It is not read from the entry's own location.

`workflow-run` and `workflow-supervise` are started detached and never in the chat's foreground: a chat
that blocks on the kernel cannot relay a question, and an operation runs for minutes. The chat drives a
live kernel only through `workflow-approve` (queued in `<dir>/inbox/`, applied at the next tick) and
`workflow-stop` (`stop.flag`, honoured at the next tick); it never writes `state.json`, because the
kernel holds the state in memory and saves over the file at every tick. Stop also atomically exports the
human-readable backend-owned `workflows/<id>.md` brief with a runtime-managed section beside preserved human notes, scope, accepted work, remaining
operation identities, owner decisions, blockers and the next safe action. The journal/state/pin/candidate
records remain authoritative; the Markdown is a continuation projection, not a substitute state store.

## One store, two hosts

Both hosts read and write the same directory, `<repo>/.starciwork/_local/workflows/<id>`, and the
event log in it is the source of truth ([workflow-store.md](workflow-store.md)). That is what makes a
workflow portable between them:

- **Started in a chat, read in Orca.** `workflow-list` in Orca shows it like any other workflow: its
  phase, its operations, whether a kernel is alive. `workflow-status --id <id>` renders the same page.
  An Orca supervisor that finds it approved, unfinished and without a live kernel starts a kernel for
  it - on the Orca host, with Orca terminals - and the kernel resumes from `state.json` and the event
  log with the same counters and the same ledger. That is also how a chat hands over an operation the
  headless host could not serve: stop the headless kernel, wait for its controller PID to exit, inspect the
  exported continuation brief, and let Orca invoke `workflow-run`. That command acquires the single-controller
  lock, verifies exact operation/job/lease/task/dispatch identity, and removes `stop.flag` only after the
  boundary is consistent.
- **Started in Orca, watched from a chat.** `workflow-status` needs no Orca runner, so a chat reads an
  Orca workflow as it is. To take it over, stop its Orca kernel first, wait for the controller PID recorded
  in the continuation brief to exit, and start `workflow-run --id <id> --host-adapter headless`; `kernel.lock` keeps a second kernel
  out while the first one is alive, and the kernel that starts resumes from `state.json` and the event
  log, settling the operations that were live on the other host in its reconcile pass before it
  launches anything, as after any restart.
- **Never two supervisors on one repository.** Each supervisor starts kernels for every approved,
  unfinished workflow it sees; one running on the Orca host and one running headless would take turns
  starting each other's workflows on the wrong host. Run one, on the host you want the operations on.

## What the chat never does

The rules are the kernel's, restated for the chat: it never edits the Work tree or product code by
hand (the operations do the work and the kernel commits it), never writes into the store, never approves
or overrides a critique without the owner's words, and never runs a second workflow in the same chat -
a second goal is a second workflow in a new chat, with `--lane` so the two never share a worktree.
