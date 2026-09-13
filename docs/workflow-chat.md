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
| every command of the launcher: `workflow-goal`, `workflow-approve`, `workflow-run`, `workflow-status`, `workflow-list`, `workflow-stop`, `workflow-supervise` | the same commands |
| operations run one after another as headless model processes; the kernel still verifies, commits and gates each slice itself | up to ten operations at once, each in an attested Orca terminal |
| an operation kind the headless host cannot serve (the ones that draw or need a browser the adapter does not drive, `interface.draw` among them) is reported `host-unsupported`; the chat relays it as "this needs the Orca host" and the workflow carries on with everything else | every kind the profiles declare |
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
3. **Questions.** An operation that reports `ask` is first offered to the kernel's `decide` function;
   what it cannot answer becomes a `needUser` item of kind `authority` with the question text, and the
   operation is `blocked` until the owner decides. The chat relays the item verbatim and says what
   answering it takes; after the owner acted, `workflow-approve --id <id>` re-admits the operation.
4. **The end.** `state.finished` carries the outcome and the path of `<dir>/final-report.json`. A
   `blocked` finish with every gate green means questions for the owner remain; that is the report's
   `needUser[]`, not a defect.

## The exact command lines

`<skill root>` is the installed `.claude` directory; every command runs from the repository worktree
`<repo>` the job is about. `<dir>` is `<repo>/.starciwork/_local/workflows/<id>` (a lane shares it with
its base worktree through the git common dir; a repository that shares another repository's Work tree
keeps it in the owner repository).

```
node <skill root>/scripts/ensure-build.mjs
node <skill root>/.dist/hosts/orca/launch.mjs workflow-goal    --host <skill root> --job "<the owner's prompt>" [--scope f1,f2] [--lane [<name>]]
node <skill root>/.dist/hosts/orca/launch.mjs workflow-approve --host <skill root> --id <id> [--allocation <runtime>=<slots>,...] [--allow-dynamic N] [--accept-critique "<reason>"]
node <skill root>/.dist/hosts/orca/launch.mjs workflow-run     --host <skill root> --id <id> --host-adapter headless   # detached, output appended to <dir>/kernel.log
node <skill root>/.dist/hosts/orca/launch.mjs workflow-status  --host <skill root> --id <id> [--json true]
node <skill root>/.dist/hosts/orca/launch.mjs workflow-stop    --host <skill root> --id <id>
node <skill root>/.dist/hosts/orca/launch.mjs workflow-list
STARCI_HOST=headless node <skill root>/.dist/hosts/orca/launch.mjs workflow-supervise --host <skill root>   # detached; starts and restarts every approved, unfinished workflow of the repository
```

`workflow-run` and `workflow-supervise` are started detached and never in the chat's foreground: a chat
that blocks on the kernel cannot relay a question, and an operation runs for minutes. The chat drives a
live kernel only through `workflow-approve` (queued in `<dir>/inbox/`, applied at the next tick) and
`workflow-stop` (`stop.flag`, honoured at the next tick); it never writes `state.json`, because the
kernel holds the state in memory and saves over the file at every tick.

## One store, two hosts

Both hosts read and write the same directory, `<repo>/.starciwork/_local/workflows/<id>`, and the
event log in it is the source of truth ([workflow-store.md](workflow-store.md)). That is what makes a
workflow portable between them:

- **Started in a chat, read in Orca.** `workflow-list` in Orca shows it like any other workflow: its
  phase, its operations, whether a kernel is alive. `workflow-status --id <id>` renders the same page.
  An Orca supervisor that finds it approved, unfinished and without a live kernel starts a kernel for
  it - on the Orca host, with Orca terminals - and the kernel resumes from `state.json` and the event
  log with the same counters and the same ledger. That is also how a chat hands over an operation the
  headless host could not serve: stop the headless kernel (`workflow-stop`, then delete `stop.flag`)
  and let Orca run it.
- **Started in Orca, watched from a chat.** `workflow-status` needs no Orca runner, so a chat reads an
  Orca workflow as it is. To take it over, stop its Orca kernel first (`workflow-stop`, then delete the
  flag) and start `workflow-run --id <id> --host-adapter headless`; `kernel.lock` keeps a second kernel
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
