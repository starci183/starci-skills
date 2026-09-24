# benchmark/

The runtime's durable memory of how each model pool actually performs against what the routing contract
expects of it. Routing and profile decisions (`modules/models/runtimes.yaml`, `modules/models/registry.yaml`,
`modules/models/profiles/*.yaml`, `config.yaml` `allocation.shares`) cite this directory, so a change of who
runs what is argued from measured evidence rather than from a model's reputation or a subscription label.
`modules/models/registry.yaml` `costPolicy` already requires it: benchmark bounded representative operations
before proposing another routing change.

## Layout

```text
benchmark/
  README.md             this file: purpose, layout, update process
  expectations.yaml     EXPECTED: each pool's role and strengths as the routing contract assumes them,
                        plus public benchmark figures (null unless a public source is cited)
  snapshots/            ACTUAL: model-scorecard output, one file per date x window, append-only
    <YYYY-MM-DD>-<N>h.json
  findings/             ANALYSIS: expected vs actual for one snapshot, and the decision it led to
    <YYYY-MM-DD>.md
```

- **expectations.yaml** follows the contract. Every entry cites the file it was derived from, and its `asOf`
  names the runtime commit. When a routing or profile change lands, update the matching entry and `asOf`
  (an owner-approved change that has not landed yet sits in `approvedChange` until it does). Its
  `publicBenchmarks` values stay `null` until a public source is cited for them with url, publication date and
  retrieval date. Never invent, estimate or recall a number.
- **snapshots/** hold the raw `node scripts/agent/model-scorecard.mjs --json` shape, unchanged: repos, window,
  job count, duration sources, errors, and per pool x op kind the jobs, pass/fail/blocked rates, rework
  and median duration. Qwen token counts are machine-wide. Snapshots are **append-only**. A snapshot is
  never edited, re-generated or deleted, even when it later proves misleading. The correction goes into a
  new snapshot or a findings note.
- **findings/** hold the supervisor's written analysis of one snapshot: per-pool figures, same-kind
  comparisons, expectation vs actual, caveats, and the proposal with the owner's decision on it. A findings
  note is written in the language the owner approved it in. It is dated and not rewritten after the owner
  decides. A later note supersedes it by citing it.

## Update process

1. Take a snapshot from the live runtime directory. The script reads every ledger read-only, and with no
   `--repo` it takes the Work owner of every `.workspaces/projects/<p>/work.json` binding that holds a ledger:

   ```sh
   node scripts/agent/benchmark-snapshot.mjs --since-hours 72
   node scripts/agent/benchmark-snapshot.mjs --since-hours 72 --repo ../nivo-backend --repo ../mia-mia-backend
   ```

   It writes `benchmark/snapshots/<today>-<N>h.json` and prints a short per-pool delta against the newest
   earlier snapshot of the same window. When that file already exists it refuses and writes nothing. Pick
   another window or wait a day; never delete the old file to make room.
2. Compare the snapshot with `expectations.yaml` and write `findings/<date>.md`: which pools and kinds
   match, fall below or exceed the expectation, with the job counts behind each claim. Only compare kinds
   with enough jobs, and name the caveats (runtime defects inside the window, owner or gate waits counted as
   blocked, a model switch inside the window).
3. Any routing or profile proposal goes to the owner with the findings note. Record the decision (approved,
   rejected or amended, with its date) in that note. Then land the contract change in its own lane and
   update `expectations.yaml` to match.
4. Commit snapshots, findings and expectation updates through the normal land gate.

## Citing the benchmark

A routing or profile change built on this evidence cites it in the changed file's comment and in its
`modules/kernel/contract-changes.yaml` entry. Name the snapshot file, the findings note and the specific
figure, for example:
`benchmark/snapshots/2026-09-25-72h.json: backend.scaffold qwen 92% pass (36 jobs) vs devin 73% (45) vs codex 43% (23); benchmark/findings/2026-09-25.md`.
A claim with no snapshot behind it is marked `INFERRED`, as the profiles already do. Public benchmark figures
are cited only through `expectations.yaml` `publicBenchmarks` sources, never inline from memory.
