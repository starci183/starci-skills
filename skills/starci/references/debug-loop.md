# Debug loop

Debugging a workflow is a recurring loop of the chat that started it. It is not an Orca seat, a background agent, a
subagent or a runtime process: the chat session runs the loop on its own model, and no StarCi process schedules anything.
Set it up yourself right after `starci workflow start` reports a Kernel, or whenever the owner asks to debug or watch a
workflow. Set up one loop per chat; if the chat already runs one, keep it.

The loop's job is a clean host, not a report. Each tick finds what is stuck or left behind and gets it cleaned up; the
owner hears results. A list of standing problems handed to the owner is the loop failing at its job.

Interval: `debugLoop.interval` of the owner's `config.yaml` (`<n>s`, `<n>m` or `<n>h`); an absent key means the shipped
default in `config.example.yaml` (10 minutes). Never write the config to choose it.

The loop prompt is this one fixed sentence:

```text
Run `starci debug digest`, get every problem it lists cleaned up now by its owner as `references/debug-loop.md` says, report in the owner's language only what was cleaned up and what truly needs the owner, and end this loop when the digest shows no running workflow.
```

## Claude Code

```text
/loop <interval> Run `starci debug digest`, get every problem it lists cleaned up now by its owner as `references/debug-loop.md` says, report in the owner's language only what was cleaned up and what truly needs the owner, and end this loop when the digest shows no running workflow.
```

`<interval>` is the config value, for example `10m`. Claude Code's `/loop` takes a leading interval and a prompt.

## Codex

The owner's decision names the form `/loop every <N> minutes "<prompt>"`. That syntax is unverified: the Codex CLI
installed here (0.160.0) carries no `/loop` slash command and its feature list has none, and public notes for 0.145 say the
same. Act in this order:

1. If the running Codex accepts `/loop`, use `/loop every <N> minutes "<the fixed sentence>"`, `<N>` the interval in minutes.
2. Otherwise, in the Codex app create a thread automation (heartbeat) on this thread with the fixed sentence and the
   configured interval.
3. Otherwise say that this Codex has no loop, and run `starci debug digest` yourself when the owner asks.

State which of the three you used. Do not claim a loop exists until the host confirmed it.

## Rules

- `starci debug digest` itself only reads. Acting on what it shows is the tick's work, in the same turn.
- Every problem the digest lists gets an owner and an action before the tick ends:
  - a stuck or failed job, a hold past its bound, a gate nobody answered: the policy step the digest names is taken by its
    handler. Relay it to that handler now (the workflow's Kernel terminal, or `starci supervisor tell` for the Supervisor)
    and check on the next tick that it was done.
  - a leftover (a reservation, lease, worktree record, terminal or queue item nothing stands behind): run the runtime's own
    collector for it (`starci machine worktrees gc`, `starci supervisor gc --apply`, `starci reconciler up --services`);
    a leftover no collector takes is a runtime defect.
  - a runtime defect (the runtime did the wrong thing, or nothing cleans a leftover): it is fixed in the runtime with a
    spec, through the Supervisor's fix lane or a fix lane the chat opens, and the fix is carried onto the running host.
  - a seat that is down or drifted: `starci workflow start` or `starci supervisor start` from an Orca terminal;
    `starci reconciler restart` for an engine on an old revision.
- Never edit a store, a ledger or a product repository by hand, never resolve a gate as someone else, never enter a
  credential. What only the owner can do (a login, a product decision, a publication) is the one thing reported as open,
  once, with the exact action.
- Report what was cleaned up and what is in progress, short. Do not ask the owner whether to fix something the rules
  above already assign.
- Show the first lines as they are: a controllers alarm is the first line of the digest.
