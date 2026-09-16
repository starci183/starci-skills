# Workflow store: one directory per workflow, one append-only log

In runtime 5-plus the only runtime state of a product lives under the main
repository's `.starciwork/_local/workflows/<workflowId>/`. A workflow id is
`yyyymmdd-hhmmss-slug`, so the directory name sorts by time and reads as its
title. `repositoryRoot(cwd)` resolves a linked worktree to the main repository,
so every terminal of one product writes into the same workflows root.

## Layout

```text
.starciwork/_local/workflows/
  runtime-loads.json  the shared runtime ledger of the repository (every kernel reads and writes it)
  supervisor.log      one line per supervision round
.starciwork/_local/workflows/<workflowId>/
  events.jsonl        append-only audit trail of the current generation, one JSON object per line
  events.g<n>.jsonl   the audit trail of retired generation n, closed at the retry that retired it
  state.json          derived snapshot, schema starci/workflow-state@1; candidate manifests stay under the
                      candidate's own control root beside the journal, the state keeps a record of them
  goal.md, goal.json  the confirmed goal, readable and machine form; both carry the mandatory
                      critique of that goal (`## Phản biện (critique)`, `critique`) above its
                      definition of done - see docs/workflow-kernel.md, Phases
  launch.json         how the workflow was launched
  final-report.json   the workflow report that ends the run
  reports/<dispatch>.json   one typed op report per dispatch
  contracts/<opId>.md       the operation contract handed to a worker
  checks/<opId>.json        the checks a worker actually ran
  inbox/                    messages and hand-offs addressed to the workflow
  validator/                the one validator's memory page and its verdict log
  headless/                 the headless host's mailbox, prompts and process logs
  strays/<timestamp>/       what an abandoned operation left behind, moved out of the tree
  kernel.lock, stop.flag    the live kernel's pid, and the pause a person writes
```

The two files in the workflows root itself belong to the repository, not to one
workflow: `runtime-loads.json` is the shared runtime ledger every kernel reads
before it allocates and writes when it launches, releases or runs into a
provider limit (see
[workflow-kernel.md](workflow-kernel.md#runtimes-are-shared-across-workflows)
and [runtime-allocation.md](runtime-allocation.md#one-ledger-per-repository)),
and `supervisor.log` is the supervisor's round log.

`kernel/store.mjs` owns the whole of it. `createStore({repoRoot, id})` creates the directory and the four
subdirectories, then exposes those paths plus `appendEvent`, `readEvents`,
`saveState`, `loadState`, `acknowledgeRuntimeFile`, `reportPath`, `readReports`, `contractPath` and
`checksPath`. `listWorkflows(repoRoot)` lists every workflow newest first with
its loaded state.

## The event log is the source of truth

`events.jsonl` is appended, never rewritten and never reordered. Each line
carries `at`, a monotonic `seq` and whatever the caller recorded; `seq`
continues after the process restarts because the store reads the highest seq
already on disk, and a torn or hand-edited line cannot reset the counter.
`readEvents({since})` replays everything after a seq, retired segments first, which is how a resumed
coordinator catches up without trusting a snapshot. A retry closes the live log as the segment of the
generation it retires (`rotateEvents`); the next event opens a fresh live log and the counter continues.

`state.json` is derived: it is whatever the current phase needs in order to act
without replaying the log, and it is written atomically (a sibling tmp file, then
a rename), so a crash leaves either the previous state or the new one, never a
half file. If the snapshot and the log disagree, the log wins.

After an enrolled store completes a state replacement, event append or bounded runtime artifact write, its
operational journal records a `starci/runtime-file-write@1` receipt with the exact path, resulting state, byte
digest and size. Controller locks, generation rotation, contracts and kernel/native reports and checks use the
same store API. Candidate change detection accepts only the latest receipt for that exact path and bytes, so an
older receipted body, path-only ownership or tampering after a receipt cannot regain trust. Normal completion
drops jobs and non-custody history while retaining one final state snapshot and the latest receipt per runtime
path; this bounded residue lets an already-open candidate recognize the finished kernel without retaining its
whole operational history.

## What is not stored

There are no other `_local` subtrees in 5.0. The 4.x `_local/plans`,
`_local/runtime/reports/<run>`, `_local/sessions` and per-run wait-state
locations are gone: reports live in the workflow's own `reports/`, and there is
no separate plan directory to keep in sync. Nothing outside
`.starciwork/_local/workflows/` is runtime state, and the store writes nowhere
else. Secrets, build output and product source stay out of the workflow
directory; `readReports()` skips `wait-state.json` and any file it cannot parse,
so a foreign or half-written file in `reports/` is ignored rather than obeyed.
