# Workflow store: one directory per workflow, one append-only log

In runtime 5.0 the only runtime state of a product lives under the main
repository's `.starciwork/_local/workflows/<workflowId>/`. A workflow id is
`yyyymmdd-hhmmss-slug`, so the directory name sorts by time and reads as its
title. `repositoryRoot(cwd)` resolves a linked worktree to the main repository,
so every terminal of one product writes into the same workflows root.

## Layout

```text
.starciwork/_local/workflows/<workflowId>/
  events.jsonl        append-only audit trail, one JSON object per line
  state.json          derived snapshot, schema starci/workflow-state@1
  goal.md, goal.json  the confirmed goal, readable and machine form
  launch.json         how the workflow was launched
  final-report.json   the workflow report that ends the run
  reports/<dispatch>.json   one typed op report per dispatch
  contracts/<opId>.md       the operation contract handed to a worker
  checks/<opId>.json        the checks a worker actually ran
  inbox/                    messages and hand-offs addressed to the workflow
```

`createStore({repoRoot, id})` creates the directory and the four
subdirectories, then exposes those paths plus `appendEvent`, `readEvents`,
`saveState`, `loadState`, `reportPath`, `readReports`, `contractPath` and
`checksPath`. `listWorkflows(repoRoot)` lists every workflow newest first with
its loaded state.

## The event log is the source of truth

`events.jsonl` is appended, never rewritten and never reordered. Each line
carries `at`, a monotonic `seq` and whatever the caller recorded; `seq`
continues after the process restarts because the store reads the highest seq
already on disk, and a torn or hand-edited line cannot reset the counter.
`readEvents({since})` replays everything after a seq, which is how a resumed
coordinator catches up without trusting a snapshot.

`state.json` is derived: it is whatever the current phase needs in order to act
without replaying the log, and it is written atomically (a sibling tmp file, then
a rename), so a crash leaves either the previous state or the new one, never a
half file. If the snapshot and the log disagree, the log wins.

## What is not stored

There are no other `_local` subtrees in 5.0. The 4.x `_local/plans`,
`_local/runtime/reports/<run>`, `_local/sessions` and per-run wait-state
locations are gone: reports live in the workflow's own `reports/`, and there is
no separate plan directory to keep in sync. Nothing outside
`.starciwork/_local/workflows/` is runtime state, and the store writes nowhere
else. Secrets, build output and product source stay out of the workflow
directory; `readReports()` skips `wait-state.json` and any file it cannot parse,
so a foreign or half-written file in `reports/` is ignored rather than obeyed.
