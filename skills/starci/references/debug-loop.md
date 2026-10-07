# Debug loop

Debugging a workflow is a recurring loop of the chat that started it. It is not an Orca seat, a background agent, a
subagent or a runtime process: the chat session runs the loop on its own model, and no StarCi process schedules anything.
Set it up yourself right after `starci workflow start` reports a Kernel, or whenever the owner asks to debug or watch a
workflow. Set up one loop per chat; if the chat already runs one, keep it.

Interval: `debugLoop.interval` of the owner's `config.yaml` (`<n>s`, `<n>m` or `<n>h`); an absent key means the shipped
default in `config.example.yaml` (10 minutes). Never write the config to choose it.

The loop prompt is this one fixed sentence:

```text
Run `starci debug digest`, report what changed since the previous tick and the standing problems in the owner's language, change nothing and fix nothing, and end this loop when the digest shows no running workflow.
```

## Claude Code

```text
/loop <interval> Run `starci debug digest`, report what changed since the previous tick and the standing problems in the owner's language, change nothing and fix nothing, and end this loop when the digest shows no running workflow.
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

- The digest is read only. Report its problems; the Supervisor and the Kernels own every repair. Do not start, restart or
  resolve anything because the digest shows a problem; relay it to the owner or to the workflow's Kernel terminal.
- Show the first lines as they are: a controllers alarm is the first line of the digest.
